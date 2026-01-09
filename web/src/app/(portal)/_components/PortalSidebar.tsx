"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";

type MenuItem = {
  label: string;
  href: string;
  icon: string;
  adminOnly?: boolean;
  categoryOnly?: "prod" | "test";
};

const MENU_ITEMS: MenuItem[] = [
  { label: "ホーム", href: "/dashboard", icon: "🏠" },
  { label: "安否報告", href: "/report", icon: "📣" },
  { label: "地点・通知設定", href: "/settings", icon: "⚙️" },
  { label: "利用マニュアル", href: "/guide", icon: "📖" },
  { label: "JMA発動ルール", href: "/admin/jma-rules", icon: "⚡", adminOnly: true },
  { label: "安否訓練 実行", href: "/admin/training", icon: "🚀", adminOnly: true, categoryOnly: "test" },
];

export function PortalSidebar({ isAdmin, currentView }: { isAdmin: boolean, currentView: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get("category") || "prod";

  // 管理者モード・運用カテゴリに基づいたフィルタリング
  const visibleItems = MENU_ITEMS.filter(item => {
    // ユーザーモードの場合、管理者専用アイテムは非表示
    if (currentView === "user" && item.adminOnly) return false;
    
    // 管理者モードの場合、カテゴリ指定があるアイテムをチェック
    if (currentView === "admin" && item.categoryOnly) {
      return item.categoryOnly === currentCategory;
    }
    
    return true;
  });

  const isTestMode = currentView === "admin" && currentCategory === "test";
  const accentColor = currentView === "user" ? "text-blue-600" : (isTestMode ? "text-amber-600" : "text-red-600");
  const activeBg = currentView === "user" ? "bg-blue-50" : (isTestMode ? "bg-amber-50" : "bg-red-50");
  const hoverBg = currentView === "user" ? "hover:bg-blue-50" : (isTestMode ? "hover:bg-amber-50" : "hover:bg-red-50");

  return (
    <aside className="w-64 border-r bg-white flex flex-col h-full shrink-0">
      <nav className="flex-1 p-4 space-y-2">
        <div className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
          {currentView === "user" ? "Standard User" : (isTestMode ? "Admin: Training" : "Admin: Production")}
        </div>
        <div className="space-y-1">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href;
            const params = new URLSearchParams(searchParams.toString());
            const href = `${item.href}?${params.toString()}`;

            return (
              <Link
                key={item.href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? `${accentColor} ${activeBg}` 
                    : `text-gray-500 hover:text-gray-900 ${hoverBg}`
                }`}
              >
                <span className={`text-lg transition-transform group-hover:scale-110 ${isActive ? "" : "grayscale group-hover:grayscale-0"}`}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      
      <div className="p-6 border-t bg-gray-50/50">
        <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 px-4">
          CLT Safety Connect v0.4
        </p>
      </div>
    </aside>
  );
}
