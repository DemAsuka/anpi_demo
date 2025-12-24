# Vercel demo 構築手順（案A）

## 本番資料の参照

CronでJMAを定期監視し、API/管理画面をVercelでホストする方針は以下を参照しています。

- 参照: `1_docs/manuals/報告用_実装前計画案_GenSpark台本_2025-12-22.md`

## 前提

- このリポジトリでは Next.js アプリ本体が `web/` にあります
- デモ用Vercelプロジェクトは **Root Directory = `web`** にします

## 手順

### 1. Vercelにデモ用プロジェクトを作る

- Project name 例: `anpi-demo`
- Root Directory: `web`

### 2. 環境変数（Environment Variables）を設定

`90_demo/02_demo_env_vars.md` の値を **デモ用** として設定します。

最低限（現状実装に存在するもの）：

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `SLACK_WORKFLOW_SHARED_SECRET`

デモ（DM固定 + 訓練API）で追加推奨：

- `SLACK_BOT_TOKEN`
- `SLACK_DM_USER_ID`
- `DEMO_MODE=true`
- `DEMO_SECRET`

### 3. デプロイ

- main ブランチ or 任意ブランチでデモ運用（本番とは分ける）

### 4. Cron設定（デモ用）

デモでは「本当に1分ごと」でなくても良いです（費用/ノイズ抑制）。

例：

- 5分に1回: `/api/cron/jma?token=<CRON_SECRET>`

### 5. 公開後の URL 更新（重要）

デプロイ完了後、以下の設定を Vercel の URL で更新します：

1. **Slack App 設定**:
   - `Interactivity & Shortcuts` > `Request URL` を更新。
2. **Clerk 設定**:
   - `Domains` や `SSO Connections (Google)` のリダイレクト許可リストに Vercel ドメインを追加。

## 疎通確認（Vercel）

- `GET https://<demo>/api/health`
- `GET https://<demo>/api/cron/jma?token=<CRON_SECRET>`
  - Supabase demo の `jma_entries` が更新される

（推奨）訓練API：

- `POST https://<demo>/api/demo/incidents/start?secret=<DEMO_SECRET>`

