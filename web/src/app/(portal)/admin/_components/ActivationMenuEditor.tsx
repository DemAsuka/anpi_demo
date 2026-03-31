"use client";

import { useState } from "react";

type ActivationMenu = {
  id: string;
  menu_type: string;
  enabled: boolean;
  threshold: Record<string, any>;
  test_enabled: boolean;
  test_threshold: Record<string, any>;
  template: string | null;
};

type Props = {
  menus: ActivationMenu[];
  viewMode: "prod" | "test";
};

type ThresholdOption = {
  label: string;
  value: string;
  keywords?: string[];
  min_intensity?: string;
  min_grade?: string;
  min_flood_level?: string;
};

const THRESHOLD_CONFIG: Record<string, { title: string; icon: string; options: ThresholdOption[] }> = {
  shindo: {
    title: "地震",
    icon: "🏠",
    options: [
      { label: "震度 4 以上", value: "4", keywords: ["震度4", "震度４"], min_intensity: "4" },
      { label: "震度 5弱 以上 (推奨)", value: "5-", keywords: ["震度5弱", "震度５弱"], min_intensity: "5-" },
      { label: "震度 5強 以上", value: "5+", keywords: ["震度5強", "震度５強"], min_intensity: "5+" },
      { label: "震度 6弱 以上", value: "6-", keywords: ["震度6弱", "震度６弱"], min_intensity: "6-" },
    ],
  },
  tsunami: {
    title: "津波",
    icon: "🌊",
    options: [
      { label: "津波注意報 以上", value: "advisory", keywords: ["津波注意報"], min_grade: "advisory" },
      { label: "津波警報 以上", value: "warning", keywords: ["津波警報"], min_grade: "warning" },
      { label: "大津波警報 のみ", value: "major_warning", keywords: ["大津波警報"], min_grade: "major_warning" },
    ],
  },
  heavy_rain: {
    title: "豪雨",
    icon: "☔",
    options: [
      { label: "大雨警報 以上", value: "warning", keywords: ["大雨警報"] },
      { label: "特別警報 のみ", value: "special", keywords: ["特別警報"] },
    ],
  },
  river_flood: {
    title: "河川氾濫",
    icon: "🌊",
    options: [
      { label: "氾濫警戒情報 以上", value: "caution", keywords: ["氾濫警戒情報"], min_flood_level: "caution" },
      { label: "氾濫危険情報 以上", value: "danger", keywords: ["氾濫危険情報"], min_flood_level: "danger" },
      { label: "氾濫発生情報 のみ", value: "occurrence", keywords: ["氾濫発生情報"], min_flood_level: "occurrence" },
    ],
  },
  evacuation: {
    title: "避難情報",
    icon: "📢",
    options: [
      { label: "高齢者等避難 以上", value: "elderly", keywords: ["高齢者等避難"] },
      { label: "避難指示 以上", value: "instruction", keywords: ["避難指示"] },
      { label: "緊急安全確保 のみ", value: "emergency", keywords: ["緊急安全確保"] },
    ],
  },
  civil_protection: {
    title: "国民保護",
    icon: "🚀",
    options: [
      { label: "発表時すべて", value: "all", keywords: ["国民保護", "Jアラート"] },
    ],
  },
};

