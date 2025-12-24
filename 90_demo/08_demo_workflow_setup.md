# Slack Workflow Builder（デモ）設定手順

## 本番資料の参照

「回答UIは Slack Workflow Builder でOK（一次リリースはWorkflow Builderで固定）」の方針を参照しています。

- 参照: `1_docs/安否確認ツール_要件定義_v0.1.md`

## 目的（デモ）

- Slack上で回答 → Webhook → `POST /api/slack/responses` → Supabase(`responses`) に保存
- 管理画面（`/admin`）で回答数が増えることを確認

## 手順

### 1. Workflow を作る（デモ用）

- Workflow Builder で新規作成
- トリガーはデモ用途なら何でもOK
  - 例: ショートカット / ボタン / DMで起動 等

### 2. フォーム項目（推奨）

Workflowフォームの「変数名（キー）」を以下に寄せると、API側で自動的に取り込みやすいです。

- `incident_id`（テキスト入力）
  - デモ起動APIの開始通知DMに `incident_id: ...` が出るので、それを貼り付ける
- `slack_user_id`（テキスト）
  - 手入力が面倒なら、まずは固定値でもOK（例: `demo_user`）
- `status`（選択式）
  - 例: `safe` / `minor` / `serious` / `help`
- `comment`（任意のテキスト）
  - 注意文: 住所/電話などPIIを書かない

### 3. Webhook ステップを追加

送信先：

- `POST https://<vercel-demo-domain>/api/slack/responses?secret=<SLACK_WORKFLOW_SHARED_SECRET>`

送信するフィールド：

- 上記フォーム項目をそのまま送る（`incident_id`, `status`, `comment`, `slack_user_id`）

※本実装のAPIは JSON でも form-encoded でも受け取れます。

## 確認方法

1. デモ起動（訓練）
   - `POST /api/demo/incidents/start?secret=<DEMO_SECRET>`
2. DMに表示された `incident_id` をWorkflowに入力して送信
3. Supabaseで `responses` にレコードが作成される
4. `/admin` の回答数が増える

