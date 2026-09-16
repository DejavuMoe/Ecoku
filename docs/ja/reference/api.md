# REST API リファレンス

Ecoku は、訪問者向けの**公開コメント API**と管理者向けの**管理コンソール API**に分かれた、整然とした RESTful HTTP インターフェースを提供します。

---

## 共通仕様とステータスコード

- **レスポンス形式**：すべてのエンドポイントは `application/json; charset=utf-8` を返します。
- **タイムスタンプ**：ISO 8601 UTC 形式（例: `2026-08-20T12:00:00Z`）。
- **標準 HTTP ステータスコード**：
  - `200 OK`：リクエスト成功。
  - `201 Created`：リソース作成成功。
  - `400 Bad Request`：パラメーターの検証不合格または不正。
  - `401 Unauthorized`：認証情報なし、または 管理者セッションの有効期限切れ。
  - `403 Forbidden`：リクエスト Origin がサイトのホワイトリストに未登録。
  - `404 Not Found`：対象サイト、親コメント、またはリソースが存在しない。
  - `422 Unprocessable Entity`：リソース上限超過（200 ノード、16 階層、集計 10,000 件、1 MiB JSON）。
  - `429 Too Many Requests`：単一 IP のインメモリレート制限超過（`Retry-After` ヘッダーを含む）。
  - `503 Service Unavailable`：サーバー混雑（4 つのワーカースロットが満杯）または DB 読み取りタイムアウト（2 秒）。

---

## 1. 公開エンドポイント（Public Endpoints）

### ヘルスチェック `GET /api/health`
- **メソッド**：`GET`
- **認証**：不要
- **レスポンス例 (HTTP 200)**：
  ```json
  {
    "code": 200,
    "message": "success",
    "data": {
      "status": "healthy",
      "timestamp": 1756700000
    }
  }
  ```

---

### コメント一覧取得 `GET /api/comment/list`
既定ではルートコメントごとにページングされた完全なコメントツリーを返します。成功レスポンスは `data.data`、ルート数 `total`、到達可能コメント数 `commentTotal`、`page/pageSize/pageCount`、`formConfig`、サーバーの `timeZone` を保持します。

完全スレッドモードは最大 **200 ノード、子孫 16 階層**（ルート深さ 0）まで。件数集計で調べる ID と親の組み合わせは同一サイト/ページで最大 **10,000 件**までです。いずれかの予算を超過した場合は、不完全なツリーや概算数を返すことなく、厳格に **422 Unprocessable Entity** を返します。ページ全体の総記録数が 10,000 件を超える場合は `pageSize=1` でも失敗します。現行 SDK は標準の読み込み失敗状態を表示し、自動でモードを切り替えません。

必要な階層のみを読み取る場合は、明示的に `parentId` を指定します：`0` はルートノードのみを取得し、正の整数はその親コメントの直接の子（同一サイト/ページの墓標を含む）のみを取得します。`afterId`（既定 0）を指定して **ID 昇順**のカーソルページングを行い、`pageSize` は既定 10、最大 100。このモードでは `page` や `sort` は併用できません。子孫の再帰展開や総数集計は行わず、レスポンス `data` には `data`（コメント配列）、`parentId`、`pageSize`、`hasMore`、`nextAfterId`、`formConfig`、`timeZone` が含まれます。`hasMore: true` の場合のみ `nextAfterId` を使用して次のバッチを取得します。親が存在しないか範囲外なら 404、不正なパラメーターは 400 です。

```http
GET /api/comment/list?siteId=blog&key=/posts/example/&parentId=0&pageSize=20
GET /api/comment/list?siteId=blog&key=/posts/example/&parentId=101&afterId=120&pageSize=20
```

両モードともエスケープを含む完全な JSON の上限は **1 MiB** です。超過時は 422 となり、`pageSize` を減らして再試行できます。一覧処理は **同時 4 件**の枠を共有し、データベース読み取り期限は **2 秒**です。混雑時は 503 と `Retry-After: 1`、期限切れ時は 503 を返します。コメント集計と子孫読み取りは同一の SQLite スナップショットで実行されます。[読み取りレート制限](../self-hosting/configuration.md)は既定で IP ごとに 60 秒間に 60 回、超過時は 429 と `Retry-After` を返します。

