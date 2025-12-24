# Slack DM（デモ用）構築手順（案A）

## 本番資料の参照

本番は「Slackチャンネル投稿で周知」が前提ですが、デモでは「あなたのDM」に限定します。

- 参照: `1_docs/安否確認ツール_要件定義_v0.1.md`（通知＝Slack、回答＝Workflow Builder）

## なぜIncoming WebhookではなくSlack App（Bot）か

- Incoming Webhook は **チャンネル投稿向き**で、DM送信は制約が多く運用が不安定になりがちです。
- DMを確実にしたい場合は、**Slack App（Bot Token）で chat.postMessage** が確実です。

## 手順（Slack App作成）

### 1. Slack App（デモ用）を作成

- Create New App → From scratch
- App Name 例: `anpi-demo-bot`
- ワークスペースは「本番と同じWS」でOK（送信先をDM固定するため）

### 2. OAuth Scopes（Bot Token Scopes）

以下の権限（Scope）を追加してください：

- `chat:write`: メッセージ送信
- `im:write`: あなたとの DM を開始するために必要

### 3. Install to Workspace（インストール）

- ワークスペースにインストールし、**Bot User OAuth Token**（`xoxb-...`）を取得

### 4. あなたの user_id を取得

1. Slack アプリで自分のアイコンをクリック
2. 「プロフィールを表示」を選択
3. 「...（その他）」をクリックし、**「メンバーIDをコピー」** を選択（例: `U012ABCDEF`）

### 5. デモの送信先を固定する

Vercel の Environment Variables（demo）に以下を設定：

- `SLACK_BOT_TOKEN=<xoxb-...>`
- `SLACK_DM_USER_ID=<あなたのUserID>`

## デモDMの運用ルール（事故防止）

- 文面に必ず入れる：
  - `[DEMO]`
  - `訓練です`
  - 住所/電話など **PIIを書かない注意**
- 送信先は `SLACK_DM_USER_ID` 固定（デモでメンション/全体送信はしない）

