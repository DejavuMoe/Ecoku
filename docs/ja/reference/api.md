# REST API

このページでは Ecoku の HTTP API を一覧にしています。独自のフロントエンドや自動化スクリプトを書くときの参考にしてください。公式のローダーや SDK を使う場合は、これらの API を直接呼び出す必要はありません。

パスはすべてインスタンスのアドレスからの相対パスです。例：`https://ecoku.example.com/api/health`。

## 共通の約束事

### レスポンスの形式

`/api/` 配下の API はすべて JSON を返し、構造は共通です。

```json
{ "code": 200, "message": "Success", "data": { } }
```

`code` は HTTP ステータスコードと同じです。エラーの場合は通常 `data` がなく（テスト通知の失敗は例外です。[通知](#notifications)を参照）、`message` は中国語の説明文になります。例：

```json
{ "code": 403, "message": "来源不属于当前站点" }
```

日時のフィールドは UTC の RFC 3339 文字列です（例：`2026-08-20T12:00:00Z`）。

### ステータスコード

| ステータスコード | 意味 |
| --- | --- |
| `200` / `201` | 成功。コメントとサイトを作成したときは `201` を返します。 |
| `400` | パラメーターまたはリクエストボディが不正、CAPTCHA を通過していない。 |
| `401` | 管理 API でログインしていない、またはセッションが無効。 |
| `403` | オリジンが許可リストにない、または権限がない。 |
| `404` | サイト、コメント、API が存在しない。 |
| `405` | パスは存在するが、そのリクエストメソッドに対応していない。 |
| `409` | 状態の競合：親コメントが別のページに属している、削除済みのコメントに返信した、設定がほかのセッションで変更された、など。 |
| `413` | リクエストボディが上限を超えている。 |
| `422` | コメント一覧が読み込みの上限を超えた、または返信の階層が 16 を超えた。 |
| `429` | レート制限に達した。レスポンスヘッダー `Retry-After` で待つべき秒数を示します。 |
| `502` | テスト通知の送信に失敗した。 |
| `503` | サービスが混雑している、読み込みがタイムアウトした、CAPTCHA サービスが利用できない、管理者セッションのストレージが利用できない、または認証情報の暗号化マスターキーが設定されていない。 |

### クロスオリジンとオリジン

- ブラウザのリクエストに `Origin` がある場合、公開 API はいずれかのサイトの許可オリジンとして登録されたアドレスだけを受け付け、管理 API は `admin.allowed_origins` のアドレスだけを受け付けます。それ以外のオリジンには `403` を返します。
- コメントの投稿には、そのサイトに属する `Origin` が**必須**です。`Origin` のない投稿も拒否されます。
- コメント一覧の読み込みには `Origin` は不要で、サーバー側のスクリプトから直接呼び出せます。

### リクエストボディの上限

コメントの投稿は 80 KiB、管理 API は 16 KiB です。超えると `413` を返します。

## 公開 API

### ヘルスチェック

```http
GET /api/health
```

```json
{ "code": 200, "message": "Success", "data": { "status": "healthy", "timestamp": 1790000000 } }
```

プロセスがリクエストに応答できることを示すだけで、データベースや外部サービスは確認しません。

### コメントを読み込む

```http
GET /api/comment/list?siteId=blog&key=/posts/hello-world/&page=1&pageSize=10&sort=newest
```

| パラメーター | 必須 | 説明 |
| --- | :---: | --- |
| `siteId` | はい | サイト ID。 |
| `key` | はい | ページキー。最大 512 文字。 |
| `page` | いいえ | ルートコメントのページ番号。デフォルトは `1`。 |
| `pageSize` | いいえ | 1 ページあたりのルートコメント数。1～100、デフォルトは `10`。 |
| `sort` | いいえ | `newest` または `oldest`。デフォルトはサイトの設定に従います。 |

現在のページのルートコメントと、**そのすべての返信**を返します。

```json
{
  "code": 200,
  "message": "获取评论成功",
  "data": {
    "data": [
      {
        "id": 101,
        "site_id": "blog",
        "mark": "/posts/hello-world/",
        "parent": 0,
        "username": "张三",
        "url": "https://example.com",
        "content": "这是一条根评论",
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
    "timeZone": "Asia/Shanghai",
    "formConfig": {
      "emailRequired": true,
      "websiteRequired": false,
      "placeholder": "写下评论（仅支持纯文本）",
      "defaultSort": "newest",
      "lengthLimit": 1000,
      "emptyMessage": "还没有评论\n成为第一个留下评论的人。",
      "bloggerBadge": "[博主]",
      "bloggerProofEnabled": true,
      "turnstileSitekey": "",
      "captcha": { "provider": "off", "sitekey": "" },
      "smoji": { "enabled": false, "manifestUrl": "" }
    }
  }
}
```

コメントのフィールド：

| フィールド | 説明 |
| --- | --- |
| `id` | コメント ID。ページ上ではアンカー `#ecoku-comment-{id}` に対応します。 |
| `site_id`、`mark` | サイト ID とページキー。 |
| `parent` | 親コメントの ID。ルートコメントは `0`。 |
| `username` | ニックネーム。削除済みのコメントでは「已删除」（削除済み）で固定です。 |
| `url` | 訪問者の URL。ない場合はこのフィールドを省略します。 |
| `content` | 純テキストの本文。削除済みのコメントでは「[该评论已删除]」（このコメントは削除されました）で固定です。 |
| `isBlogger` | ブロガーのコメントかどうか。 |
| `deleted` | 削除済み（墓標）かどうか。 |

そのほかのフィールド：

| フィールド | 説明 |
| --- | --- |
| `total` | ルートコメントの総数。ページングに使います。 |
| `commentTotal` | ルートコメントからたどれるすべてのコメント数（返信と墓標を含む）。 |
| `pageCount` | 総ページ数。 |
| `timeZone` | サーバー側の表示タイムゾーン（IANA 名）。 |
| `formConfig` | そのサイトのコメントフォームの設定。下表を参照してください。 |

`formConfig` のフィールド：

| フィールド | 説明 |
| --- | --- |
| `emailRequired`、`websiteRequired` | メールアドレス、URL が必須かどうか。 |
| `placeholder`、`emptyMessage` | コメント欄の案内文、コメントがないときの文字。 |
| `defaultSort` | デフォルトの並び順。 |
| `lengthLimit` | 本文の最大文字数（Unicode 文字単位）。 |
| `bloggerBadge` | ブロガーバッジの文字。空文字列は表示しないことを表します。 |
| `bloggerProofEnabled` | サイトでブロガーの合言葉が設定されているかどうか。 |
| `captcha` | 現在の CAPTCHA の方式。`provider` は `off`、`turnstile`、`cap` のいずれかで、`sitekey` は公開用の Site key です。Cap の場合はさらに `instanceUrl` があります。 |
| `turnstileSitekey` | 古いクライアントのために残しています。Turnstile モードのときだけ値があります。 |
| `smoji` | スタンプパックが有効かどうかと、一覧のアドレス。 |

#### 読み込みの上限

1 つの巨大な議論がサービスを圧迫しないよう、リクエストごとに次の上限があります。どれか 1 つでも超えると `422` を返し、切り詰めたデータは返しません。

- コメントは最大 200 件（ルートコメントと返信の合計）
- 返信は最大 16 階層
- レスポンスの JSON は最大 1 MiB
- 総数を数えるときは、同じページについて最大 10,000 件のコメントまで確認

ページのコメント総数が集計の上限を超えている場合は、`pageSize=1` でも失敗します。

さらに、一覧 API が同時に処理するリクエストは最大 4 つで、混雑時は `503` と `Retry-After: 1` を返します。リクエストごとのデータベースの読み込みは 2 秒で打ち切られ、タイムアウトすると `503` を返します。読み込みの頻度は `rate_limit.comment_list` で制限され、デフォルトは IP ごとに 1 分あたり 60 回です。

#### 階層ごとの読み込み {#cursor}

`parentId` を渡すと、API は直接の返信を 1 階層分だけ返すようになり、再帰せず、総数も数えません。独自のフロントエンドで大きな議論を必要に応じて展開するのに向いています。

```http
GET /api/comment/list?siteId=blog&key=/posts/hello-world/&parentId=0&pageSize=20
GET /api/comment/list?siteId=blog&key=/posts/hello-world/&parentId=101&afterId=120&pageSize=20
```

| パラメーター | 説明 |
| --- | --- |
| `parentId` | `0` はルートコメントの読み込み、正の整数はそのコメントの直接の返信（削除済みを含む）の読み込みを表します。 |
| `afterId` | ID がこれより大きいコメントだけを返します。デフォルトは `0`。 |
| `pageSize` | 1～100、デフォルトは `10`。 |

結果は ID の昇順に並びます。`afterId` は `parentId` と一緒に使う必要があります。このモードでは `page` や `sort` を同時に渡せず、渡すと `400` を返します。親コメントが存在しない、またはそのページに属していない場合は `404` を返します。

```json
{
  "code": 200,
  "message": "获取评论成功",
  "data": {
    "data": [ { "id": 121, "parent": 101, "...": "..." } ],
    "parentId": 101,
    "pageSize": 20,
    "hasMore": true,
    "nextAfterId": 140,
    "timeZone": "Asia/Shanghai",
    "formConfig": { }
  }
}
```

`hasMore` が `true` の場合は、`nextAfterId` を次のリクエストの `afterId` として使います。1 MiB のレスポンスの上限はこのモードにも適用され、超えた場合は `pageSize` を小さくして再試行できます。

### コメントを投稿する

```http
POST /api/comment/submit
Content-Type: application/json
Origin: https://blog.example.com
```

```json
{
  "siteId": "blog",
  "mark": "/posts/hello-world/",
  "pageTitle": "你好，世界",
  "parent": 0,
  "username": "张三",
  "email": "zhangsan@example.com",
  "url": "https://example.com",
  "content": "纯文本正文",
  "captchaToken": "..."
}
```

| フィールド | 必須 | 説明 |
| --- | :---: | --- |
| `siteId` | はい | サイト ID。 |
| `mark` | はい | ページキー。サイト内の相対パスで、最大 512 文字。完全な URL は使えず、`?` や `#` も含められません。 |
| `pageTitle` | いいえ | 記事のタイトル。最大 200 文字。通知に使います。 |
| `parent` | いいえ | 返信先のコメント ID。ルートコメントの場合は `0` を渡すか省略します。 |
| `username` | はい | ニックネーム。最大 80 文字。 |
| `email` | サイトの設定による | メールアドレス。最大 254 文字。 |
| `url` | サイトの設定による | URL。`http`/`https` のみ受け付け、最大 2048 文字。 |
| `content` | はい | 本文。サイトの最大文字数を超えてはいけません。 |
| `captchaToken` | 検証が有効な場合 | Turnstile または Cap のウィジェットが返す使い捨ての token。 |

成功すると `201` を返します。

```json
{ "code": 201, "message": "评论提交成功", "data": { "id": 102, "isBlogger": false } }
```

ブロガーとして発言するときは、`username` にブロガーの合言葉を入れ、`email` と `url` は空にします。合言葉が一致すると、サーバーはサイトのブロガーのニックネーム、メールアドレス、サイト URL で保存し、`isBlogger` として `true` を返します。

投稿に関するエラー：

| ステータスコード | 原因 |
| --- | --- |
| `400` | フィールドが不正、CAPTCHA を通過していない（`请完成验证后再发布。`、検証を完了してから投稿してください）、本文に規則に合わない Smoji の記法が含まれている。 |
| `403` | `Origin` がない、またはオリジンがそのサイトに属していない。 |
| `404` | サイトまたは親コメントが存在しない。 |
| `409` | 親コメントが別のページに属している、または親コメントが削除済み。 |
| `413` | リクエストボディが 80 KiB を超えている。 |
| `422` | 返信の階層が 16 を超えた。 |
| `429` | `rate_limit.comment_submit`（デフォルトは IP ごとに 60 秒あたり 5 回）を超えた。 |
| `503` | CAPTCHA サービスが利用できない。 |

## 管理 API

管理 API は `/api/admin/` にあり、`admin.enabled: true` の場合にだけ存在します。

### 認証方式

- **セッション Cookie**：`POST /api/admin/login` が成功すると、サーバーは `ecoku_admin_session` という名前の Cookie（HttpOnly、SameSite=Strict、Path=`/api/admin`、本番環境では Secure 付き）を設定します。有効期間は 8 時間です。ログインのレスポンスには token は含まれません。
- ログインのリクエストと、Cookie で認証する GET 以外のリクエストには、`admin.allowed_origins` に含まれる `Origin` が必要です。
- `Authorization: Bearer <認証情報>` または管理キーで認証するリクエストには `Origin` を付けなくてもかまいません。付けた場合は `admin.allowed_origins` に含まれている必要があり、そうでなければ `403` を返します。Bearer の認証情報は現在有効でログアウトされていないセッションでなければなりません。v0.2.4 より前に発行された古い token は使えません。
- ログインには HTTPS が必要で、HTTP を使えるのはループバックアドレスだけです。

### ログインとセッション

| メソッドとパス | 説明 |
| --- | --- |
| `GET /api/admin/login-config` | ログイン不要。ログインページに必要な CAPTCHA の設定（`captcha`、`turnstileSitekey`）を返します。 |
| `POST /api/admin/login` | リクエストボディは `{"username", "password", "captchaToken"}`。成功すると `{"expires_at", "expires_in"}` を返し、Cookie を設定します。`rate_limit.admin_login` でレート制限されます。 |
| `GET /api/admin/session` | 現在のセッションの `expires_at` と残り秒数 `expires_in` を返します。セッションは延長しません。 |
| `POST /api/admin/logout` | 現在のセッションを無効にし、Cookie を消去します。`503` が返った場合は、ログアウトに成功していません。 |

### サイト

| メソッドとパス | 説明 |
| --- | --- |
| `GET /api/admin/sites` | すべてのサイト。 |
| `POST /api/admin/sites` | サイトを作成します。 |
| `GET /api/admin/sites/:siteId` | 1 つのサイト。 |
| `PUT /api/admin/sites/:siteId` | サイトを更新します。リクエストボディには読み込み時に得た `revision` を含める必要があり、ない場合は `400` を返します。その間にほかのセッションで変更されていた場合は `409` を返します。 |

サイトのフィールド：`id`、`site_url`、`name`、`allowed_origins`、`default_sort`、`email_required`、`website_required`、`placeholder`、`comment_limit`、`empty_message`、`smoji_enabled`、`smoji_manifest_url`、`blogger_nickname`、`blogger_email`、`blogger_badge`、`blogger_passphrase`（書き込み専用）、`revision`。レスポンスでは `blogger_passphrase_set` で合言葉が設定済みかどうかを表し、読み取り専用の `created_at`、`updated_at` も含みます。サイト一覧は `data.data` 配列に、1 つのサイトおよび作成・更新の結果は `data.site` に入ります。

サイトの作成時に ID がすでに存在する場合や、`allowed_origins` が `admin.allowed_origins` と重複する場合は、いずれも `409` を返します。

### コメント

| メソッドとパス | 説明 |
| --- | --- |
| `GET /api/admin/sites/:siteId/comments` | コメント一覧。パラメーター：`status`（`published` または `deleted`、デフォルトは `published`）、`page`（最大 1000000）、`pageSize`（デフォルト 20、最大 100）、`sort`（`newest` または `oldest`、デフォルトは `newest`）。レスポンスには `total`、`pageCount`、状態ごとの件数 `counts` が含まれます。 |
| `GET /api/admin/sites/:siteId/comments/:commentId` | 1 件のコメント。非公開のメールアドレスを含みます。 |
| `DELETE /api/admin/sites/:siteId/comments/:commentId` | 墓標削除。削除済みのコメントをもう一度削除すると成功を返し、`unchanged` が `true` になります。 |
| `DELETE /api/admin/sites/:siteId/comments/:commentId/permanent` | 完全削除。返信のない墓標にだけ使え、それ以外では `409` を返します。 |

2 つの削除 API はどちらも `rate_limit.comment_delete` でレート制限されます。

### CAPTCHA

| メソッドとパス | 説明 |
| --- | --- |
| `GET /api/admin/captcha` | 現在の設定。Secret は返さず、`secret_set` で設定済みかどうかを表します。 |
| `PUT /api/admin/captcha` | 設定を保存します：`provider`（`off`、`turnstile`、`cap`）、`turnstile.sitekey` / `secret`、`cap.instance_url` / `sitekey` / `secret`、`revision`。Secret を空にすると変更しません。 |

`/api/admin/turnstile` は旧版の API で、引き続き使えますが、新しいコードでは `/api/admin/captcha` を使ってください。

### 通知 {#notifications}

| メソッドとパス | 説明 |
| --- | --- |
| `GET /api/admin/notifications` | メールと Telegram の設定。パスワードと Token は返さず、`password_set`、`token_set` で表します。 |
| `PUT /api/admin/notifications/email` | メールの設定を保存します：`enabled`、`host`、`port`、`encryption`（`tls` または `starttls`）、`username`、`password`、`from_address`、`recipients`、`revision`。 |
| `POST /api/admin/notifications/email/test` | リクエスト内の設定でテストメールを送ります。失敗すると `502` を返し、`data.error_code` は `timeout`、`authentication_failed`、`tls_failed`、`delivery_failed` のいずれかです。 |
| `PUT /api/admin/notifications/telegram` | Telegram の設定を保存します：`enabled`、`token`、`targets`、`revision`。 |
| `POST /api/admin/notifications/telegram/test` | テストメッセージを送ります。失敗時は上と同じです。 |

2 つのテスト API は `rate_limit.notification_test` でレート制限されます。

## サイト管理キー {#management-key}

サイト管理キーは、自前の管理システムから規約違反のコメントを削除するような、**信頼できるサーバー側の自動化**のためのものです。ブラウザに置いてはいけません。

1. `app/config.yaml` の `sites` でサイトに `management_key_env` を設定し、`ecoku.env` に対応する環境変数を設定します。値は 32 バイト以上で、サイト間で同じにしてはいけません。[設定リファレンス](./configuration#sites)を参照してください。
2. リクエスト時に次を付けます。

   ```http
   Authorization: EcokuSite <管理キー>
   ```

管理キーでできるのは、所属するサイトのコメントの墓標削除**だけ**です。

```http
DELETE /api/admin/sites/blog/comments/102
Authorization: EcokuSite <管理キー>
```

コメントの一覧や詳細の読み取り、完全削除、ほかのサイトやインスタンス設定へのアクセスはできず、これらのリクエストには `403` を返します。キーが無効な場合は `401` を返します。管理キーを使う場合も `admin.enabled: true` が必要です。

`sites` のサイト設定はデータベースの初回初期化時にしか書き込まれませんが、`management_key_env` は起動のたびに読み込まれます。既存のインスタンスで管理キーを使うには、`sites` にエントリーを 1 つ追加します。`id` は管理画面にある既存のサイトと同じにし、設定の検証を通すために `site_url` と `allowed_origins` も書きます。このエントリーのほかのフィールドが管理画面の設定を上書きすることはありません。
