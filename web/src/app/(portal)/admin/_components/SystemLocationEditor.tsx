"use client";

import { useState, useMemo } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import locationMaster from "@/lib/jma/location-master.json";

type SystemLocation = {
  id: string;
  label: string;
  prefecture: string;
  city: string;
  jma_code?: string;
  jma_name?: string;
  is_permanent: boolean;
  valid_until: string | null;
};

export function SystemLocationEditor({ initialLocations }: { initialLocations: SystemLocation[] }) {
  const [locations, setLocations] = useState<SystemLocation[]>(initialLocations);
  const [loading, setLoading] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  const handleUpdate = async (id: string, updates: Partial<SystemLocation>) => {
    setLoading(id);
    const { data, error } = await supabase
      .from("system_locations")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    if (!error && data) {
      setLocations(locations.map(l => l.id === id ? data : l));
    }
    setLoading(null);
  };

  const handleAdd = async () => {
    setLoading("new");
    const { data, error } = await supabase
      .from("system_locations")
      .insert({
        label: "新規地点",
        prefecture: "未設定",
        city: "未設定",
        jma_code: "",
        jma_name: "",
        is_permanent: false
      })
      .select()
      .single();
    
    if (!error && data) {
      setLocations([...locations, data]);
    }
    setLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("この地点を削除しますか？")) return;
    setLoading(id);
    const { error } = await supabase.from("system_locations").delete().eq("id", id);
    if (!error) {
      setLocations(locations.filter(l => l.id !== id));
    }
    setLoading(null);
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6">
        {locations.map((loc) => (
          <div key={loc.id} className="bg-white rounded-[2rem] p-8 shadow-sm border-2 border-transparent hover:border-blue-100 transition-all space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                  loc.is_permanent ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                }`}>
                  {loc.is_permanent ? "常設（オフィス）" : "期間限定（出張先等）"}
                </span>
                <input
                  type="text"
                  value={loc.label}
                  onChange={(e) => handleUpdate(loc.id, { label: e.target.value })}
                  className="text-lg font-black text-gray-900 bg-transparent border-b border-dashed border-gray-200 focus:border-blue-500 outline-none"
                />
              </div>
              <button
                onClick={() => handleDelete(loc.id)}
                className="text-gray-300 hover:text-red-500 transition-colors"
              >
                🗑️ 削除
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider">都道府県</label>
                <select
                  value={loc.prefecture}
                  onChange={(e) => handleUpdate(loc.id, { prefecture: e.target.value, city: "未選択", jma_code: "", jma_name: "" })}
                  className="w-full bg-gray-50 rounded-xl px-4 py-3 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="未設定">選択してください</option>
                  {locationMaster.map(p => (
                    <option key={p.pref} value={p.pref}>{p.pref}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider">市区町村</label>
                <select
                  value={loc.jma_code || ""}
                  onChange={(e) => {
                    const prefData = locationMaster.find(p => p.pref === loc.prefecture);
                    const cityData = prefData?.cities.find(c => c.code === e.target.value);
                    if (cityData) {
                      handleUpdate(loc.id, { 
                        city: cityData.name, 
                        jma_code: cityData.code, 
                        jma_name: cityData.name 
                      });
                    }
                  }}
                  className="w-full bg-gray-50 rounded-xl px-4 py-3 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                  disabled={loc.prefecture === "未設定"}
                >
                  <option value="">市区町村を選択してください</option>
                  {locationMaster.find(p => p.pref === loc.prefecture)?.cities.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {loc.jma_name && (
              <div className="bg-blue-50 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-xl">📡</span>
                <div>
                  <div className="text-[10px] font-black text-blue-400 uppercase tracking-wider">該当JMA判定地点</div>
                  <div className="text-sm font-black text-blue-600">{loc.jma_name} ({loc.jma_code})</div>
                  <div className="text-[10px] text-blue-400 mt-1">※この地点名を含む地震情報が発表された際に通知が送信されます。</div>
                </div>
              </div>
            )}

            {!loc.is_permanent && (
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider">有効期限（任意）</label>
                <input
                  type="date"
                  value={loc.valid_until ? loc.valid_until.split('T')[0] : ""}
                  onChange={(e) => handleUpdate(loc.id, { valid_until: e.target.value || null })}
                  className="w-full bg-gray-50 rounded-xl px-4 py-3 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            )}
          </div>
        ))}

        <button
          onClick={handleAdd}
          disabled={!!loading}
          className="border-2 border-dashed border-gray-200 rounded-[2rem] p-8 text-gray-400 font-black hover:border-blue-200 hover:text-blue-500 transition-all group"
        >
          <span className="text-xl mr-2 group-hover:scale-125 inline-block transition-transform">+</span>
          新しい勤務地・出張先を追加
        </button>
      </div>
    </div>
  );
}

