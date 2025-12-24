"use client";

import { useState } from "react";

type Scenario = {
  id: string;
  name: string;
};

const SCENARIOS: Scenario[] = [
  { id: "earthquake", name: "震度（地震）" },
  { id: "tsunami", name: "津波" },
  { id: "heavy_rain", name: "豪雨" },
  { id: "flood", name: "河川氾濫" },
  { id: "civil_protection", name: "国民保護" },
];

export function DrillStartForm() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [title, setTitle] = useState("【定期】防災訓練（震度5弱）");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleStart = async () => {
    const confirm = window.confirm(
      `【訓練】を開始します。\n全従業員に通知が飛びますが、よろしいですか？`
    );
    if (!confirm) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/incidents/start-drill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menu_type: scenarioId,
          title,
          message,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to start drill");
      }

      alert("防災訓練を開始しました。");
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border bg-white p-6 shadow-sm h-full">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900">手動訓練の実行</h2>
        <p className="text-sm text-gray-500">災害をシミュレートして通知テストを行います。</p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            シナリオ選択
          </label>
          <select
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition"
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            訓練タイトル
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition"
            placeholder="例：【定期】防災訓練（震度5弱）"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            配信メッセージ
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition"
            rows={3}
            placeholder="従業員への指示を入力..."
          />
        </div>

        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 active:transform active:scale-[0.98] disabled:bg-gray-400 transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
              配信準備中...
            </>
          ) : (
            "訓練通知を配信する"
          )}
        </button>
      </div>
    </section>
  );
}