- **クエリパラメーター**：
  - `siteId` (string, 必須)：サイトの一意な識別子。
  - `key` (string, 必須)：サイト内相対パス。
  - `page` (number, 任意)：ルートコメントのページ番号（既定 1）。
  - `pageSize` (number, 任意)：1 ページあたりのルートコメント数（既定 10、最大 100）。
  - `sort` (string, 任意)：並べ替え順序。`newest`（既定）または `oldest`。
  - `parentId` (number, 任意)：単層カーソルモードの有効化。`0` でルート、正の整数で特定親の子。
  - `afterId` (number, 任意)：カーソルページングのアンカー ID。

- **完全スレッドレスポンス例 (HTTP 200)**：
  ```json
  {
    "code": 200,
    "message": "获取评论成功",
    "data": {
      "data": [
        {
          "id": 101,
          "site_id": "blog",
          "mark": "/posts/example/",
          "parent": 0,
          "username": "田中",
          "url": "https://example.com",
          "content": "これは親コメントです",
          "isBlogger": false,
          "deleted": false,
          "created_at": "2026-08-20T12:00:00Z",
          "updated_at": "2026-08-20T12:00:00Z"
        }
      ],
      "total": 1,
      "commentTotal": 1,
      "page": 1,
      "pageSize": 10,
      "pageCount": 1,
      "timeZone": "Asia/Tokyo",
      "formConfig": {
        "emailRequired": true,
        "websiteRequired": false,
        "placeholder": "コメントを書く（純テキストのみ）",
        "defaultSort": "newest",
        "lengthLimit": 1000,
        "emptyMessage": "まだコメントはありません。\n最初のコメントを投稿しましょう。",
        "bloggerBadge": "[管理者]",
        "bloggerProofEnabled": true,
        "turnstileSitekey": "example-sitekey",
        "captcha": {
          "provider": "turnstile",
          "sitekey": "example-sitekey"
        },
        "smoji": {
          "enabled": false,
          "manifestUrl": ""
        }
      }
    }
  }
  ```

- **カーソルモードレスポンス例 (HTTP 200、parentId 指定時)**：
  ```json
  {
    "code": 200,
    "message": "获取评论成功",
    "data": {
      "data": [
        {
          "id": 105,
          "site_id": "blog",
          "mark": "/posts/example/",
          "parent": 101,
          "username": "佐藤",
          "content": "これはコメント 101 への返信です",
          "isBlogger": false,
          "deleted": false,
          "created_at": "2026-08-20T12:05:00Z",
          "updated_at": "2026-08-20T12:05:00Z"
        }
      ],
      "parentId": 101,
      "pageSize": 20,
      "hasMore": true,
      "nextAfterId": 105,
      "timeZone": "Asia/Tokyo",
      "formConfig": {
        "emailRequired": true,
        "websiteRequired": false,
        "placeholder": "コメントを書く（純テキストのみ）",
        "defaultSort": "newest",
        "lengthLimit": 1000,
        "emptyMessage": "まだコメントはありません。\n最初のコメントを投稿しましょう。",
        "bloggerBadge": "[管理者]",
        "bloggerProofEnabled": true,
        "turnstileSitekey": "example-sitekey",
        "captcha": {
          "provider": "turnstile",
          "sitekey": "example-sitekey"
        },
        "smoji": {
          "enabled": false,
          "manifestUrl": ""
        }
      }
    }
  }
  ```

---

### コメント投稿 `POST /api/comment/submit`
新しいルートコメントの投稿または既存コメントへの返信。リクエストボディ上限は **80 KiB** です。

- **リクエストボディ (JSON)**：
  ```json
  {
    "siteId": "blog",
    "mark": "/posts/hello-world/",
    "pageTitle": "こんにちは世界",
    "parent": 0,
    "username": "田中",
    "email": "tanaka@example.com",
    "url": "https://example.com",
    "content": "純テキストのコメント本文",
    "captchaToken": "0.xxxxxx"
  }
  ```

- **レスポンス例 (HTTP 201 Created)**：
  ```json
  {
    "code": 201,
    "message": "评论提交成功",
    "data": {
      "id": 102,
      "isBlogger": false
    }
  }
  ```

