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
  searchParams: Promise<{ drill?: string }>;
}) {
  const { drill } = await searchParams;
  const isDrillFilter = drill === "1";

  const supabase = createSupabaseServiceRoleClient();

  let query = supabase
    .from("incidents")
    .select("id,status,menu_type,title,started_at,ended_at,slack_channel,is_drill")
    .order("started_at", { ascending: false })
    .limit(20);

  if (drill === "1") {
    query = query.eq("is_drill", true);
  } else if (drill === "0") {
    query = query.eq("is_drill", false);
  }

  const { data: incidents } = await query;

  const incidentIds = (incidents ?? []).map((i) => i.id);
  const { data: responses } = incidentIds.length
    ? await supabase
        .from("responses")
        .select("id,incident_id,status,created_at")
        .in("incident_id", incidentIds)
    : { data: [] as ResponseRow[] };

  const responseCountByIncident = new Map<string, number>();
  for (const r of responses ?? []) {
    if (!r.incident_id) continue;
    responseCountByIncident.set(
      r.incident_id,
      (responseCountByIncident.get(r.incident_id) ?? 0) + 1,
    );
  }

  // 統計用の計算
  const activeCount = incidents?.filter(i => i.status === 'active').length ?? 0;
  const drillCount = incidents?.filter(i => i.is_drill).length ?? 0;

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          安否確認ダッシュボード
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          システムの稼働状況と、現在進行中の安否確認インシデントを一括管理します。
        </p>
      </div>

      {/* 統計カードセクション */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">現在稼働中</p>
          <p className="mt-2 text-3xl font-bold text-blue-600">{activeCount}</p>
          <p className="mt-1 text-xs text-gray-400">アクティブなインシデント</p>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">本日の訓練</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{drillCount}</p>
          <p className="mt-1 text-xs text-gray-400">実施済みの訓練数</p>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">JMA接続</p>
          <p className="mt-2 text-3xl font-bold text-green-600">正常</p>
          <p className="mt-1 text-xs text-gray-400">気象庁フィード監視中</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* 左側：訓練開始フォーム */}
        <div className="lg:col-span-1">
          <DrillStartForm />
        </div>

        {/* 右側：インシデント一覧 */}
        <div className="lg:col-span-2">
          <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b bg-gray-50/50 p-4">
              <h2 className="font-semibold text-gray-800">直近の対応履歴</h2>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <a href="/admin" className={`px-3 py-1 text-xs font-medium rounded-md transition ${!drill ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>すべて</a>
                <a href="/admin?drill=0" className={`px-3 py-1 text-xs font-medium rounded-md transition ${drill === "0" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>本番</a>
                <a href="/admin?drill=1" className={`px-3 py-1 text-xs font-medium rounded-md transition ${drill === "1" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>訓練</a>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50 text-left text-gray-500 font-medium">
                  <tr>
                    <th className="px-4 py-3 border-b">区分</th>
                    <th className="px-4 py-3 border-b">日時</th>
                    <th className="px-4 py-3 border-b">種別</th>
                    <th className="px-4 py-3 border-b">タイトル</th>
                    <th className="px-4 py-3 border-b text-center">回答数</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(incidents ?? []).map((i) => (
                    <tr key={i.id} className="hover:bg-gray-50/50 transition">
                      <td className="px-4 py-4 whitespace-nowrap">
                        {i.is_drill ? (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">訓練</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-700/10">本番</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-gray-600 whitespace-nowrap">
                        {new Date(i.started_at).toLocaleDateString()} {new Date(i.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-4">
                        <span className="capitalize text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-xs">{i.menu_type.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-4 font-medium text-gray-900">{i.title ?? "-"}</td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center justify-center rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-800">
                          {responseCountByIncident.get(i.id) ?? 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!incidents?.length && (
                    <tr>
                      <td className="px-4 py-8 text-center text-gray-500" colSpan={5}>
                        表示できるデータがありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

