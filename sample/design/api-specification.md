# API仕様書

## 1. 設計原則

本プロジェクトでは、**Next.js App Router** の **Server Actions** を主要な通信手段として採用します。これにより、クライアントとサーバー間の通信を型安全に行い、従来のREST APIエンドポイントの管理コストを削減します。

ただし、外部サービスとの連携や、クライアントサイドからの特定のフェッチ要件（GETリクエストのキャッシュ制御など）のために、一部 REST API エンドポイントも定義します。

### 通信プロトコル
- **Internal**: Server Actions (Remote Procedure Call style)
- **External/Public**: HTTP/1.1 (RESTful style)

### データ形式
- **Request/Response**: JSON
- **Case**: camelCase (Javascript/JSON standard)

## 2. 認証・認可

### 2.1 認証方式
- **Clerk** を使用した認証を行います。
- クライアントサイド: Clerk SDK (`useAuth`, `useUser`)
- サーバーサイド: Clerk SDK (`auth()`, `currentUser()`)
- APIルート / Server Actions 実行時に、セッションの有効性を検証し、未認証の場合は `401 Unauthorized` エラーを返します。

### 2.2 権限管理
- 基本的にユーザーは自身のデータのみ操作可能です。
- データアクセス層（Supabase）で RLS (Row Level Security) を適用し、DBレベルでも権限チェックを行います。

## 3. Server Actions 一覧

これらは `actions/` ディレクトリ配下に定義され、クライアントコンポーネントから直接インポートして呼び出されます。

### 3.1 投稿関連 (Post Actions)

| Action名 | 引数 | 戻り値 | 説明 |
| :--- | :--- | :--- | :--- |
| `analyzePost` | `{ content: string, images?: string[] }` | `{ summary, title, options, tags }` | 投稿内容をAI解析し、プレビュー用の構造化データを返す。保存はしない。 |
| `createPost` | `{ content, aiData, isSos, ... }` | `{ postId, error }` | ユーザーの確認後、投稿データをDBに保存する。 |
| `getPosts` | `{ page, limit, filter }` | `Post[]` | タイムライン用の投稿一覧を取得する。 |
| `deletePost` | `postId` | `void` | 投稿を論理削除する（自身の投稿のみ）。 |

### 3.2 コメント・リアクション関連 (Interaction Actions)

| Action名 | 引数 | 戻り値 | 説明 |
| :--- | :--- | :--- | :--- |
| `addComment` | `{ postId, content }` | `Comment` | 投稿にコメントを追加する。 |
| `toggleLike` | `{ targetId, targetType }` | `{ isLiked, count }` | いいねの状態をトグルし、最新のカウントを返す。 |

### 3.3 ユーザー関連 (User Actions)

| Action名 | 引数 | 戻り値 | 説明 |
| :--- | :--- | :--- | :--- |
| `updateProfile` | `{ nickname, avatarUrl, ... }` | `Profile` | ユーザープロフィールを更新する。 |
| `registerLocation` | `{ lat, lng }` | `void` | 現在地（5kmメッシュ化後）を登録・更新する。 |

## 4. REST API エンドポイント (Route Handlers)

外部システム連携や、単純なデータ取得用（GET）のエンドポイントです。`app/api/` 配下に配置されます。

### 4.1 投稿 API

#### `GET /api/posts`
エリア連動投稿や、特定の条件下での投稿一覧を取得します。

- **Query Parameters**:
    - `lat`: 緯度 (optional)
    - `lng`: 経度 (optional)
    - `radius`: 検索半径 (km) (optional, default: 5)
    - `sos`: `true` の場合、SOS投稿のみフィルタ (optional)
- **Response**:
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "title": "AI Title",
          "summary": "AI Summary...",
          "location": { ... },
          "isSos": true,
          ...
        }
      ],
      "meta": {
        "count": 10,
        "page": 1
      }
    }
    ```

#### `GET /api/health`
ヘルスチェック用エンドポイント。

- **Response**:
    ```json
    {
      "status": "ok",
      "timestamp": "2023-11-25T12:00:00Z"
    }
    ```

## 5. エラーハンドリング

Server Actions および API は、以下の形式でエラーを返却・スローすることを推奨します。

```typescript
type ActionResult<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;    // "UNAUTHORIZED", "VALIDATION_ERROR", "INTERNAL_SERVER_ERROR"
    message: string; // ユーザー表示用のメッセージ
  };
};
```

- クライアント側では、`success: false` の場合に `error.message` をトースト通知などで表示します。
- 予期せぬサーバーエラーは Sentry へ送信します。

