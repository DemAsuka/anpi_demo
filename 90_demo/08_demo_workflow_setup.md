# Slack 回答ボタン（インタラクティブ）設定手順

デモにおいて、Slack 通知から直接回答を受け取るための設定手順です。

## 前提条件
- Slack App が作成され、ワークスペースにインストールされていること。
- Vercel へのデプロイが完了し、公開 URL が取得できていること。

## 設定手順

### 1. Slack 側での有効化
1. [Slack API](https://api.slack.com/apps) から対象のアプリを選択。
2. **Interactivity & Shortcuts** を開く。
3. トグルを **ON** に切り替える。
4. **Request URL** を入力：
   - `https://<あなたのVercelドメイン>/api/slack/responses`
   - **注意**: URL の末尾に `/` を含めないでください。Next.js のリダイレクトにより POST が GET に化け、405 エラーが発生します。
5. **Save Changes** を押して保存。

### 2. データベースの制約追加（重複回答の防止）
同じユーザーが同じインシデントに複数回答した際、最新の回答で上書きされるように、Supabase でユニーク制約を追加します。

SQL Editor で以下を実行：
```sql
-- 回答テーブルにユニーク制約を追加
alter table public.responses add constraint responses_incident_user_unique unique (incident_id, slack_user_id);
```

## デモ実演の流れ
1. 管理画面から「訓練開始」を配信。
2. Slack に届いた通知の「✅ 無事です」または「⚠️ 助けが必要」ボタンを押す。
3. ボタンが「回答を受け付けました」というフィードバックに変わる。
4. 管理画面をリロードし、回答数（内訳）が更新されていることを示す。
