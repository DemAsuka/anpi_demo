import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { sendNotification } from "@/lib/slack/notify";

export const runtime = "nodejs";

/**
 * 本番と同じ設定（SLACK_PRODUCTION_WEBHOOK_URL + SLACK_PRODUCTION_MENTIONS）で
 * テスト通知を1通送る。認証は CRON_SECRET（クエリ token またはヘッダー x-cron-secret）。
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
      text: [
        "これはテスト通知です。",
        "本番用のSlack設定（通知先・メンション）が正しく動作しています。",
        "",
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
