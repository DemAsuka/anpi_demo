import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import Link from "next/link";

export async function UserDashboardView({ userId }: { userId: string }) {
  const supabase = createSupabaseServiceRoleClient();

  // アクティブなインシデントを取得
  const { data: activeIncidents } = await supabase
    .from("incidents")
    .select("*")
    .eq("status", "active")
    .order("started_at", { ascending: false });

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
          こんにちは
        </h1>
        <p className="text-gray-500 font-medium">
          現在のあなたの安全状況と、進行中の安否確認を確認できます。
        </p>
      </div>

      {/* アクティブなインシデント */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          進行中の安否確認
        </h2>
        
        {activeIncidents && activeIncidents.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {activeIncidents.map((incident) => (
              <div key={incident.id} className="bg-white border-2 border-red-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-black uppercase rounded">
                      {incident.menu_type.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-gray-400 font-bold">
                      {new Date(incident.started_at).toLocaleString('ja-JP')} 発生
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-gray-900">{incident.title}</h3>
                </div>
                <Link
                  href={`/report?incidentId=${incident.id}`}
                  className="bg-red-600 text-white px-8 py-3 rounded-2xl font-bold text-center hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                >
                  状況を報告する
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-[2rem] p-12 text-center">
            <p className="text-gray-400 font-bold text-lg">現在、進行中の安否確認はありません。</p>
            <p className="text-gray-400 text-sm mt-1">平穏な時間が続いています。備えを忘れずに。</p>
          </div>
        )}
      </div>

      {/* クイックリンク */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50/50 rounded-[2rem] p-8 space-y-4">
          <h3 className="text-lg font-black text-blue-900 flex items-center gap-2">
            📍 登録地点の確認
          </h3>
          <p className="text-sm text-blue-700 font-medium">
            通知を受け取るための地点（自宅や勤務地）が正しく設定されているか確認してください。
          </p>
          <Link 
            href="/settings"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
          >
            設定を確認する
          </Link>
        </div>
        <div className="bg-zinc-50 rounded-[2rem] p-8 space-y-4">
          <h3 className="text-lg font-black text-zinc-900 flex items-center gap-2">
            📖 利用マニュアル
          </h3>
          <p className="text-sm text-zinc-600 font-medium">
            安否確認ツールの使い方や、災害時の行動指針を確認できます。
          </p>
          <Link 
            href="/guide"
            className="inline-block bg-zinc-800 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-zinc-900 transition-colors"
          >
            マニュアルを見る
          </Link>
        </div>
      </div>
    </div>
  );
}

