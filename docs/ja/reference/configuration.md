# 設定リファレンス

Ecoku の設定は 2 か所に分かれています。

- `app/config.yaml`：インスタンス単位のパラメーターです。コンテナの起動時に 1 回だけ読み込まれ、読み取り専用でマウントされます。変更を反映するにはコンテナを作り直す必要があります。
- `ecoku.env`：管理者の認証情報、シークレット、タイムゾーンです。Compose の `env_file` で注入されます。

サイト、ブロガー、CAPTCHA、通知の設定はこの 2 つのファイルにはなく、SQLite データベースに保存され、[管理画面](../self-hosting/admin)で変更します。

## 共通ルール

- 設定ファイルに含められる YAML ドキュメントは 1 つだけで、未知のフィールドがあると起動を拒否します。旧バージョンから残った MySQL や一般ユーザーなどのフィールドも起動失敗の原因になります。
- 数値のフィールドに `0` を書くか省略すると、下表のデフォルト値が使われます。
- 表の「デフォルト値」は、フィールドを省略したときにプログラムが使う値です。公式イメージにはポート、ディレクトリ、ログ、データベースのパスが組み込まれている（表では「コンテナ内」と記載）ので、[Docker デプロイ](../self-hosting/docker)では `config.yaml` に通常 `notifications.instance_public_url` だけを書き、リバースプロキシを設定した後に `site.trusted_proxies` を追加します。
- 以前の完全な設定ファイルを削る必要はありません。すでに書いたフィールドは引き続き有効で、[廃止されたフィールド](#retired)も元の標準値のままなら起動できます。

`config.yaml` または `ecoku.env` を変更した後は、次のコマンドでコンテナを作り直します。

```bash
cd ~/Ecoku && sudo docker compose up -d --force-recreate ecoku
```

`docker compose restart` では `ecoku.env` は読み直されません。

## site

| フィールド | デフォルト値 | 説明 |
| --- | --- | --- |
| `port` | `12123` | コンテナ内で待ち受けるポート。範囲は 1～65535。変更した場合は `compose.yaml` のポートマッピングも合わせて変更してください。 |
| `log_path` | 空。コンテナ内は `/var/log/ecoku/ecoku.log` | ログは常に stdout に出力され、`docker compose logs` で確認できます。ファイルパスを指定すると、そのファイルにも 1 部保存します。1 ファイルが 10 MB に達するとローテーションし、圧縮した古いファイルを 5 個、最長 28 日間残します。空、`stdout`、`-`、`/dev/stdout` のいずれかの場合は stdout にだけ出力します。 |
| `trusted_proxies` | `[]` | `X-Forwarded-For` の転送を許可する直接の接続元。IP または CIDR で書きます。通常は `172.18.0.1/32` のような Docker ゲートウェイだけを指定します。`0.0.0.0/0` と `::/0` は禁止です。詳しくは[リバースプロキシ](../self-hosting/reverse-proxy#trusted-proxies)を参照してください。 |

ログには IP、User-Agent、コメント本文、認証情報は含まれません。アクセスログにはルートのテンプレート（例：`/api/admin/sites/:siteId`）だけを記録し、実際のパスパラメーターは記録しません。

## client

| フィールド | デフォルト値 | 説明 |
| --- | --- | --- |
| `static_dir` | 空。コンテナ内は `/app/client` | ブラウザ用リソースのディレクトリ。設定すると、Ecoku は `/client/` で `ecoku-loader.js`、`ecoku.umd.js`、`ecoku.css`、`ecoku.unstyled.css` を提供し、どれか 1 つでも欠けていると起動を拒否します。空の場合はこれらのファイルを提供しません。 |

## rate_limit {#rate-limit}

レート制限はすべてクライアントの IP ごとに数えます。ウィンドウは固定で、状態はプロセスのメモリに保存され、再起動するとリセットされます。上限を超えると `429` と `Retry-After` レスポンスヘッダーを返します。操作の種類ごとのカウントは互いに独立しています。

| フィールド | デフォルト値 | 説明 |
| --- | --- | --- |
| `window_seconds` | `60` | カウントのウィンドウの長さ（秒）。すべての操作で共通です。 |
| `comment_submit` | `5` | 1 ウィンドウあたりに投稿できるコメント数。 |
| `comment_list` | `60` | 1 ウィンドウあたりにコメント一覧を読み込める回数。ブラウザの CORS プリフライトや、オリジンが拒否されたリクエストも数に含まれます。 |
| `comment_delete` | `30` | 1 ウィンドウあたりの削除リクエスト数。ソフト削除と完全削除は別々に数えます。 |
| `admin_login` | `5` | 1 ウィンドウあたりの管理者ログインの試行回数。 |
| `notification_test` | `5` | 1 ウィンドウあたりにテスト通知を送れる回数。テストメールと Telegram のテストメッセージは別々に数えます。 |

レート制限の種類ごとに、同時に追跡する IP は最大 10,000 個です。上限に達すると、古い記録の期限が切れるまで新しい IP は拒否されます。既存の IP の枠が追い出されることはありません。

`trusted_proxies` を正しく設定していないと、リバースプロキシの背後にいるすべての訪問者が同じ IP として数えられ、ここでの枠を共有します。

## notifications

| フィールド | デフォルト値 | 説明 |
| --- | --- | --- |
| `instance_public_url` | 空 | Ecoku の公開 URL（例：`https://ecoku.example.com`）。メールまたは Telegram の通知を有効にする前に必ず設定してください。`admin.allowed_origins` を書いていない場合は、このオリジン（スキーム + ドメイン + 任意のポート）が管理画面のオリジンにもなります。通知内の元記事へのリンクはサイト URL とページのパスから組み立てられ、このアドレスは使いません。 |

## database

| フィールド | デフォルト値 | 説明 |
| --- | --- | --- |
| `sqlite.path` | `./data/ecoku.bin`。コンテナ内は `/data/ecoku.sqlite3` | SQLite データベースファイルのパス。コンテナ内のデフォルト値はホストの `data/ecoku.sqlite3` に対応します。 |

データベースは WAL モードで動作し、実行中は同じディレクトリに `-wal` と `-shm` ファイルがあります。バックアップするときは `data/` ディレクトリ全体を保存する必要があります。

## admin

管理画面と管理 API は常に有効です。

| フィールド | デフォルト値 | 説明 |
| --- | --- | --- |
| `static_dir` | 空。コンテナ内は `/app/admin` | 管理画面のページを置くディレクトリ。設定すると、Ecoku は `/admin/` で管理画面を提供し、`index.html` または `assets/` が欠けていると起動を拒否します。ディレクトリに `favicon.svg` があれば、`/admin/favicon.svg` でタブのアイコンとして提供します。空の場合はページを提供しませんが、管理 API には影響しません。 |
| `allowed_origins` | `notifications.instance_public_url` のオリジン | 管理 API へのアクセスを許可するブラウザのオリジン、つまり管理画面を開いたときのアドレスバーの `スキーム://ドメイン[:ポート]` です。複数のアドレスから管理画面を開く場合だけ設定します。これと `instance_public_url` のどちらかが必要で、どちらもないとサービスは起動しません。 |

Ecoku は起動時にさらに次の点を確認します。

- `ECOKU_ADMIN_USERNAME`、`ECOKU_ADMIN_PASSWORD_HASH`、`ECOKU_ADMIN_TOKEN_KEY` がどれも空ではないこと。
- パスワードハッシュが有効な bcrypt で、cost が 10 以上であること（`hash-password` で生成したハッシュは条件を満たします）。
- 署名キーが 32 バイト以上で、パスワードハッシュやどのサイト管理キーとも同じでないこと。
- `allowed_origins` が `sites` のどのサイトの許可オリジンとも重複しないこと。管理画面でサイトを作成・変更するときも、管理画面のオリジンは使えず、使うと保存に失敗します。

## sites（任意） {#sites}

`sites` は、**まったく新しいデータベースを初めて初期化するとき**にサイトをあらかじめ書き込むためのものです。データベースが一度作成されると、サイトはデータベースの内容が正となり、その後 YAML のサイト設定を変更しても反映されません。サイトは管理画面で管理してください。唯一の例外は `management_key_env` で、起動のたびに読み込まれます。YAML のサイトのエントリーは起動のたびに検証されるので、書き間違えるとやはり起動を拒否します。ほとんどのデプロイではこのセクションを書く必要はありません。

```yaml
sites:
  - id: "blog"
    site_url: "https://blog.example.com"
    name: "我的博客"
    allowed_origins:
      - "https://blog.example.com"
    management_key_env: "ECOKU_BLOG_MANAGEMENT_KEY"
    comment:
      default_sort: "newest"
      email_required: true
      website_required: false
      length_limit: 1000
```

| フィールド | 説明 |
| --- | --- |
| `id` | サイト ID。1～100 文字で、英字または数字で始まり、英字、数字、`.`、`_`、`-` だけを使えます。 |
| `site_url` | サイトの正規 URL。通知内の元記事へのリンクを組み立てるのに使います。`http`/`https` のみで、クエリー文字列やフラグメントは付けられません。省略すると `allowed_origins` の最初の項目を使います。 |
| `name` | サイト名。最大 120 文字。空の場合はドメインを表示します。 |
| `allowed_origins` | コメント欄の埋め込みを許可するオリジン。1 つ以上必要です。 |
| `management_key_env` | 任意。このサイトの管理キーを格納する環境変数の名前です。値は 32 バイト以上で、サイト間で共用できません。管理キーの用途は [REST API](./api#management-key) を参照してください。 |
| `comment.default_sort` | `newest`（デフォルト）または `oldest`。 |
| `comment.email_required` | メールアドレスを必須にするかどうか。デフォルトは `true`。 |
| `comment.website_required` | URL を必須にするかどうか。デフォルトは `false`。 |
| `comment.placeholder` | コメント欄の案内文。最大 80 文字で、改行は使えません。 |
| `comment.length_limit` | 本文の最大文字数。1～10000、デフォルトは 1000。 |
| `comment.empty_message` | コメントがないときに表示する文字。最大 240 文字。 |

## 廃止されたフィールド {#retired}

次のフィールドは廃止され、古い設定ファイルのためだけに残しています。省略するか表の値のままなら通常どおり起動します。それ以外の値を書くと起動を拒否し、削除すべきフィールドをログに示します。新しい設定には書かないでください。

| フィールド | 残してよい値 | 現在の動作 |
| --- | --- | --- |
| `admin.enabled` | `true` | 管理画面は常に有効です。 |
| `admin.token_ttl_minutes` | `480` | セッションはログイン後 8 時間で固定です。 |
| `admin.username_env` | `ECOKU_ADMIN_USERNAME` | 常に表の環境変数を読みます。 |
| `admin.password_hash_env` | `ECOKU_ADMIN_PASSWORD_HASH` | 同上。 |
| `admin.token_key_env` | `ECOKU_ADMIN_TOKEN_KEY` | 同上。 |
| `notifications.encryption_key_env` | `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | 同上。 |

これらの環境変数を別の名前に変えていた場合は、該当するフィールドを削除し、`ecoku.env` の変数名を表の名前に戻してください。

## 環境変数

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `ECOKU_ADMIN_USERNAME` | はい | 管理者のユーザー名。1～80 文字。 |
| `ECOKU_ADMIN_PASSWORD_HASH` | はい | 管理者パスワードの bcrypt ハッシュ。`hash-password` コマンドで生成します。[コマンドライン](./cli#hash-password)を参照してください。 |
| `ECOKU_ADMIN_TOKEN_KEY` | はい | セッションの署名キー。32 バイト以上。`openssl rand -hex 32` で生成できます。 |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | 認証情報を保存する場合 | Base64 エンコードした 32 バイトのキー（パディングの有無は問いません）。`openssl rand -base64 32` で生成できます。 |
| `TZ` | いいえ | コメントの日時を表示するタイムゾーン。`Asia/Shanghai` のような IANA 名です。設定しない場合や名前が無効な場合はコンテナのシステムのタイムゾーンにフォールバックし、それも認識できない場合は `Asia/Shanghai` を使います。明示的に設定することをおすすめします。 |
| サイト管理キー | いいえ | 変数名は `sites[].management_key_env` で決まります（例：`ECOKU_BLOG_MANAGEMENT_KEY`）。このフィールドを設定した場合は値が必須で、32 バイト以上必要です。 |

bcrypt ハッシュに含まれる `$` が Compose に展開されないよう、`ecoku.env` の各値はシングルクォートで囲むことをおすすめします。記入例と生成コマンドは [Docker デプロイ](../self-hosting/docker#env)を参照してください。

イメージ内ではすでに `GIN_MODE=release` と `ECOKU_RUNTIME=container`（上記の「コンテナ内」のデフォルト値を有効にします）が設定されています。`ecoku.env` で変更しないでください。

`ECOKU_ADMIN_TOKEN_KEY` またはパスワードハッシュを変更してコンテナを作り直すと、ログイン中のすべての管理者セッションが無効になります。

`ECOKU_NOTIFICATION_ENCRYPTION_KEY` は気軽に変更できません。データベースに保存済みの認証情報は古いキーで暗号化されているため、キーを替えると Ecoku は復号できず、起動時にエラーで終了します。
