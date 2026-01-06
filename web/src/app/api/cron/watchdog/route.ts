import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { sendNotification } from "@/lib/slack/notify";

export const runtime = "nodejs";

const ALERT_THRESHOLD_MINUTES = 15; // 15分以上データが途切れたらアラート

export async function GET(request: NextRequest) {
  const token = request.headers.get("x-cron-secret") ?? request.nextUrl.searchParams.get("token") ?? "";
  if (token !== env.CRON_SECRET()) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();

  // 最新のステータスを取得
  const { data: status, error } = await supabase
    .from("system_status")
    .select("*")
    .eq("id", "jma_receiver")
    .single();

  if (error || !status) {
    return NextResponse.json({ ok: false, error: "status_not_found" }, { status: 500 });
  }

  const lastSuccess = new Date(status.last_success_at);
  const diffMinutes = Math.floor((Date.now() - lastSuccess.getTime()) / 1000 / 60);

  // 15分以上経過しており、かつステータスがまだ「ok」の場合のみアラート
  if (diffMinutes >= ALERT_THRESHOLD_MINUTES && status.status === "ok") {
    await sendNotification({
      text: `【システム警告】気象データの受信が一定時間停止しています（Ping No Reply）。\n最後の受信成功: ${lastSuccess.toLocaleString('ja-JP')} (${diffMinutes}分前)`,
      mode: "production",
    });

    // ステータスをエラーに更新
    await supabase
      .from("system_status")
      .update({ status: "error", updated_at: new Date().toISOString() })
      .eq("id", "jma_receiver");
    
    return NextResponse.json({ ok: true, alert_sent: true });
  }

  return NextResponse.json({ ok: true, status: status.status, last_diff_min: diffMinutes });
}

