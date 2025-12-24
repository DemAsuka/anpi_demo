import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { UserButton } from "@clerk/nextjs";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    redirect("/admin/sign-in");
  }

  // Admin check using Service Role (bypassing RLS for simplicity in demo)
  // In production, you would use Clerk JWT + Supabase RLS.
  const supabase = createSupabaseServiceRoleClient();
  const { data: adminRow, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !adminRow) {
    // If you just signed in and aren't in the table yet, 
    // you'll need to be added manually to Supabase.
    redirect("/admin/forbidden");
  }

  const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;

  return (
    <div className="min-h-dvh bg-white text-gray-900">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <div className="font-semibold">安否確認ツール（管理）</div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">{primaryEmail}</div>
            <UserButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl p-4">{children}</div>
    </div>
  );
}
