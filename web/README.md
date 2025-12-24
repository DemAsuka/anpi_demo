安否確認ツール（MVP, 10人以下）: 管理ダッシュボード + JMA監視Cron + Slack回答収集

このディレクトリ（`web/`）は Next.js(App Router) アプリ本体です。

## Getting Started

### 1) Clerk & Supabase（DB/Auth）を用意

- Clerk でプロジェクト作成、Google 連携設定
- Supabase でプロジェクト作成
- SQL Editor で以下のマイグレーションを実行
  - `../supabase/migrations/20251222023800_init.sql`
- Clerk Dashboard で JWT Template (Supabase) を作成

### 2) 管理者ユーザーを登録

1. `http://localhost:3000/admin` にアクセスし、Clerk でログイン
2. Clerk Dashboard またはログイン後の情報から自分の Clerk UserID (`user_...`) を取得
3. Supabase SQL Editor で `admin_users` に UserID を追加

```sql
insert into public.admin_users (user_id) values ('user_...');
```

### 3) 環境変数を設定

`web/env.example` を参考に `web/.env.local` を作成し、値を設定してください。

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

主要URL:

- `GET /api/health`
- `GET /api/cron/jma?token=...`（Vercel Cron から叩く想定。ローカルでも動作確認可）
- `POST /api/slack/responses?secret=...`（Slack Workflow Builder の Webhook 受け口）
- `/admin`（管理ダッシュボード）

### Deploy on Vercel（重要）

Vercel プロジェクトの Root Directory は `web` を指定してください。

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
