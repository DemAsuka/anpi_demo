import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { sendNotification } from "@/lib/slack/notify";

export const runtime = "nodejs";

const BodySchema = z.object({
  incident_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
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
    .update({ status: "closed", ended_at: new Date().toISOString() })
    .eq("id", parsed.data.incident_id)
    .select("id,menu_type,title,status,ended_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "db_error", details: error.message },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  await supabase.from("audit_logs").insert({
    actor: "demo_api",
    action: "incident_close",
    target_type: "incident",
    target_id: data.id,
    metadata: { menu_type: data.menu_type, title: data.title },
  });

  await sendNotification({
    forceDemoPrefix: true,
    text: [
      "安否確認を終了します（訓練です）。",
      `incident_id: ${data.id}`,
      `種別: ${data.menu_type}`,
      `タイトル: ${data.title ?? "-"}`,
    ].join("\n"),
  });

  return NextResponse.json({ ok: true, incident: data });
}