export function ActivationMenuEditor({ menus: initialMenus, viewMode }: Props) {
  const [menus, setMenus] = useState(initialMenus);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);

  const isTestView = viewMode === "test";

  const handleUpdateField = async (id: string, field: string, value: any) => {
    setLoadingId(id);
    try {
      const res = await fetch("/api/admin/activation-menus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          [field]: value,
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

      setMenus((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
      return true;
    } catch (err: any) {
      console.error(err);
      alert(err.message || "更新に失敗しました。");
      return false;
    } finally {
      setLoadingId(null);
    }
  };

  const handleToggleEnabled = async (id: string, currentEnabled: boolean, isTest: boolean) => {
    const field = isTest ? "test_enabled" : "enabled";
    await handleUpdateField(id, field, !currentEnabled);
  };

  const handleSelectThreshold = async (menuId: string, option: ThresholdOption) => {
    const isTest = isTestView;
    const field = isTest ? "test_threshold" : "threshold";
    
    const newThreshold: Record<string, any> = {};
    if (option.keywords) newThreshold.keywords = option.keywords;
    if (option.min_intensity) newThreshold.min_intensity = option.min_intensity;
    if (option.min_grade) newThreshold.min_grade = option.min_grade;
    if (option.min_flood_level) newThreshold.min_flood_level = option.min_flood_level;

    if (await handleUpdateField(menuId, field, newThreshold)) {
      setEditingMenuId(null);
    }
  };

  const getCurrentOption = (menu: ActivationMenu) => {
    const threshold = isTestView ? menu.test_threshold : menu.threshold;
    const config = THRESHOLD_CONFIG[menu.menu_type];
    if (!config) return null;

    // 簡易的なマッチングロジック
    return config.options.find(opt => {
      if (opt.min_intensity && threshold.min_intensity === opt.min_intensity) return true;
      if (opt.min_grade && threshold.min_grade === opt.min_grade) return true;
      if (opt.min_flood_level && threshold.min_flood_level === opt.min_flood_level) return true;
      if (opt.keywords && threshold.keywords && JSON.stringify(opt.keywords) === JSON.stringify(threshold.keywords)) return true;
      return false;
    }) || null;
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-8">
      <div className="flex-1 space-y-4">
        {menus.map((menu) => {
          const config = THRESHOLD_CONFIG[menu.menu_type];
          if (!config) return null;
          const currentOption = getCurrentOption(menu);
          const isEnabled = isTestView ? menu.test_enabled : menu.enabled;

          return (
            <div
              key={menu.id}
              className={`bg-white rounded-2xl p-4 flex items-center justify-between border border-gray-100 shadow-sm transition-all hover:shadow-md ${
                !isEnabled ? "opacity-60 bg-gray-50" : ""
              }`}
            >
              <div
                className="flex items-center space-x-4 cursor-pointer flex-1"
                onClick={() => isEnabled && setEditingMenuId(menu.id)}
              >
                <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-2xl">
                  {config.icon}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{config.title}</h3>
                  <p className="text-sm text-gray-500">
                    設定: <span className="font-medium text-gray-700">{currentOption?.label || "カスタム設定中"}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-[44px] mb-1">
                    <span className="text-[10px] font-bold tracking-tighter leading-none whitespace-nowrap">
                      <span className="text-gray-400">OFF</span>
                      <span className="text-gray-300 mx-1">|</span>
                      <span className="text-blue-600">ON</span>
                    </span>
                  </div>
                  <label className="relative inline-block w-11 h-6">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={isEnabled}
                      onChange={() => handleToggleEnabled(menu.id, isEnabled, isTestView)}
                      disabled={loadingId === menu.id}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <button
                  onClick={() => isEnabled && setEditingMenuId(menu.id)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* サイドバー: 設定の手順 */}
      <aside className="w-full md:w-72">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-8">
          <h4 className="font-bold text-gray-800 mb-4 flex items-center">
            <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">
              💡
            </span>
            設定の手順
          </h4>
          <ol className="text-sm text-gray-600 space-y-6 list-none">
            <li className="relative pl-8">
              <span className="absolute left-0 top-0 w-6 h-6 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">
                1
              </span>
              <p className="font-bold text-gray-800 mb-1">通知を有効にする</p>
              <p className="text-xs leading-relaxed">
                右側のスイッチを<strong>ON（青色）</strong>にしてください。
              </p>
            </li>
            <li className="relative pl-8">
              <span className="absolute left-0 top-0 w-6 h-6 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">
                2
              </span>
              <p className="font-bold text-gray-800 mb-1">条件を設定する</p>
              <p className="text-xs leading-relaxed">
                各項目をタップして通知レベルを選択し、「保存する」を押してください。
              </p>
            </li>
          </ol>
        </div>
      </aside>

      {/* モーダル (設定変更用) */}
      {editingMenuId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">
                  {THRESHOLD_CONFIG[menus.find((m) => m.id === editingMenuId)?.menu_type || "shindo"]?.title}の設定
                </h2>
                <button
                  onClick={() => setEditingMenuId(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-3">
                {THRESHOLD_CONFIG[menus.find((m) => m.id === editingMenuId)?.menu_type || "shindo"]?.options.map(
                  (opt) => {
                    const menu = menus.find((m) => m.id === editingMenuId);
                    const isSelected = menu && getCurrentOption(menu)?.value === opt.value;
                    return (
                      <div
                        key={opt.value}
                        className={`flex items-center justify-between p-4 border-2 rounded-2xl cursor-pointer transition-all ${
                          isSelected
                            ? "border-blue-600 bg-blue-50 shadow-sm"
                            : "border-gray-100 hover:border-gray-200"
                        }`}
                        onClick={() => handleSelectThreshold(editingMenuId, opt)}
                      >
                        <span className={`font-bold ${isSelected ? "text-blue-700" : "text-gray-700"}`}>
                          {opt.label}
                        </span>
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? "border-blue-600 bg-blue-600" : "border-gray-300"
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              <div className="mt-8">
                <button
                  onClick={() => setEditingMenuId(null)}
                  className="w-full py-4 bg-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
