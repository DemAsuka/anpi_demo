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

async function postToWebhook(webhookUrl: string, text: string) {
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

async function postToDm(
  token: string,
  userId: string,
  text: string,
  isDrill?: boolean,
) {
  // Open (or fetch) a DM channel id with the user
  const open = await slackApi<{ ok: boolean; channel?: { id: string }; error?: string }>(
    token,
    "conversations.open",
    { users: userId },
  );
  if (!open.ok || !open.channel?.id) {
    throw new Error(`Slack conversations.open failed: ${open.error ?? "unknown"}`);
  }

  // Use Block Kit for interactive buttons
  const blocks = [
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
          text: {
            type: "plain_text",
            text: "✅ 無事です",
            emoji: true,
          },
          style: "primary",
          value: "safe",
          action_id: "report_safe",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "⚠️ 助けが必要",
            emoji: true,
          },
          style: "danger",
          value: "help",
          action_id: "report_help",
        },
      ],
    },
  ];

  const post = await slackApi<{ ok: boolean; error?: string }>(token, "chat.postMessage", {
    channel: open.channel.id,
    text, // Fallback text
    blocks,
  });
  if (!post.ok) {
    throw new Error(`Slack chat.postMessage failed: ${post.error ?? "unknown"}`);
  }
}

export async function sendNotification(params: {
  text: string;
  forceDemoPrefix?: boolean;
  isDrill?: boolean;
}) {
  const drillPrefix = params.isDrill ? "【訓練】" : "";
  const demoPrefix = params.forceDemoPrefix || env.DEMO_MODE() ? "[DEMO] " : "";
  const text = `${drillPrefix}${demoPrefix}${params.text}`;

  const botToken = env.SLACK_BOT_TOKEN();
  const dmUserId = env.SLACK_DM_USER_ID();
  if (botToken && dmUserId) {
    await postToDm(botToken, dmUserId, text, params.isDrill);
    return;
  }

  const webhookUrl = env.SLACK_WEBHOOK_URL();
  if (webhookUrl) {
    await postToWebhook(webhookUrl, text);
    return;
  }

  throw new Error(
    "No Slack destination configured. Set SLACK_BOT_TOKEN+SLACK_DM_USER_ID or SLACK_WEBHOOK_URL.",
  );
}

