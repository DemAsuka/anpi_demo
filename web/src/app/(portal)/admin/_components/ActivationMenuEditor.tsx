"use client";

import { useState } from "react";

type ActivationMenu = {
  id: string;
  menu_type: string;
  enabled: boolean;
  threshold: Record<string, any>;
  test_enabled: boolean;
  test_threshold: Record<string, any>;
};

type Props = {
  menus: ActivationMenu[];
  viewMode: "prod" | "test";
};

export function ActivationMenuEditor({ menus: initialMenus, viewMode }: Props) {
  const [menus, setMenus] = useState(initialMenus);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const isTestView = viewMode === "test";

  const handleUpdateKeywords = async (id: string, keywordsStr: string, isTest: boolean) => {
    const keywords = keywordsStr.split(",").map(k => k.trim()).filter(Boolean);
    const field = isTest ? "test_threshold" : "threshold";
    
    setLoadingId(id);
    try {
      const res = await fetch("/api/admin/activation-menus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          [field]: { keywords },
        }),
      });

      if (!res.ok) {
        let errorMessage = `Update failed with status ${res.status}`;
        try {
          const errorData = await res.json();
          if (errorData && typeof errorData.error === "string") {
            errorMessage = errorData.error;
          } else if (errorData && typeof errorData.error === "object") {
            errorMessage = JSON.stringify(errorData.error);
          }
        } catch (e) {
          // Ignore JSON parse error
        }
        throw new Error(errorMessage);
      }

      setMenus(prev => prev.map(m => m.id === id ? { ...m, [field]: { keywords } } : m));
      alert(`${isTest ? "試験" : "本番"}用キーワードを更新しました。`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "更新に失敗しました。");
    } finally {
      setLoadingId(null);
    }
  };

  const handleToggleEnabled = async (id: string, currentEnabled: boolean, isTest: boolean) => {
    const field = isTest ? "test_enabled" : "enabled";
    setLoadingId(id);
    try {
      const res = await fetch("/api/admin/activation-menus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          [field]: !currentEnabled,
        }),
      });

      if (!res.ok) {
        let errorMessage = `Update failed with status ${res.status}`;
        try {
          const errorData = await res.json();
          if (errorData && typeof errorData.error === "string") {
            errorMessage = errorData.error;
          }
        } catch (e) {}
        throw new Error(errorMessage);
      }

      setMenus(prev => prev.map(m => m.id === id ? { ...m, [field]: !currentEnabled } : m));
    } catch (err: any) {
      console.error(err);
      alert(err.message || "更新に失敗しました。");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <section className="space-y-6">
      <div className="space-y-12">
        {menus.map((menu) => (
          <div key={menu.id} className="space-y-6 bg-white rounded-[2rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">
                {menu.menu_type.replace("_", " ")}
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-8">
              {!isTestView ? (
                /* 本番用設定のみ表示 */
                <div className="p-6 bg-red-50/30 rounded-[1.5rem] border border-red-100/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${menu.enabled ? "bg-red-500" : "bg-gray-300"}`} />
                      <span className="text-xs font-black text-red-600 uppercase tracking-wider">Production Activation</span>
                    </div>
                    <button
                      onClick={() => handleToggleEnabled(menu.id, menu.enabled, false)}
                      disabled={loadingId === menu.id}
                      className={`px-3 py-1 text-[9px] font-black uppercase rounded-full transition-all ${
                        menu.enabled 
                          ? "bg-red-100 text-red-600 hover:bg-red-200" 
                          : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                      }`}
                    >
                      {menu.enabled ? "Active" : "Inactive"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Current Production Keywords</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-white/50 rounded-xl min-h-[42px] border border-red-100/50">
                      {menu.threshold?.keywords?.map((k: string, i: number) => (
                        <span key={i} className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-md">{k}</span>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        id={`prod-keywords-${menu.id}`}
                        placeholder="本番用キーワードを入力..."
                        className="flex-1 bg-white border border-red-100 rounded-xl px-4 py-2 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500/10"
                      />
                      <button
                        onClick={() => handleUpdateKeywords(menu.id, (document.getElementById(`prod-keywords-${menu.id}`) as HTMLInputElement).value, false)}
                        className="bg-red-600 text-white text-[9px] font-black uppercase px-4 py-2 rounded-xl hover:bg-red-700"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* 試験用設定のみ表示 */
                <div className="p-6 bg-blue-50/30 rounded-[1.5rem] border border-blue-100/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${menu.test_enabled ? "bg-blue-500" : "bg-gray-300"}`} />
                      <span className="text-xs font-black text-blue-600 uppercase tracking-wider">Test / Demo Activation</span>
                    </div>
                    <button
                      onClick={() => handleToggleEnabled(menu.id, menu.test_enabled, true)}
                      disabled={loadingId === menu.id}
                      className={`px-3 py-1 text-[9px] font-black uppercase rounded-full transition-all ${
                        menu.test_enabled 
                          ? "bg-blue-100 text-blue-600 hover:bg-blue-200" 
                          : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                      }`}
                    >
                      {menu.test_enabled ? "Active" : "Inactive"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Current Test Keywords</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-white/50 rounded-xl min-h-[42px] border border-blue-100/50">
                      {menu.test_threshold?.keywords?.map((k: string, i: number) => (
                        <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md">{k}</span>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        id={`test-keywords-${menu.id}`}
                        placeholder="試験用キーワードを入力..."
                        className="flex-1 bg-white border border-blue-100 rounded-xl px-4 py-2 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/10"
                      />
                      <button
                        onClick={() => handleUpdateKeywords(menu.id, (document.getElementById(`test-keywords-${menu.id}`) as HTMLInputElement).value, true)}
                        className="bg-blue-600 text-white text-[9px] font-black uppercase px-4 py-2 rounded-xl hover:bg-blue-700"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

