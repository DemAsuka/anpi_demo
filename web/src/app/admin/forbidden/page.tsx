export default function AdminForbiddenPage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">権限がありません</h1>
      <p className="mt-2 text-sm text-gray-700">
        このアカウントは管理者として登録されていません。Supabase の
        <code className="mx-1 rounded bg-gray-100 px-1">admin_users</code>
        に user_id を追加してください。
      </p>
    </main>
  );
}

