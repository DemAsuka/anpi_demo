# デモ当日 Runbook（案A）

## 本番資料の参照

「災害が起きなくても確認できるよう、手動発動（訓練）を用意する」方針は以下の要件を参照しています。

- 参照: `1_docs/安否確認ツール_要件定義_v0.1.md`（手動/訓練の発動）

## 事前チェック（5分）

- [ ] Vercel demo がデプロイ済み
- [ ] Supabase demo が稼働、テーブルが作成済み
- [ ] **Clerk demo が稼働、Google 連携設定済み**
- [ ] 管理画面ログイン可能（admin_usersに Clerk UserID 登録済み）
- [ ] Slack DM（Bot）があなたに送れる
- [ ] 環境変数が demo の値になっている（本番混入なし）

## デモの流れ（最短）

### 1) ヘルスチェック

- `GET /api/health`

### 2) 「監視が生きている」確認（災害なしでOK）

- `GET /api/cron/jma?token=...`

期待：

- Supabase demo の `jma_entries` が更新される（件数が増える/updatedが変わる）
- 必要に応じて Slack DM に通知が来る

### 3) 「起動できる」確認（疑似発動＝訓練）

※デモ用API（訓練）で、災害に依存せず起動確認できます。

#### 開始（start）

- `POST /api/demo/incidents/start`（`DEMO_SECRET` 必須）

例（curl）:

```bash
curl -X POST "https://<demo>/api/demo/incidents/start?secret=<DEMO_SECRET>" ^
  -H "content-type: application/json" ^
  -d "{\"menu_type\":\"earthquake\",\"title\":\"訓練：震度5弱（デモ）\",\"message\":\"これは訓練です。回答してください。\"}"
```

期待：

- Slack DM に `[DEMO] 訓練です` で開始通知
- `incidents` にレコードができる

#### 終了（close）

- `POST /api/demo/incidents/close`（`DEMO_SECRET` 必須）

例（curl）:

```bash
curl -X POST "https://<demo>/api/demo/incidents/close?secret=<DEMO_SECRET>" ^
  -H "content-type: application/json" ^
  -d "{\"incident_id\":\"<startのレスポンスで返るincident_id>\"}"
```

### 4) 「回答が入る」確認（任意）

- Slack Workflow Builder から Webhook 送信
- `responses` に保存される

## 事故防止の一言（口頭用）

- 「これはデモ環境で、通知は私のDMにしか届きません。訓練（DEMO）表示が必ず入ります。」

