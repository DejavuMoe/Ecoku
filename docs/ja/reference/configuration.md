# 設定リファレンス

このページは次のバージョンに対応します。既存のインスタンスは[設定の移行](../self-hosting/upgrade#unreleased-config)を確認してください。

Ecoku の設定は 2 か所に分かれています。

- `app/config.yaml`：インスタンス単位のパラメーターです。コンテナの起動時に 1 回だけ読み込まれ、読み取り専用でマウントされます。変更を反映するにはコンテナを作り直す必要があります。
- `ecoku.env`：管理者の認証情報、シークレット、タイムゾーンです。Compose の `env_file` で注入されます。

サイト、ブロガー、CAPTCHA、通知の設定はこの 2 つのファイルにはなく、SQLite データベースに保存され、[管理画面](../self-hosting/admin)で変更します。 イメージ内の待ち受けポート `12123`、ブラウザーのリソース `/app/client`、管理画面 `/app/admin`、データベース `/data/ecoku.sqlite3` は固定されており、YAML では設定できません。

## 共通ルール

- 設定ファイルに含められる YAML ドキュメントは 1 つだけです。未知のフィールドがあると起動を拒否し、ログに行番号を示します。
- 数値のフィールドに `0` を書くか省略すると、下表のデフォルト値を使います。
- [Docker デプロイ](../self-hosting/docker)では、通常 `config.yaml` に `notifications.instance_public_url` を書き、リバースプロキシ設定後に `site.trusted_proxies` を追加します。

`config.yaml` または `ecoku.env` を変更した後は、次のコマンドでコンテナを作り直します。

```bash
cd ~/Ecoku && sudo docker compose up -d --force-recreate ecoku
```

`docker compose restart` では `ecoku.env` は読み直されません。

## site

| フィールド | デフォルト値 | 説明 |
| --- | --- | --- |
| `trusted_proxies` | `[]` | `X-Forwarded-For` の転送を許可する直接の接続元。IP または CIDR で書きます。通常は `172.18.0.1/32` のような Docker ゲートウェイだけを指定します。`0.0.0.0/0` と `::/0` は禁止です。詳しくは[リバースプロキシ](../self-hosting/reverse-proxy#trusted-proxies)を参照してください。 |

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

## admin

管理画面と管理 API は常に有効です。イメージは `/admin/` で管理画面を提供します。

| フィールド | デフォルト値 | 説明 |
| --- | --- | --- |
| `allowed_origins` | `notifications.instance_public_url` のオリジン | 管理 API へのアクセスを許可するブラウザのオリジン、つまり管理画面を開いたときのアドレスバーの `スキーム://ドメイン[:ポート]` です。複数のアドレスから管理画面を開く場合だけ設定します。これと `instance_public_url` のどちらかが必要で、どちらもないとサービスは起動しません。 |

Ecoku は起動時にさらに次の点を確認します。

- `ECOKU_ADMIN_USERNAME`、`ECOKU_ADMIN_PASSWORD_HASH`、`ECOKU_ADMIN_TOKEN_KEY` がどれも空ではないこと。
- パスワードハッシュが有効な bcrypt で、cost が 10 以上であること（`hash-password` で生成したハッシュは条件を満たします）。
- 署名キーは 32 バイト以上で、パスワードハッシュとは異なること。

サイトを作成・変更するとき、許可オリジンが管理画面のオリジンと同じだと保存に失敗します。

## ログ {#logs}

ログは標準出力に書き込み、`docker compose logs` で確認します。保存期間とローテーションは Docker のログ設定で管理します。IP、User-Agent、コメント本文、認証情報は含めません。アクセスログには `/api/admin/sites/:siteId` などのルートテンプレートだけを記録し、実際のパスパラメーターは記録しません。

## 環境変数 {#env}

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `ECOKU_ADMIN_USERNAME` | はい | 管理者のユーザー名。1～80 文字。 |
| `ECOKU_ADMIN_PASSWORD_HASH` | はい | 管理者パスワードの bcrypt ハッシュ。`hash-password` コマンドで生成します。[コマンドライン](./cli#hash-password)を参照してください。 |
| `ECOKU_ADMIN_TOKEN_KEY` | はい | セッションの署名キー。32 バイト以上。`openssl rand -hex 32` で生成できます。 |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | 認証情報を保存する場合 | データベースの SMTP パスワード、Telegram Bot Token、CAPTCHA Secret Key を暗号化します。Base64 エンコードした 32 バイトのキー（パディングの有無は任意）を `openssl rand -base64 32` で生成できます。 |
| `TZ` | いいえ | コメントの日時を表示するタイムゾーン。`Asia/Shanghai` のような IANA 名です。設定しない場合や名前が無効な場合はコンテナのシステムのタイムゾーンにフォールバックし、それも認識できない場合は `Asia/Shanghai` を使います。明示的に設定することをおすすめします。 |

bcrypt ハッシュに含まれる `$` が Compose に展開されないよう、`ecoku.env` の各値はシングルクォートで囲むことをおすすめします。記入例と生成コマンドは [Docker デプロイ](../self-hosting/docker#env)を参照してください。

イメージには `GIN_MODE=release` と `ECOKU_RUNTIME=container` が設定されています。`ecoku.env` で変更しないでください。

`ECOKU_ADMIN_TOKEN_KEY` またはパスワードハッシュを変更してコンテナを作り直すと、ログイン中のすべての管理者セッションが無効になります。

`ECOKU_NOTIFICATION_ENCRYPTION_KEY` は気軽に変更できません。データベースに保存済みの認証情報は古いキーで暗号化されているため、キーを替えると Ecoku は復号できず、起動時にエラーで終了します。
