import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { DrillStartForm } from "./_components/DrillStartForm";

type ResponseRow = {
  id: string;
  incident_id: string | null;
  status: string | null;
  created_at: string;
};

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  const currentMode = mode === "drill" ? "drill" : "prod";

  const supabase = createSupabaseServiceRoleClient();

  let query = supabase
    .from("incidents")
    .select("id,status,menu_type,title,started_at,ended_at,slack_channel,is_drill")
    .order("started_at", { ascending: false });

  if (currentMode === "prod") {
    query = query.eq("is_drill", false);
  } else {
    query = query.eq("is_drill", true);
  }

  const { data: incidents } = await query.limit(20);

  const incidentIds = (incidents ?? []).map((i) => i.id);
  const { data: responses } = incidentIds.length
    ? await supabase
        .from("responses")
        .select("id,incident_id,slack_user_id,status,created_at")
        .in("incident_id", incidentIds)
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

  const responseStatsByIncident = new Map<string, { total: number; safe: number; help: number }>();
  
  // インシデントごとにグループ化
  const groupedResponses = new Map<string, any[]>();
  (responses ?? []).forEach(r => {
    if (!r.incident_id) return;
    const list = groupedResponses.get(r.incident_id) ?? [];
    list.push(r);
    groupedResponses.set(r.incident_id, list);
  });

  // 各インシデント内でユーザーごとの最新回答を抽出
  for (const [incidentId, list] of groupedResponses.entries()) {
    const latestByUser = new Map<string, any>();
    list.forEach(r => {
      if (r.slack_user_id && !latestByUser.has(r.slack_user_id)) {
        latestByUser.set(r.slack_user_id, r);
      }
    });

    const stats = { total: 0, safe: 0, help: 0 };
    for (const r of latestByUser.values()) {
      stats.total++;
      if (r.status === 'safe') stats.safe++;
      if (r.status === 'help') stats.help++;
    }
    responseStatsByIncident.set(incidentId, stats);
  }

  const activeCount = incidents?.filter(i => i.status === 'active').length ?? 0;
  const drillCount = incidents?.filter(i => i.is_drill).length ?? 0;

  return (
    <main className="space-y-10 py-4">
      {/* 画面ヘッダー: タイポグラフィを重視 */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            {currentMode === "prod" ? "Status Monitoring" : "Training Center"}
          </h1>
          <p className="text-gray-500 font-medium text-sm">
            {currentMode === "prod" 
              ? "リアルタイムの災害状況と安否確認" 
              : "訓練配信とシミュレーション管理"}
          </p>
        </div>

        {/* セグメントコントロール風のタブ切り替え */}
        <div className="inline-flex p-1 bg-gray-200/50 backdrop-blur-sm rounded-2xl w-fit">
          <a
            href="/admin?mode=prod"
            className={`px-8 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 ${
              currentMode === "prod"
                ? "bg-white text-red-600 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            本番運用
          </a>
          <a
            href="/admin?mode=drill"
            className={`px-8 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 ${
              currentMode === "drill"
                ? "bg-white text-blue-600 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            訓練・テスト
          </a>
        </div>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {[
          { label: "Active Incidents", value: activeCount, color: "text-blue-600", bg: "bg-blue-50/50" },
          { label: "Total Drills", value: drillCount, color: "text-gray-900", bg: "bg-gray-50/50" },
          { label: "JMA Feed", value: "Connected", color: "text-green-600", bg: "bg-green-50/50" },
        ].map((stat, idx) => (
          <div key={idx} className={`${stat.bg} rounded-[2rem] p-8 transition-transform hover:scale-[1.02] duration-200`}>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{stat.label}</p>
            <p className={`mt-2 text-4xl font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-10">
        {currentMode === "drill" && (
          <div className="max-w-2xl">
            <DrillStartForm />
          </div>
        )}

        {/* リスト表示 */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-800 ml-1">
            {currentMode === "prod" ? "Recent Incidents" : "Training History"}
          </h2>
          <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-50 text-[11px] uppercase tracking-[0.1em] text-gray-400 font-black">
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5">Date & Time</th>
                  <th className="px-8 py-5">Description</th>
                  <th className="px-8 py-5 text-center">Responses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(incidents ?? []).map((i) => {
                  const stats = responseStatsByIncident.get(i.id) ?? { total: 0, safe: 0, help: 0 };
                  const hasHelp = stats.help > 0;
                  
                  return (
                    <tr 
                      key={i.id} 
                      className={`group transition-colors duration-200 ${hasHelp ? "bg-red-50/70" : "hover:bg-gray-50/30"}`}
                    >
                      <td className="px-8 py-6 whitespace-nowrap">
                        {i.is_drill ? (
                          <span className="px-3 py-1 text-[10px] font-black uppercase rounded-full bg-blue-100 text-blue-600">Drill</span>
                        ) : (
                          <span className="px-3 py-1 text-[10px] font-black uppercase rounded-full bg-red-100 text-red-600">Live</span>
                        )}
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                        <p className="text-sm font-bold text-gray-900">
                          {new Date(i.started_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', timeZone: 'Asia/Tokyo' })}
                        </p>
                        <p className="text-xs text-gray-400 font-medium">
                          {new Date(i.started_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm font-bold text-gray-900 leading-tight">{i.title ?? "Unnamed Incident"}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">{i.menu_type.replace('_', ' ')}</p>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-4">
                          <div className="text-center">
                            <p className="text-sm font-black text-gray-900">{stats.total}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase">Total</p>
                          </div>
                          <div className="h-8 w-px bg-gray-100" />
                          <div className="text-center">
                            <p className="text-sm font-black text-blue-500">{stats.safe}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase">Safe</p>
                          </div>
                          <div className="text-center">
                            <p className={`text-sm font-black ${stats.help > 0 ? "text-red-500" : "text-gray-300"}`}>{stats.help}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase">Help</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!incidents?.length && (
                  <tr>
                    <td className="px-8 py-12 text-center text-gray-400 text-sm font-medium" colSpan={4}>
                      表示できるデータがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
