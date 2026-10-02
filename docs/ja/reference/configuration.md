# 設定リファレンス

::: info アップグレードと設定移行
このページは v0.2.9 に対応します。既存の v0.2.8 インスタンスは先に[アップグレードと旧設定の移行](../self-hosting/upgrade#legacy-config)を確認してください。
:::

新規デプロイで手動設定するのは `app/config.yaml` だけです。

```yaml
notifications:
  instance_public_url: "https://ecoku.example.com"
```

サイト、コメント、通知、CAPTCHA、管理者アカウントは SQLite に保存され、[管理画面](../self-hosting/admin)で変更します。公式イメージのポートは `12123`、ブラウザーリソースは `/app/client`、管理画面は `/app/admin`、データベースは `/data/ecoku.sqlite3` に固定されています。新規インスタンスの署名キー、通知暗号化マスターキー、管理者アカウントも `data/` に保存します。

## site

| フィールド | デフォルト値 | 説明 |
| --- | --- | --- |
| `trusted_proxies` | `[]` | `X-Forwarded-For` を転送できる直接の接続元。IP または CIDR で指定します。通常は Docker ゲートウェイだけを指定します。`0.0.0.0/0` と `::/0` は禁止です。[リバースプロキシ](../self-hosting/reverse-proxy#trusted-proxies)を参照してください。 |

## rate_limit {#rate-limit}

レート制限はクライアント IP ごとにプロセスのメモリで数え、再起動すると消去します。超過時は `429` と `Retry-After` を返します。

| フィールド | デフォルト値 | 説明 |
| --- | --- | --- |
| `window_seconds` | `60` | 計数ウィンドウの秒数。 |
| `comment_submit` | `5` | ウィンドウ内に投稿できるコメント数。 |
| `comment_list` | `60` | ウィンドウ内に読めるコメント一覧の回数。 |
| `comment_delete` | `30` | ウィンドウ内に実行できる削除回数。 |
| `admin_login` | `5` | ウィンドウ内のログイン試行回数。 |
| `notification_test` | `5` | ウィンドウ内のテスト通知回数。 |

## notifications

| フィールド | デフォルト値 | 説明 |
| --- | --- | --- |
| `instance_public_url` | 空 | Ecoku の公開 URL。`admin.allowed_origins` を省略した場合は、この URL のオリジンが管理画面のオリジンにもなります。通知を有効にする前に設定してください。 |

## admin

管理画面と管理 API は常に有効で、画面は `/admin/` です。

| フィールド | デフォルト値 | 説明 |
| --- | --- | --- |
| `allowed_origins` | `instance_public_url` のオリジン | 管理 API にアクセスできるブラウザーのオリジン。複数のアドレスから開く場合だけ設定します。少なくとも 1 つ必要です。 |

新規インスタンスでは起動時に `admin` とランダムな仮パスワードを作成します。仮パスワードはアカウント作成時だけログに出し、初回ログイン後に変更します。新しい管理者アカウントに環境変数は不要です。

## ログ {#logs}

ログは標準出力に書き込み、`docker compose logs` で確認します。保存とローテーションは Docker が管理します。新規デプロイでは `app/logs` をマウントせず、`site.log_path` も使いません。

## 環境変数 {#env}

新規デプロイでは `ecoku.env` は不要です。表示タイムゾーンを指定する場合だけ、Compose に任意の `TZ` を追加します。

既存インスタンスの更新時は、次の変数を読み取り、`data/ecoku-secrets.json` または `admin_accounts` に移行します。

| 変数 | 用途 |
| --- | --- |
| `ECOKU_ADMIN_USERNAME` | 旧管理者名。 |
| `ECOKU_ADMIN_PASSWORD_HASH` | 旧管理者の bcrypt ハッシュ。 |
| `ECOKU_ADMIN_TOKEN_KEY` | 旧セッション署名キー。 |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | 保存済み通知と CAPTCHA 認証情報の暗号化マスターキー。移行完了まで変更しないでください。 |

インポートと検証が成功したら、サービスを停止してバックアップを作成し、環境変数を削除できます。以後は `/data` の永続状態を使います。

## 旧設定フィールド {#legacy}

新しいテンプレートには書きませんが、互換層は `site.port`、`site.log_path`、`client.static_dir`、`admin.static_dir`、`database.sqlite.path`、`sites`、`management_key_env`、`admin.enabled`、`admin.token_ttl_minutes`、管理者・通知の `*_env` を読み取ります。新しいインスタンスには追加しないでください。[アップグレード](../self-hosting/upgrade#legacy-config)を参照してください。
