import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = (await request.json().catch(() => null)) as any;
    if (!json || !json.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = createSupabaseServiceRoleClient();
    
    // Admin Check
    const { data: adminUser, error: adminCheckError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (adminCheckError) {
      return NextResponse.json({ error: `Admin check failed: ${adminCheckError.message}` }, { status: 500 });
    }

    if (!adminUser) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };
    if (json.enabled !== undefined) updatePayload.enabled = !!json.enabled;
    if (json.threshold) updatePayload.threshold = json.threshold;
    if (json.test_enabled !== undefined) updatePayload.test_enabled = !!json.test_enabled;
    if (json.test_threshold) updatePayload.test_threshold = json.test_threshold;

    const { data, error } = await supabase
      .from("activation_menus")
      .update(updatePayload)
      .eq("id", json.id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: `Update failed: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
