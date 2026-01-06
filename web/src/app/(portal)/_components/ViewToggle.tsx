"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export function ViewToggle({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const currentView = isAdmin ? (searchParams.get("view") || "admin") : "user";
  const currentCategory = searchParams.get("category") || "prod";

  if (!isAdmin) return null;

  const handleToggleView = (view: "admin" | "user") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleToggleCategory = (category: "prod" | "test") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", category);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col border-b border-zinc-800">
      {/* 1段目: メインビュー切替 */}
      <div className="bg-zinc-950 text-white px-4 py-2 flex items-center justify-between text-xs font-bold tracking-wider">
        <div className="flex items-center gap-4">
          <span className="text-zinc-500 uppercase">View:</span>
          <div className="flex bg-white/5 rounded-lg p-1 gap-1">
            <button
              onClick={() => handleToggleView("admin")}
              className={`px-4 py-1.5 rounded-md transition-all flex items-center gap-2 ${
                currentView === "admin" 
                  ? "bg-zinc-100 text-black shadow-lg" 
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              🛡️ 管理者モード
            </button>
            <button
              onClick={() => handleToggleView("user")}
              className={`px-4 py-1.5 rounded-md transition-all flex items-center gap-2 ${
                currentView === "user" 
                  ? "bg-blue-600 text-white shadow-lg" 
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              👤 ユーザーモード
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
            currentView === "admin" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"
          }`}>
            {currentView === "admin" ? "Admin Privileges Active" : "Standard User View"}
          </span>
        </div>
      </div>

      {/* 2段目: 管理者モード時のみ表示される運用カテゴリ切替 */}
      {currentView === "admin" && (
        <div className={`px-4 py-2 flex items-center gap-6 text-xs font-bold transition-colors duration-500 ${
          currentCategory === "prod" ? "bg-red-950/20" : "bg-amber-950/20"
        }`}>
          <span className="text-zinc-500 uppercase tracking-widest text-[10px]">Operation Category:</span>
          <div className="flex gap-2">
            <button
              onClick={() => handleToggleCategory("prod")}
              className={`px-6 py-1.5 rounded-full border-2 transition-all ${
                currentCategory === "prod"
                  ? "border-red-600 bg-red-600 text-white shadow-md"
                  : "border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-600"
              }`}
            >
              🚨 本番運用モード
            </button>
            <button
              onClick={() => handleToggleCategory("test")}
              className={`px-6 py-1.5 rounded-full border-2 transition-all ${
                currentCategory === "test"
                  ? "border-amber-600 bg-amber-600 text-white shadow-md"
                  : "border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-600"
              }`}
            >
              🧪 訓練・テストモード
            </button>
          </div>
          <div className="ml-auto text-[10px] font-medium text-gray-400 italic">
            ※各メニューの表示内容や操作対象がこのカテゴリに連動します
          </div>
        </div>
      )}
    </div>
  );
}

