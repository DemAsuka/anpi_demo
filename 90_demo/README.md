# デモ環境（案A）構築手順

このフォルダは、**本番に影響を与えないデモ環境**（案A）を構築するための資料一式です。

## 本番資料の参照（参照した場合は明記）

本デモ案は、以下の本番（一次リリース）方針を前提にしています：

- 監視: **Vercel Cron で気象庁 XML feeds を定期取得**（60秒想定）
- 通知: Slack（本番はチャンネル投稿想定だが、デモは **あなたのDM**）
- 回答: Slack Workflow Builder → Webhook → API → DB
- 認証: **Clerk（Google 連携 / MFA）**
- DB/認可: Supabase（PostgreSQL + RLS + Clerk JWT）

参照元（本番資料）：

- `1_docs/安否確認ツール_要件定義_v0.1.md`
- `1_docs/manuals/報告用_実装前計画案_GenSpark台本_2025-12-22.md`

参照元（/sample：構築手順のベース）：

- `sample/prompts/1_system-requirements-prompt.md`
- `sample/prompts/2_detailed_requirements_prompt.md`
- `sample/prompts/3_generate_detailed_design_files_prompt.md`
- `sample/prompts/supabase_prompts/MASTER_INTEGRATION_PROMPT.md`
- `sample/prompts/supabase_prompts/QUICK_START_PROMPT.md`
- `sample/prompts/supabase_prompts/supabase_migration_prompt.md`
- `sample/prompts/supabase_prompts/supabase_bootstrap_nextjs_app_with SupabaseAuth.md`

## 目的

- 実際に地震等が起きなくても、**「ツールが起動している」ことをいつでも確認できる**ようにする
- いきなり本番チャンネルへ投稿しない（周囲に不要な心配をかけない）
- 本番と混線しない（誤通知・誤データ投入を避ける）

## 構成（案A：推奨）

- **Vercel（demo）**：デモ用のデプロイ先（Root Directory = `web`）
- **Supabase（demo）**：デモ用DB/Auth（本番と別プロジェクト）
- **Slack（本番WS内）**：あなた宛のDMのみ
  - DM送信は Incoming Webhook だけでは難しいため、原則 **Slack App（Bot Token）でDM送信**する

### 安全装置（必須）

- **デモ専用の環境変数**（本番値を絶対に流用しない）
- APIは **DEMOモード + シークレット必須**でガード
- Slack DM本文に必ず **`[DEMO]` と「訓練です」** を付ける

## 進め方（最短で疎通確認まで）

1. Supabase demo プロジェクト作成 → DB作成 → **Clerk JWT テンプレート設定**
2. **Clerk demo プロジェクト作成 → Google 連携設定 → APIキー取得**
3. Vercel demo プロジェクト作成（Root Directory=`web`）→ 環境変数設定
3. Slack App（デモ用）作成 → Bot Token を取得 → あなたの user_id を固定
4. 疎通確認（3本）
   - `GET /api/health`
   - `GET /api/cron/jma?...`（Cron相当の手動実行）
   - `POST /api/admin/incidents/start-drill`（訓練開始）

※/sample の `MASTER_INTEGRATION_PROMPT.md` の流れに合わせ、デモでは「通知先だけDM固定」「手動発動APIで災害に依存しない」を追加しています。

## 進捗状況

- [x] Step 1: Supabase セットアップ（テーブル構築・管理者型修正）
- [x] Step 2: Clerk セットアップ（Googleログイン・JWT連携）
- [x] Step 3: Slack セットアップ（Bot Token取得・DM設定）
- [x] Step 4: ローカル環境構築（.env.local・npm install）
- [x] Step 5: 疎通確認（管理者ログイン・訓練通知送信）
- [ ] Step 6: 回答受信フロー（Slack Workflow Builder）
- [ ] Step 7: Vercel デプロイと Cron 設定

## このフォルダのファイル

- `01_demo_architecture.md`：全体像（Mermaid）
- `02_demo_env_vars.md`：デモ用環境変数（漏えい防止含む）
- `03_demo_supabase_setup.md`：Supabase demo 構築手順
- `04_demo_vercel_setup.md`：Vercel demo 構築手順（Cron含む）
- `05_demo_slack_dm_setup.md`：Slack DM（Bot）構築手順
- `06_demo_runbook.md`：デモ当日の操作手順（チェックリスト）
- `07_demo_test_plan.md`：疎通確認項目（災害無しでOK）
- `08_demo_workflow_setup.md`：Workflow Builder（デモ）設定手順
- `09_jma_polling_doc_update_ops.md`：気象庁の技術資料更新時の運用（次ステップ）
- `10_demo_clerk_setup.md`：Clerk 認証の構築手順
