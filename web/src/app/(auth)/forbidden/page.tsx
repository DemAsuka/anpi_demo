import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-[2rem] p-10 shadow-sm text-center space-y-6">
        <div className="text-6xl">🚫</div>
        <h1 className="text-2xl font-black text-gray-900">管理者権限が必要です</h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          現在表示しようとしている機能は管理者のみが利用可能です。<br />
          もし管理者の場合は、システム担当者に連絡して権限を付与してもらってください。
        </p>
        <div className="pt-4">
          <Link 
            href="/dashboard?view=user" 
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
          >
            ポータルへ戻る
          </Link>
        </div>
      </div>
    </main>
  );
}

