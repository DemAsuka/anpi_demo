# デモ環境 テスト計画（災害なしで確認）

## 本番資料の参照

「気象庁監視」「Slack通知」「Workflow回答」「管理ダッシュボード」の最小成立は以下を参照しています。

- 参照: `1_docs/安否確認ツール_要件定義_v0.1.md`
- 参照: `1_docs/manuals/報告用_実装前計画案_GenSpark台本_2025-12-22.md`

## テスト項目

### A. APIヘルス

- 手順: `GET /api/health`
- 期待: `status=ok`

### B. JMA監視（災害なし）

- 手順: `GET /api/cron/jma?token=<CRON_SECRET>`
- 期待:
  - `jma_entries` が upsert される
  - 2回目以降は `changed` が減る（重複排除が効いている）

### C. Slack DM通知（デモ）

- 手順: B を実行（またはデモ起動APIを実行）
- 期待:
  - あなたのDMに通知が届く
  - 文面に `[DEMO]` と `訓練です` を含む（デモ起動時）

### D. 管理画面ログイン（Clerk + Supabase RLS）

- 手順:
  - `/admin/sign-in` （Clerk UI）でログイン
  - `admin_users` に自分の `Clerk UserID` を追加
  - `/admin` を開く
- 期待:
  - `/admin` が表示できる（forbiddenにならない）

### E. Workflow回答保存（任意）

- 手順: Workflow Builder → Webhook を叩く
- 期待: `responses` に保存される（raw_payloadが入っていればOK）

## 合否ライン（デモとして最低限）

- A, B, D がOK
- C は「デモ通知」を入れる場合に必須
- E は時間がなければ省略可（通知+保存の最小でデモ成立）

## 追加（推奨）：災害なしで常に起動できる確認

- 手順: `POST /api/demo/incidents/start?secret=<DEMO_SECRET>`
- 期待:
  - `incidents` が作成される
  - DMに `[DEMO]` が付いた開始通知が届く

