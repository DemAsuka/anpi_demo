# Supabase demo 構築手順（案A）

## 本番資料の参照

Supabase を DB/Auth の中核にする方針は以下を参照しています。

- 参照: `1_docs/安否確認ツール_要件定義_v0.1.md`
- 参照: `1_docs/manuals/報告用_実装前計画案_GenSpark台本_2025-12-22.md`

## 手順

### 1. Supabaseでデモ用プロジェクト作成

- Project name 例: `anpi-demo`
- Region: 任意（本番と同一リージョンに寄せると体感が近い）
- Database password: 強いもの

### 2. マイグレーション適用（DB作成）

SQL Editor で以下を順番に実行：

1. `supabase/migrations/20251222023800_init.sql`
2. `supabase/migrations/20251223000000_add_drill.sql`

**重要：Clerk 連携のための型修正**
Clerk のユーザーID（`user_...`）を保存するため、以下の SQL を実行して `admin_users` テーブルを修正します。

```sql
-- ポリシーを一旦削除
drop policy if exists "admin_users_select_own" on public.admin_users;

-- 型を uuid から text に変更
alter table public.admin_users alter column user_id type text;

-- 管理者判定関数を Clerk ID (text) 対応版に更新
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = (auth.jwt()->>'sub')
  );
$$;

-- ポリシー再作成
create policy "admin_users_select_own" on public.admin_users for select using ( (auth.jwt()->>'sub') = user_id);
```

### 3. Auth 設定

本デモでは **Clerk** を認証プロバイダーとして使用するため、Supabase 側の Auth 設定（Email 等）は原則 **OFF** で構いません。

### 4. Keys を取得（デモ用）

Project Settings → API から取得：

- **Project URL**
- **NEXT_PUBLIC_SUPABASE_ANON_KEY**: 「Publishable API Key」
- **SUPABASE_SERVICE_ROLE_KEY**: 「Secret Key」（"here" リンクから表示）

※これらは **デモ用** を使用し、本番の値は混ぜないこと。

### 5. 管理者の有効化（admin_users）

1. 管理画面（`/admin`）に一度ログインします。
2. Clerk Dashboard の Users から自分の **User ID** (`user_...`) を取得します。
3. Supabase の Table Editor で `admin_users` テーブルにその ID を登録します。

## 疎通確認（Supabase単体）

- Table Editorで `jma_entries` / `incidents` / `responses` が存在する
- `admin_users` へ追加後、管理画面から select が通る（RLSの確認）
