import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const supabase = createSupabaseServiceRoleClient();
  
  // 管理者チェック
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!adminRow) return new NextResponse("Forbidden", { status: 403 });

    try {
      const body = await req.json();
      const { label, address, is_permanent, target_group } = body;

      // 表示順の計算 (51-69, 下一桁0を除く18個分)
      const { data: existing } = await supabase
        .from("system_locations")
        .select("sort_order")
        .gte("sort_order", 51)
        .lte("sort_order", 69);
      
      const usedOrders = (existing || []).map(e => e.sort_order);
      const availableOrders = [];
      for (let i = 51; i <= 69; i++) {
        if (i % 10 !== 0) availableOrders.push(i);
      }
      
      const nextOrder = availableOrders.find(o => !usedOrders.includes(o)) || 51;

      const { data, error } = await supabase
        .from("system_locations")
        .insert({
          label,
          city: address, 
          is_permanent: is_permanent ?? false,
          target_group: target_group ?? "all",
          sort_order: nextOrder
        })
        .select()
        .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("API Error:", error);
    return new NextResponse(error.message, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const supabase = createSupabaseServiceRoleClient();
  
  // 管理者チェック
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!adminRow) return new NextResponse("Forbidden", { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return new NextResponse("ID required", { status: 400 });

    const { error } = await supabase
      .from("system_locations")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return new NextResponse("Deleted", { status: 200 });
  } catch (error: any) {
    console.error("API Error:", error);
    return new NextResponse(error.message, { status: 500 });
  }
}

