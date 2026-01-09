import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { UserButton } from "@clerk/nextjs";
import { ViewToggle } from "./_components/ViewToggle";
import { PortalSidebar } from "./_components/PortalSidebar";

interface LayoutProps {
  children: ReactNode;
  params: { [key: string]: string | string[] | undefined };
}

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    redirect("/sign-in");
  }

  // 管理者チェック
  const supabase = createSupabaseServiceRoleClient();
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  const isAdmin = !!adminRow;
  
  // 管理者専用パスのアクセス制限
  const isUrlAdminPath = true; // パス判定が必要だが、layoutレベルでは一旦省略しPageレベルで制御か、またはここで。
  // ...省略

  const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col overflow-hidden">
      {/* 管理者用ビュー切替バー */}
      <Suspense fallback={<div className="h-10 bg-zinc-900 animate-pulse" />}>
        <ViewToggle isAdmin={isAdmin} />
      </Suspense>

      <header className="border-b bg-white/80 backdrop-blur-md z-20 shrink-0">
        <div className="mx-auto flex items-center justify-between p-4 px-6">
          <div className="flex items-center gap-4">
             <div className="font-black tracking-tight text-xl text-zinc-900">CLT <span className="text-blue-600">Safety Connect</span></div>
             <div className="h-6 w-px bg-gray-200 hidden sm:block" />
             <div className="text-xs font-bold text-gray-400 hidden sm:block">
               {isAdmin ? "管理者権限あり" : "一般ユーザー"}
             </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs font-bold text-gray-300 hidden md:block">{primaryEmail}</div>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Suspense fallback={<div className="w-64 border-r bg-gray-50/50" />}>
          {/* SidebarはClient Component内でViewを判定する */}
          <PortalSidebarWrapper isAdmin={isAdmin} />
        </Suspense>
        
        <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-gray-50/20">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

// Client ComponentのSearchParamsを使うためにラップ
import { PortalSidebarWrapper } from "./_components/PortalSidebarWrapper";

