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
    <section className="bg-white rounded-[2rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-8">
      <div>
        <h2 className="text-xl font-black text-gray-900">Execute Training</h2>
        <p className="text-sm font-medium text-gray-400 mt-1">シミュレーションを開始し、通知システムをテストします。</p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 ml-1 text-xs">Scenario</label>
            <select
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 ml-1 text-xs">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 placeholder:text-gray-300 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              placeholder="Training Title"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 ml-1 text-xs">Custom Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-2xl px-4 py-4 text-sm font-bold text-gray-700 placeholder:text-gray-300 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none min-h-[100px]"
            placeholder="従業員へのメッセージを入力..."
          />
        </div>

        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-[0_10px_20px_-5px_rgba(37,99,235,0.3)] hover:shadow-[0_15px_25px_-5px_rgba(37,99,235,0.4)] active:scale-[0.98] transition-all duration-200 disabled:bg-gray-200 disabled:shadow-none flex items-center justify-center gap-3"
        >
          {loading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-3 border-white/30 border-t-white"></span>
          ) : (
            "Dispatch Notification"
          )}
        </button>
      </div>
    </section>
  );
}

