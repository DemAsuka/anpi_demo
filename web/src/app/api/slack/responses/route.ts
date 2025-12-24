import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

type SlackWorkflowPayload = {
  incident_id?: string;
  slack_user_id?: string;
  status?: string;
  comment?: string;
  raw?: unknown;
};

async function readBody(request: NextRequest): Promise<SlackWorkflowPayload> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await request.json()) as unknown;
    if (typeof json === "object" && json !== null) {
      return { raw: json, ...(json as Record<string, unknown>) } as SlackWorkflowPayload;
    }
    return { raw: json };
  }

  // Slack Workflow Builder "Webhook" step may send form-encoded
  const text = await request.text();
  try {
    const params = new URLSearchParams(text);
    const obj: Record<string, string> = {};
    params.forEach((v, k) => {
      obj[k] = v;
    });
    return { raw: obj, ...(obj as unknown as SlackWorkflowPayload) };
  } catch {
    return { raw: text };
  }
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  // 1. Handle Slack Interactive Components (Buttons)
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    const payloadJson = formData.get("payload");

    if (payloadJson && typeof payloadJson === "string") {
      const payload = JSON.parse(payloadJson);
      const action = payload.actions?.[0];
      const slack_user_id = payload.user?.id;
      const status = action?.value; // "safe" or "help"

      if (status && slack_user_id) {
        const supabase = createSupabaseServiceRoleClient();
        
        // Find the latest active incident to link this response
        const { data: latestIncident } = await supabase
          .from("incidents")
          .select("id")
          .eq("status", "active")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const incident_id = latestIncident?.id ?? null;

        // Use upsert to overwrite existing response from the same user for the same incident
        const { error } = await supabase.from("responses").upsert({
          incident_id,
          slack_user_id,
          status,
          comment: `Answered via Slack Button: ${action.text?.text ?? status}`,
          raw_payload: payload,
          created_at: new Date().toISOString(),
        }, {
          onConflict: "incident_id,slack_user_id",
        });

        if (error) {
          console.error("DB Error saving Slack response:", error);
          return new Response("Database error", { status: 500 });
        }

        // Return a simple confirmation message that Slack will show to the user
        return new Response(`回答を受け付けました: ${action.text?.text ?? status}`);
      }
    }
  }

  // 2. Handle direct API calls / Workflows (Existing logic)
  const shared =
    request.headers.get("x-anpi-secret") ??
    request.nextUrl.searchParams.get("secret") ??
    "";
  if (shared !== env.SLACK_WORKFLOW_SHARED_SECRET()) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const payload = await readBody(request);

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("responses").insert({
    incident_id: payload.incident_id ?? null,
    slack_user_id: payload.slack_user_id ?? null,
    status: payload.status ?? null,
    comment: payload.comment ?? null,
    raw_payload: payload.raw ?? null,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "db_error", details: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

