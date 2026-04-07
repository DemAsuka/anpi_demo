import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { sendNotification } from "@/lib/slack/notify";

export const runtime = "nodejs";

/**
 * 疎通確認用: 本番チャンネル（または DM / Webhook フォールバック）へプレーンテキストを1通送る。
 * 安否ボタン・【安否確認】プレフィックス・SLACK_PRODUCTION_MENTIONS は付けない。
 * 認証は CRON_SECRET（クエリ token またはヘッダー x-cron-secret）。
 */
export async function GET(request: NextRequest) {
  const token =
    request.headers.get("x-cron-secret") ?? request.nextUrl.searchParams.get("token") ?? "";
  if (token !== env.CRON_SECRET()) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    await sendNotification({
      mode: "production",
      connectivityTest: true,
      text: [
        "通知確認用のテスト通知です。",
        "送信時刻: " + new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
      ].join("\n"),
    });
    return NextResponse.json({ ok: true, message: "Test notification sent." });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Slack test notification failed:", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
