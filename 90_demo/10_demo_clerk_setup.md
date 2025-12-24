# Clerk 認証 構築手順（デモ用）

## 本番資料の参照

Clerk を認証に使用する方針は以下を参照しています。

- 参照: `/sample/prompts/supabase_prompts/clerk_setupprpompt.md`
- 参照: `/sample/design/system-architecture.md`

## 目的

- 管理画面へのアクセスを安全に保護する
- Google 連携や MFA（二要素認証）を容易に導入する
- 個人情報を扱う安否確認ツールのセキュリティ水準を確保する

## 手順

### 1. Clerk でデモ用プロジェクトを作成

- Clerk Dashboard (https://dashboard.clerk.com/) で "Add Application"
- Application Name 例: `anpi-demo`
- 認証方法: **"Google" のみを有効化**

### 2. API キーの取得

Clerk Dashboard → API Keys から以下を取得します。

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

### 3. Supabase との JWT 連携設定

1. **JWT テンプレート作成**:
   - Clerk Dashboard → JWT Templates → New Template → **Supabase**
   - テンプレート名を `supabase` (デフォルト) に設定
   - **Custom signing key**: **OFF** に設定（RS256 方式が自動適用される）
   - **Claims**: デフォルトのままで OK（`sub` は自動的に付与されるため、手動で追加しない）
   - 保存して **Issuer URL** を控える

### 4. ローカル開発環境の設定

- `web/.env.local` に上記 API キーと Issuer を追記します。

## 動作確認

1. `npm run dev` で起動
2. `http://localhost:3000/admin` にアクセス
3. Clerk のログイン画面が表示され、Google ログイン等で認証が完了することを確認
4. ログイン後、Supabase RLS により「権限なし」または「ダッシュボード」が正しく表示されることを確認
