import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { sendNotification } from "@/lib/slack/notify";
import { z } from "zod";

export const runtime = "nodejs";

const BodySchema = z.object({
  menu_type: z.string().min(1),
  title: z.string().min(1),
  message: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = (await request.json().catch(() => null)) as unknown;
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  
  // 1. Check if the user is an admin in Supabase
  const { data: adminUser, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .single();

  if (adminError || !adminUser) {
    return NextResponse.json({ error: "Forbidden: Not an admin" }, { status: 403 });
  }

  // 2. Insert the incident as a drill
  const { data: incident, error: incidentError } = await supabase
    .from("incidents")
    .insert({
      menu_type: parsed.data.menu_type,
      title: parsed.data.title,
      is_drill: true,
      mode: "drill",
      status: "active",
      slack_channel: "dm", // Defaulting to DM for this MVP
    })
    .select()
    .single();

  if (incidentError) {
    return NextResponse.json({ error: incidentError.message }, { status: 500 });
  }

  // 3. Log the action
  await supabase.from("audit_logs").insert({
    actor: userId,
    action: "start_drill",
    target_type: "incident",
    target_id: incident.id,
    metadata: { 
      menu_type: parsed.data.menu_type, 
      title: parsed.data.title,
      is_drill: true 
    },
  });

  // 4. Send Slack notification
  try {
    await sendNotification({
      mode: "drill",
      text: [
        `安否確認訓練を開始します。`,
        `種別: ${parsed.data.menu_type}`,
        `タイトル: ${parsed.data.title}`,
        parsed.data.message ? `メッセージ: ${parsed.data.message}` : "",
        "",
        "下記のボタンから回答してください。",
      ].filter(Boolean).join("\n"),
    });
  } catch (slackError) {
    console.error("Failed to send slack notification:", slackError);
    // Continue even if slack fails, but maybe log it.
  }

  return NextResponse.json({ ok: true, incident });
}


