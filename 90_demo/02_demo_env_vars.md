# デモ環境の環境変数（案A）

## 本番資料の参照

本番の一次リリース想定（Vercel + Supabase + Slack）を前提にしています。

- 参照: `1_docs/安否確認ツール_要件定義_v0.1.md`
- 参照: `1_docs/manuals/報告用_実装前計画案_GenSpark台本_2025-12-22.md`

## 原則（事故防止）

- **本番の値をデモに流用しない**
- **Slack送信先はあなたの user_id に固定**（デモ時に誰にも誤送信しない）
- 秘密情報は **Vercel Environment Variables** で管理（ローカルは `.env.local`）
- URL/Key漏えい時は **即ローテーション**（Supabase keys / Slack token）

## デモ用の環境変数一覧（web側）

`web/env.example`（実装側のテンプレ）をデモ用に埋めます。

### Clerk（demo）

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

### Supabase（demo）

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Cron（JMA監視）

- `CRON_SECRET`
  - Vercel Cron や手動実行の認証トークン
  - 推奨: 32文字以上のランダム文字列

### Slack（デモ通知：DM）

※DM送信は Incoming Webhook では難しいため、Slack App（Bot）を推奨します。

- `SLACK_BOT_TOKEN`
  - Bot User OAuth Token（`xoxb-...`）
- `SLACK_DM_USER_ID`
  - あなたの Slack user_id（例: `U012ABCDEF`）

補足：

- デモでは `SLACK_WEBHOOK_URL` は **未設定でもOK**（Bot DMを優先して送るため）。

### Slack Workflow Builder（デモ回答）

- `SLACK_WORKFLOW_SHARED_SECRET`
  - Workflow Webhook → API の認証用

### 訓練（手動発動）API

- `DEMO_MODE=true`
  - デモで `[DEMO]` を自動付与したい場合に使用
- `DEMO_SECRET`
  - `POST /api/demo/incidents/start` / `POST /api/demo/incidents/close` の認証用
  - 推奨: 32文字以上のランダム文字列

## 本番とデモの切替方針（推奨）

- Vercel プロジェクトを分ける（demo / prod）
- Supabase プロジェクトを分ける（demo / prod）
- Clerk プロジェクトを分ける（demo / prod）
- Slack App（Bot）も分ける（demo / prod）

この3点を分けると「うっかり本番に投稿」「本番DBに書き込み」が物理的に起きにくくなります。

