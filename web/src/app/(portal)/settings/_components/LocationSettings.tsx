"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import locationMaster from "@/lib/jma/location-master.json";

type Location = {
  id: string;
  location_type: string;
  display_name: string;
  prefecture: string;
  city: string;
  jma_code?: string;
  jma_name?: string;
  sort_order: number;
};

type SystemLocation = {
  id: string;
  label: string;
  prefecture: string;
  city: string;
  jma_code?: string;
  jma_name?: string;
  is_permanent: boolean;
  target_group: string;
  sort_order: number;
};

const LOCATION_TYPES = [
  { value: "parents", label: "実家" },
  { value: "other", label: "その他" },
];

export function LocationSettings({ 
  initialLocations,
  systemLocations,
  userId,
  isEditingAllowed
}: { 
  initialLocations: Location[],
  systemLocations: SystemLocation[],
  userId: string,
  isEditingAllowed: boolean
}) {
  const [locations, setLocations] = useState<Location[]>(initialLocations);
  const [sysLocations, setSysLocations] = useState<SystemLocation[]>(systemLocations);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingSys, setIsAddingSys] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [newLoc, setNewLoc] = useState({
    location_type: "parents",
    display_name: "",
    prefecture: "未設定",
    city: "",
    jma_code: "",
    jma_name: ""
  });

  const [newSysLoc, setNewSysLoc] = useState({
    label: "",
    prefecture: "未設定",
    city: "",
    jma_code: "",
    jma_name: "",
    target_group: "all",
    is_permanent: false
  });

  const supabase = createSupabaseBrowserClient();

  const handleAdd = async () => {
    if (!newLoc.display_name || !newLoc.jma_code) {
      alert("すべての項目を選択してください。");
      return;
    }
    setLoading(true);

    const usedOrders = locations.map(l => l.sort_order);
    const nextOrder = usedOrders.length > 0 ? Math.max(...usedOrders, 70) + 1 : 71;

    const { data, error } = await supabase
      .from("user_locations")
      .insert({
        user_id: userId,
        location_type: newLoc.location_type,
        display_name: newLoc.display_name,
        prefecture: newLoc.prefecture,
        city: newLoc.jma_name,
        jma_code: newLoc.jma_code,
        jma_name: newLoc.jma_name,
        sort_order: nextOrder
      })
      .select()
      .single();

    if (!error && data) {
      setLocations([...locations, data]);
      setIsAdding(false);
      setNewLoc({ location_type: "parents", display_name: "", prefecture: "未設定", city: "", jma_code: "", jma_name: "" });
    } else {
      console.error("Supabase error:", error);
      alert("個人の地点登録に失敗しました。");
    }
    setLoading(false);
  };

  const handleAddSys = async () => {
    if (!newSysLoc.label || !newSysLoc.jma_code) {
      alert("ラベルと地点を選択してください。");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/admin/system-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newSysLoc.label,
          prefecture: newSysLoc.prefecture,
          city: newSysLoc.jma_name,
          jma_code: newSysLoc.jma_code,
          jma_name: newSysLoc.jma_name,
          target_group: newSysLoc.target_group,
          is_permanent: newSysLoc.is_permanent
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "保存に失敗しました。");
      }

      const data = await res.json();
      setSysLocations([...sysLocations, data]);
      setIsAddingSys(false);
      setNewSysLoc({ label: "", prefecture: "未設定", city: "", jma_code: "", jma_name: "", is_permanent: false, target_group: "all" });
    } catch (err: any) {
      console.error("API error:", err);
      alert(err.message || "予期せぬエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    const { error } = await supabase
      .from("user_locations")
      .delete()
      .eq("id", id);

    if (!error) {
      setLocations(locations.filter(l => l.id !== id));
    }
    setLoading(false);
  };

  const handleDeleteSys = async (id: string) => {
    if (!window.confirm("この共通地点を削除しますか？")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/system-locations?id=${id}`, {
        method: "DELETE"
      });

      if (!res.ok) throw new Error("削除に失敗しました。");

      setSysLocations(sysLocations.filter(l => l.id !== id));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sortedSysLocations = [...sysLocations].sort((a, b) => a.sort_order - b.sort_order);
  const sortedUserLocations = [...locations].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-12">
      {/* システム設定地点（共通地点） */}
      <div className="space-y-4">
        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
          🏢 全社共通設定
          {isEditingAllowed && (
            <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-black">管理者編集モード</span>
          )}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedSysLocations.map((loc) => (
            <div key={loc.id} className={`rounded-2xl p-6 flex justify-between items-start transition-all ${
              isEditingAllowed ? "bg-white border-2 border-red-50 hover:border-red-200 shadow-sm" : "bg-gray-50/50 border-2 border-gray-100 opacity-70"
            }`}>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded ${
                    loc.is_permanent ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                  }`}>
                    {loc.is_permanent ? "常設拠点" : "期間限定"}
                  </span>
                  {loc.target_group === "corporate" && (
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-purple-100 text-purple-600">
                      コーポレート限定
                    </span>
                  )}
                  {loc.target_group === "individual" && (
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-emerald-100 text-emerald-600">
                      個別（通知のみ）
                    </span>
                  )}
                  <span className="text-sm font-bold text-gray-900">{loc.label}</span>
                  {isEditingAllowed && <span className="text-[10px] text-gray-300 font-mono">#{loc.sort_order}</span>}
                </div>
                <p className="text-sm text-gray-700 font-bold">{loc.prefecture} {loc.city}</p>
                {!isEditingAllowed && (
                  <p className="text-[10px] text-gray-400 font-medium">
                    {loc.is_permanent ? "システム管理者により設定されています" : "期間限定の通知対象地点です"}
                  </p>
                )}
              </div>
              {isEditingAllowed && !loc.is_permanent ? (
                <button 
                  onClick={() => handleDeleteSys(loc.id)}
                  disabled={loading}
                  className="text-gray-300 hover:text-red-500 transition-colors p-2"
                >
                  🗑️ 削除
                </button>
              ) : !isEditingAllowed ? (
                <span className="text-blue-400 text-xs font-bold">自動設定済み</span>
              ) : (
                <span className="text-red-400 text-[10px] font-black uppercase bg-red-50 px-2 py-1 rounded">編集不可</span>
              )}
            </div>
          ))}

          {isEditingAllowed && !isAddingSys && sysLocations.filter(l => !l.is_permanent).length < 2 && (
            <button
              onClick={() => setIsAddingSys(true)}
              className="border-2 border-dashed border-red-100 rounded-2xl p-6 flex items-center justify-center gap-2 text-red-400 font-bold hover:border-red-300 transition-all group"
            >
              <span className="text-xl group-hover:scale-125 transition-transform">+</span>
              追加地点を登録
            </button>
          )}
        </div>

        {isAddingSys && (
          <div className="bg-red-50/30 rounded-2xl p-8 space-y-6 border-2 border-red-100 animate-in fade-in slide-in-from-top-2">
            <h3 className="text-lg font-black text-gray-900">追加の共通地点を登録</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider">ラベル</label>
                <input 
                  type="text"
                  value={newSysLoc.label}
                  onChange={e => setNewSysLoc({...newSysLoc, label: e.target.value})}
                  placeholder="出張先、イベント会場など"
                  className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-2 font-bold focus:border-red-500 outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider">対象ユーザー</label>
                <select 
                  value={newSysLoc.target_group}
                  onChange={e => setNewSysLoc({...newSysLoc, target_group: e.target.value})}
                  className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-2 font-bold focus:border-red-500 outline-none transition-colors"
                >
                  <option value="all">全社員</option>
                  <option value="corporate">コーポレートのみ</option>
                  <option value="individual">個別（将来用：発災通知のみ）</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider">都道府県</label>
                <select 
                  value={newSysLoc.prefecture}
                  onChange={e => setNewSysLoc({...newSysLoc, prefecture: e.target.value, jma_code: "", jma_name: ""})}
                  className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-2 font-bold focus:border-red-500 outline-none transition-colors"
                >
                  <option value="未設定">都道府県を選択</option>
                  {locationMaster.map(p => <option key={p.pref} value={p.pref}>{p.pref}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider">市区町村</label>
                <select 
                  value={newSysLoc.jma_code}
                  onChange={e => {
                    const prefData = locationMaster.find(p => p.pref === newSysLoc.prefecture);
                    const cityData = prefData?.cities.find(c => c.code === e.target.value);
                    if (cityData) {
                      setNewSysLoc({...newSysLoc, jma_code: cityData.code, jma_name: cityData.name});
                    }
                  }}
                  disabled={newSysLoc.prefecture === "未設定"}
                  className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-2 font-bold focus:border-red-500 outline-none transition-colors"
                >
                  <option value="">市区町村を選択</option>
                  {locationMaster.find(p => p.pref === newSysLoc.prefecture)?.cities.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {newSysLoc.jma_name && (
              <div className="bg-red-50 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-xl">📡</span>
                <div>
                  <div className="text-[10px] font-black text-red-400 uppercase tracking-wider">該当JMA判定地点</div>
                  <div className="text-sm font-black text-red-600">{newSysLoc.jma_name} ({newSysLoc.jma_code})</div>
                  <div className="text-[10px] text-red-400 mt-1">※全社共通の通知地点として設定されます。</div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <button 
                onClick={() => setIsAddingSys(false)} 
                className="px-6 py-2 font-bold text-gray-400 hover:text-gray-600 transition-colors"
              >
                キャンセル
              </button>
              <button 
                onClick={handleAddSys} 
                disabled={loading}
                className="bg-red-600 text-white px-8 py-2 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-blue-100 disabled:opacity-50"
              >
                {loading ? "保存中..." : "保存する"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 個人の登録地点 */}
      <div className="space-y-4 pt-8 border-t border-gray-50">
        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">🏠 個人の登録地点（実家・その他）</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedUserLocations.map((loc) => (
            <div key={loc.id} className="border-2 border-gray-50 rounded-2xl p-6 flex justify-between items-start group hover:border-blue-100 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-black uppercase rounded">
                    {LOCATION_TYPES.find(t => t.value === loc.location_type)?.label || "登録地点"}
                  </span>
                  <span className="text-sm font-bold text-gray-900">{loc.display_name}</span>
                </div>
                <p className="text-sm text-gray-500 font-medium">{loc.prefecture} {loc.city}</p>
              </div>
              <button 
                onClick={() => handleDelete(loc.id)}
                disabled={loading}
                className="text-gray-300 hover:text-red-500 transition-colors p-2"
              >
                🗑️
              </button>
            </div>
          ))}

          {locations.length < 4 && !isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex items-center justify-center gap-2 text-gray-400 font-bold hover:border-blue-300 hover:text-blue-500 transition-all group"
            >
              <span className="text-xl group-hover:scale-125 transition-transform">+</span>
              実家・その他を追加する
            </button>
          )}
        </div>

        {isAdding && (
          <div className="bg-gray-50 rounded-2xl p-8 space-y-6 border-2 border-blue-100 animate-in fade-in slide-in-from-top-2">
            <h3 className="text-lg font-black text-gray-900">追加の地点を登録</h3>
            <p className="text-xs text-gray-500 font-medium">※勤務地および自宅（仙台）は自動設定されているため、登録不要です。</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider">種別</label>
                <select 
                  value={newLoc.location_type}
                  onChange={e => setNewLoc({...newLoc, location_type: e.target.value})}
                  className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-2 font-bold focus:border-blue-500 outline-none transition-colors"
                >
                  {LOCATION_TYPES.map(t => <option key={t.value} value={t.label}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider">名前（例：実家、出張先）</label>
                <input 
                  type="text"
                  value={newLoc.display_name}
                  onChange={e => setNewLoc({...newLoc, display_name: e.target.value})}
                  placeholder="実家"
                  className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-2 font-bold focus:border-blue-500 outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider">都道府県</label>
                <select 
                  value={newLoc.prefecture}
                  onChange={e => setNewLoc({...newLoc, prefecture: e.target.value, jma_code: "", jma_name: ""})}
                  className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-2 font-bold focus:border-blue-500 outline-none transition-colors"
                >
                  <option value="未設定">都道府県を選択</option>
                  {locationMaster.map(p => <option key={p.pref} value={p.pref}>{p.pref}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider">市区町村</label>
                <select 
                  value={newLoc.jma_code}
                  onChange={e => {
                    const prefData = locationMaster.find(p => p.pref === newLoc.prefecture);
                    const cityData = prefData?.cities.find(c => c.code === e.target.value);
                    if (cityData) {
                      setNewLoc({...newLoc, jma_code: cityData.code, jma_name: cityData.name});
                    }
                  }}
                  disabled={newLoc.prefecture === "未設定"}
                  className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-2 font-bold focus:border-blue-500 outline-none transition-colors"
                >
                  <option value="">市区町村を選択</option>
                  {locationMaster.find(p => p.pref === newLoc.prefecture)?.cities.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {newLoc.jma_name && (
              <div className="bg-blue-50 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-xl">📡</span>
                <div>
                  <div className="text-[10px] font-black text-blue-400 uppercase tracking-wider">該当JMA判定地点</div>
                  <div className="text-sm font-black text-blue-600">{newLoc.jma_name} ({newLoc.jma_code})</div>
                  <div className="text-[10px] text-blue-400 mt-1">※この地点名を含む地震情報が発表された際に通知が送信されます。</div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <button 
                onClick={() => setIsAdding(false)}
                className="px-6 py-2 rounded-xl font-bold text-gray-400 hover:text-gray-600 transition-colors"
              >
                キャンセル
              </button>
              <button 
                onClick={handleAdd}
                disabled={loading}
                className="bg-blue-600 text-white px-8 py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 disabled:opacity-50"
              >
                保存する
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
