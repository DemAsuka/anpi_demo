import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { sendNotification } from "@/lib/slack/notify";

export const runtime = "nodejs";

const BodySchema = z.object({
  menu_type: z.string().min(1),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000).optional(),
});

export async function POST(request: NextRequest) {
  // Demo API is always secret-guarded.
  const secret =
    request.headers.get("x-demo-secret") ??
    request.nextUrl.searchParams.get("secret") ??
    "";
  const expected = env.DEMO_SECRET();
  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const json = (await request.json().catch(() => null)) as unknown;
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("incidents")
    .insert({
      status: "active",
      menu_type: parsed.data.menu_type,
      title: parsed.data.title,
      slack_channel: "dm",
    })
    .select("id,menu_type,title,started_at")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "db_error", details: error.message },
      { status: 500 },
    );
  }

  await supabase.from("audit_logs").insert({
    actor: "demo_api",
    action: "incident_start",
    target_type: "incident",
    target_id: data.id,
    metadata: { menu_type: data.menu_type, title: data.title },
  });

  await sendNotification({
    forceDemoPrefix: true,
    text: [
      "安否確認を開始します（訓練です）。",
      `incident_id: ${data.id}`,
      `種別: ${data.menu_type}`,
      `タイトル: ${data.title}`,
      parsed.data.message ? `メッセージ: ${parsed.data.message}` : "",
      "",
      "注意: 住所/電話などの個人情報（PII）は書かないでください。",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return NextResponse.json({ ok: true, incident: data });
}

