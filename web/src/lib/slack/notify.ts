import "server-only";

import { env } from "@/lib/env";

type SlackApiResult = { ok: boolean; error?: string };

async function slackApi<T extends SlackApiResult>(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

function buildMessageBlocks(text: string) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: text,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "✅ 無事です", emoji: true },
          style: "primary",
          value: "safe",
          action_id: "report_safe",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "⚠️ 助けが必要", emoji: true },
          style: "danger",
          value: "help",
          action_id: "report_help",
        },
      ],
    },
  ];
}

async function postToWebhook(
  webhookUrl: string,
  text: string,
  includeInteractiveBlocks: boolean,
): Promise<string | undefined> {
  const body = includeInteractiveBlocks
    ? { text, blocks: buildMessageBlocks(text) }
    : { text };
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  // Incoming Webhook doesn't return thread_ts
  return undefined;
}

async function postToDm(
  token: string,
  userId: string,
  text: string,
  includeInteractiveBlocks: boolean,
): Promise<string | undefined> {
  // Open (or fetch) a DM channel id with the user
  const open = await slackApi<{ ok: boolean; channel?: { id: string }; error?: string }>(
    token,
    "conversations.open",
    { users: userId },
  );
  if (!open.ok || !open.channel?.id) {
    throw new Error(`Slack conversations.open failed: ${open.error ?? "unknown"}`);
  }

  const postBody: Record<string, unknown> = {
    channel: open.channel.id,
    text,
  };
  if (includeInteractiveBlocks) {
    postBody.blocks = buildMessageBlocks(text);
  }
  const post = await slackApi<{ ok: boolean; error?: string; ts?: string }>(token, "chat.postMessage", postBody);
  if (!post.ok) {
    throw new Error(`Slack chat.postMessage failed: ${post.error ?? "unknown"}`);
  }
  return post.ts;
}

export type NotificationMode = "production" | "drill" | "test";

export async function sendNotification(params: {
  text: string;
  forceDemoPrefix?: boolean;
  isDrill?: boolean;
  mode?: NotificationMode;
  mentions?: string[];
  /** 疎通確認用: プレフィックス・本番メンション・安否ボタンを付けない（text のみ） */
  connectivityTest?: boolean;
}): Promise<string | undefined> {
  const connectivityTest = params.connectivityTest === true;
  const includeInteractiveBlocks = !connectivityTest;

  console.log("Slack Notification Request:", {
    mode: params.mode,
    text: params.text,
    mentions: params.mentions,
    connectivityTest,
  });
  let modePrefix = "";
  const mode = params.mode || (params.isDrill ? "drill" : "production");

  if (!connectivityTest) {
    switch (mode) {
      case "drill":
        modePrefix = "【訓練】";
        break;
      case "test":
        modePrefix = "【試験/TEST】";
        break;
      case "production":
      default:
        modePrefix = "【安否確認】";
        break;
    }
  }

  const demoPrefix =
    connectivityTest ? "" : params.forceDemoPrefix || env.DEMO_MODE() ? "[DEMO] " : "";

  // 本番・訓練（本番CH投稿時）は環境変数 SLACK_PRODUCTION_MENTIONS を優先（here / channel / Uxxxx）
  const rawMentions = connectivityTest
    ? params.mentions
    : (mode === "production" || mode === "drill") && env.SLACK_PRODUCTION_MENTIONS()
      ? env
          .SLACK_PRODUCTION_MENTIONS()!
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => {
            const lower = s.toLowerCase();
            if (lower === "here") return "<!here>";
            if (lower === "channel") return "<!channel>";
            return `<@${s}>`; // ユーザーIDはそのまま（U01234 形式）
          })
      : params.mentions;

  const mentionText = rawMentions && rawMentions.length > 0 ? rawMentions.join(" ") + "\n" : "";

  const text = connectivityTest
    ? `${mentionText}${params.text}`
    : `${modePrefix}${demoPrefix}\n${mentionText}${params.text}`;

  const botToken = env.SLACK_BOT_TOKEN();
  const dmUserId = env.SLACK_DM_USER_ID();
  const productionChannelId = env.SLACK_PRODUCTION_CHANNEL_ID();

  const postToProductionChannel =
    botToken &&
    productionChannelId &&
    (mode === "production" || mode === "drill");

  // 本番・訓練: Bot でチャンネル投稿（ボタンが同じアプリに届くためクリックで反応する）
  if (postToProductionChannel) {
    console.log("Sending Slack to channel:", productionChannelId);
    const postBody: Record<string, unknown> = {
      channel: productionChannelId,
      text,
    };
    if (includeInteractiveBlocks) {
      postBody.blocks = buildMessageBlocks(text);
    }
    const post = await slackApi<{ ok: boolean; error?: string; ts?: string }>(botToken, "chat.postMessage", postBody);
    if (!post.ok) {
      throw new Error(`Slack chat.postMessage failed: ${post.error ?? "unknown"}`);
    }
    return post.ts;
  }

  // DM 用（チャンネル未設定のデモ・試験など）
  if (botToken && dmUserId) {
    console.log("Sending Slack DM to:", dmUserId);
    return await postToDm(botToken, dmUserId, text, includeInteractiveBlocks);
  }

  // Webhook フォールバック（ボタンは表示されるが、別アプリの Webhook だとクリックが届かない場合あり）
  const webhookUrl =
    (mode === "production" || mode === "drill") && env.SLACK_PRODUCTION_WEBHOOK_URL()
      ? env.SLACK_PRODUCTION_WEBHOOK_URL()!
      : env.SLACK_WEBHOOK_URL();
  if (webhookUrl) {
    console.log("Sending Slack Webhook to:", webhookUrl.substring(0, 20) + "...");
    await postToWebhook(webhookUrl, text, includeInteractiveBlocks);
    return undefined;
  }

  throw new Error(
    "No Slack destination configured. For production with buttons: set SLACK_BOT_TOKEN and SLACK_PRODUCTION_CHANNEL_ID. Or use SLACK_WEBHOOK_URL / SLACK_PRODUCTION_WEBHOOK_URL.",
  );
}