- **ブロガー合言葉投稿**：
  サイトにブロガー合言葉が設定されている場合、`username` に合言葉を入力し、`email` と `url` を空にして送信することで、サーバー側で自動的にブロガー身元が認証されバッジが付与されます。

---

新規返信は最大 16 階層の子孫（ルート = 0）です。17 階層目は 422 となり、上位コメントへの返信を案内します。既存の深いスレッドとインポート済みデータは変更しません。200 ノード、1 MiB JSON、10,000 ノード集計などの読み取り予算は維持します。

## 2. 管理用エンドポイント（Admin Endpoints）

管理画面はログイン応答の HttpOnly Cookie と同一オリジンのリクエストを使用します。ログイン JSON に token は含みません。ログインと Cookie 認証の更新操作には `admin.allowed_origins` に一致する `Origin` が必要です。復元 GET は Origin を省略できます。信頼された自動化は Cookie jar を使用できます。`Authorization: Bearer` も新方式で登録済みかつ未失効のセッション認証情報が必要で、旧ステートレストークンは拒否します。`EcokuSite` のサイト内墓標化権限は変更しません。

管理 API の更新リクエスト本文は **16 KiB** までです。

### セッション復元とログアウト

- `GET /api/admin/session`：元の `expires_at` と残りの `expires_in` を返し、期限延長や認証情報の返却は行いません。無効・期限切れは 401、ストレージ障害は 503 です。
- `POST /api/admin/logout`：現在のセッションを失効させ Cookie を削除します。成功は 200、書き込み失敗は 503 であり、ログアウト完了と扱えません。両方ともインスタンス管理者専用です。

### 管理者ログイン `POST /api/admin/login`
- **リクエストボディ**：
  ```json
  {
    "username": "admin",
    "password": "my-strong-password",
    "captchaToken": "0.xxxxxx"
  }
  ```
- **レスポンス例 (HTTP 200)**：
  ```json
  {
    "code": 200,
    "message": "Success",
    "data": {
      "expires_at": "2026-08-20T20:00:00Z",
      "expires_in": 28800
    }
  }
  ```

### ログイン設定取得 `GET /api/admin/login-config`
管理画面ログインフォームに必要なボット対策の公開設定とパラメーターを取得（未認証でアクセス可能）。

### サイト管理インターフェース
- `GET /api/admin/sites`：登録済み全サイトの一覧と設定を取得。
- `POST /api/admin/sites`：新規サイトの登録（`id`、`site_url`、`name`、`allowed_origins` など）。
- `GET /api/admin/sites/:siteId`：指定サイトの設定詳細を取得。
- `PUT /api/admin/sites/:siteId`：指定サイトの設定を更新（楽観的ロック `revision` をサポート）。

### セキュリティおよびボット対策インターフェース
- `GET /api/admin/captcha`：現在のボット対策 3 態設定を取得（パスワード等はマスク）。
- `PUT /api/admin/captcha`：ボット対策設定を更新（無効 / Turnstile / Cap）。

### 通知チャネル管理インターフェース
- `GET /api/admin/notifications`：SMTP メールおよび Telegram 通知の設定を取得。
- `PUT /api/admin/notifications/email`：メール通知設定を更新（SMTP パスワードはマスターキーで AES-256-GCM 暗号化保存）。
- `POST /api/admin/notifications/email/test`：テストメールを送信して SMTP 疎通性を確認。
- `PUT /api/admin/notifications/telegram`：Telegram Bot 設定を更新。
- `POST /api/admin/notifications/telegram/test`：テスト Telegram メッセージを送信。

### コメント管理インターフェース
- `GET /api/admin/sites/:siteId/comments`：公開中・削除済みを跨ぐ管理用コメント検索・一覧。
- `GET /api/admin/sites/:siteId/comments/:commentId`：コメントの詳細とツリー文脈の取得。
- `DELETE /api/admin/sites/:siteId/comments/:commentId`：墓標論理削除（個人情報を消去し、ツリー構造を維持）。
- `DELETE /api/admin/sites/:siteId/comments/:commentId/permanent`：**子返信を一切持たない**孤立した墓標コメントの物理完全削除。
