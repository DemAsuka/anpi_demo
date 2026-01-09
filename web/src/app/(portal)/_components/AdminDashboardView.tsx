import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

export async function AdminDashboardView({ currentMode }: { currentMode: string }) {
  const supabase = createSupabaseServiceRoleClient();

  let query = supabase
    .from("incidents")
    .select("id,status,menu_type,title,started_at,ended_at,slack_channel,is_drill,mode")
    .order("started_at", { ascending: false });

  if (currentMode === "prod") {
    query = query.eq("mode", "production");
  } else {
    query = query.in("mode", ["drill", "test"]);
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
  
  const groupedResponses = new Map<string, any[]>();
  (responses ?? []).forEach(r => {
    if (!r.incident_id) return;
    const list = groupedResponses.get(r.incident_id) ?? [];
    list.push(r);
    groupedResponses.set(r.incident_id, list);
  });

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
      if (r.status === 'help' || r.status === 'serious' || r.status === 'minor') stats.help++;
    }
    responseStatsByIncident.set(incidentId, stats);
  }

  const activeCount = incidents?.filter(i => i.status === 'active').length ?? 0;
  const drillCount = incidents?.filter(i => i.mode !== 'production').length ?? 0;

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
              currentMode === "prod" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
            }`}>
              {currentMode === "prod" ? "Production Mode" : "Training & Test Mode"}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            管理者ダッシュボード
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {[
          { label: "Active Incidents", value: activeCount, color: "text-blue-600", bg: "bg-blue-50/50" },
          { label: "Total Drills", value: drillCount, color: "text-gray-900", bg: "bg-gray-50/50" },
          { label: "System Status", value: "Normal", color: "text-green-600", bg: "bg-green-50/50" },
        ].map((stat, idx) => (
          <div key={idx} className={`${stat.bg} rounded-[2rem] p-8 transition-transform hover:scale-[1.02] duration-200`}>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{stat.label}</p>
            <p className={`mt-2 text-4xl font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

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
                return (
                  <tr key={i.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-full ${
                        i.status === 'active' ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                      }`}>
                        {i.status}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-bold text-gray-900">{new Date(i.started_at).toLocaleDateString('ja-JP')}</p>
                      <p className="text-xs text-gray-400">{new Date(i.started_at).toLocaleTimeString('ja-JP')}</p>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-bold text-gray-900">{i.title}</p>
                      <p className="text-[10px] text-gray-400 uppercase">{i.menu_type}</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-center gap-4 text-center">
                        <div>
                          <p className="text-sm font-black">{stats.total}</p>
                          <p className="text-[9px] text-gray-400">Total</p>
                        </div>
                        <div>
                          <p className="text-sm font-black text-blue-500">{stats.safe}</p>
                          <p className="text-[9px] text-gray-400">Safe</p>
                        </div>
                        <div>
                          <p className="text-sm font-black text-red-500">{stats.help}</p>
                          <p className="text-[9px] text-gray-400">Needs Help</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

