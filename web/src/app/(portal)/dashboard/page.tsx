import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { AdminDashboardView } from "../_components/AdminDashboardView";
import { UserDashboardView } from "../_components/UserDashboardView";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; category?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/admin/sign-in");

  const { view, category } = await searchParams;

  // 管理者チェック
  const supabase = createSupabaseServiceRoleClient();
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  const isAdmin = !!adminRow;
  const currentView = isAdmin ? (view || "admin") : "user";

  if (currentView === "admin") {
    return <AdminDashboardView currentMode={category === "test" ? "test" : "prod"} />;
  }

  return <UserDashboardView userId={userId} />;
}

