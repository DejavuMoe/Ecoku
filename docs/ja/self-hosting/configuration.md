# 設定リファレンス

表の既定値はコードのフォールバックです。例の `/app/client`、`/app/admin`、`/data/ecoku.sqlite3` と `ECOKU_*` 名は配備テンプレートの明示設定です。更新時は既存値を維持してください。

本ページでは、`app/config.yaml` 設定ファイルおよび `ecoku.env` 環境変数の全項目リファレンスと技術仕様を提供します。

`rate_limit.comment_list` は IP ごとの公開一覧読み取り回数を制御し、既定は `window_seconds` の期間（既定 60 秒）に 60 回です。両方の表示モード（フラット一覧・ネスト階層）は同じ枠（バケット）を共有し、他の操作は独立した枠を使用します。超過時は 429 エラーと `Retry-After` ヘッダーを返します。各リミッターの有効アドレス枠は最大 10,000 件で、満杯の場合は期限切れまで新規アドレスを拒否します。既存の `trusted_proxies` 設定に従い、信頼されていないプロキシ経由の訪問者はそのプロキシ IP の枠を共有します。

一覧の受付制限は CORS クエリより前に実行され、プリフライト（OPTIONS）や拒否された Origin も回数に含まれます。早期拒否では未検証のクロスオリジン許可を追加しないため、ブラウザーには読み込み失敗のみが表示される場合があります。キャンセル後に SQLite 接続が再作成されても、外部キー制約、同期レベル、ビジータイムアウトの設定は自動的に再適用されます。

---

## 設定ファイル `app/config.yaml`

コンテナ起動時に読み取り専用（`:ro`）でマウントされる `app/config.yaml` は、サービスの待受ポート、保存パス、レート制限ルール、各モジュールの基本パラメーターを定義します。

```yaml
site:
  port: 12123
  log_path: "/var/log/ecoku/ecoku.log"
  trusted_proxies:
    - "172.18.0.1/32"

client:
  static_dir: "/app/client"

rate_limit:
  window_seconds: 60
  comment_submit: 5
  comment_list: 60
  comment_delete: 30
  admin_login: 5
  notification_test: 5

notifications:
  encryption_key_env: "ECOKU_NOTIFICATION_ENCRYPTION_KEY"
  instance_public_url: "https://ecoku.example.com"

database:
  sqlite:
    path: "/data/ecoku.sqlite3"

admin:
  enabled: true
  static_dir: "/app/admin"
  username_env: "ECOKU_ADMIN_USERNAME"
  password_hash_env: "ECOKU_ADMIN_PASSWORD_HASH"
  token_key_env: "ECOKU_ADMIN_TOKEN_KEY"
  token_ttl_minutes: 480
  allowed_origins:
    - "https://ecoku.example.com"
```

### 設定項目の詳細説明

#### 1. `site` 基本サービス設定
| 設定項目 | 型 | 必須 | 既定値 | 説明 |
| :--- | :--- | :---: | :--- | :--- |
| `port` | 整数 | いいえ | `12123` | サービスが内部で待ち受けるポート。 |
| `log_path` | 文字列 | いいえ | `""` | ログ出力先パス。空、`stdout`、または `-` の場合は標準出力のみに出力。ファイルパスを指定した場合はプロセス内で自動ローテーション保存。 |
| `trusted_proxies` | 文字列リスト | いいえ | `[]` | 信頼するリバースプロキシの IP または CIDR のリスト（Docker ゲートウェイ `172.18.0.1/32` など）。一致する接続元のみ `X-Forwarded-For` を解析。 |

#### 2. `client` 静的アセット
| 設定項目 | 型 | 必須 | 既定値 | 説明 |
| :--- | :--- | :---: | :--- | :--- |
| `static_dir` | 文字列 | いいえ | `""` | ブラウザー SDK およびローダーの静的ファイルが存在するディレクトリ。 |

#### 3. `rate_limit` レート制限
すべての制限ルールは単一プロセスのメモリ内で固定ウィンドウ方式で動作します：
| 設定項目 | 型 | 必須 | 既定値 | 説明 |
| :--- | :--- | :---: | :--- | :--- |
| `window_seconds` | 整数 | いいえ | `60` | レート制限のタイムウィンドウ（秒）。 |
| `comment_submit` | 整数 | いいえ | `5` | ウィンドウ期間内に単一 IP が投稿可能な最大コメント数。 |
| `comment_list` | 整数 | いいえ | `60` | ウィンドウ期間内に単一 IP が読み取り可能な最大公開一覧取得回数（両モード共有）。 |
| `comment_delete` | 整数 | いいえ | `30` | ウィンドウ期間内に単一 IP が実行可能な最大削除リクエスト数。 |
| `admin_login` | 整数 | いいえ | `5` | ウィンドウ期間内に単一 IP が試行可能な最大管理画面ログイン回数。 |
| `notification_test`| 整数 | いいえ | `5` | ウィンドウ期間内に単一 IP が実行可能な最大通知テスト送信回数。 |

#### 4. `notifications` 通知サービス
| 設定項目 | 型 | 必須 | 既定値 | 説明 |
| :--- | :--- | :---: | :--- | :--- |
| `encryption_key_env` | 文字列 | いいえ | `""` | 通知または CAPTCHA の認証情報を保存するためのマスターキー環境変数名。これらの機能を使用しない場合は省略できます。 |
| `instance_public_url` | 文字列 | いいえ | `""` | 通知有効時に必要です。現在リンク生成には使わず、記事リンクはサイトの `site_url` とコメントの `mark` から生成します。 |

#### 5. `database` データベース
| 設定項目 | 型 | 必須 | 既定値 | 説明 |
| :--- | :--- | :---: | :--- | :--- |
| `sqlite.path` | 文字列 | いいえ | `./data/ecoku.bin` | SQLite3 ファイルの相対・絶対パス。省略時は `./data/ecoku.bin`、コンテナのテンプレートは `/data/ecoku.sqlite3` を使用します。 |

#### 6. `admin` 管理コンソール
| 設定項目 | 型 | 必須 | 既定値 | 説明 |
| :--- | :--- | :---: | :--- | :--- |
| `enabled` | 真偽値 | いいえ | `false` | 管理コンソールを有効にするか。本番運用時は `true` に設定必須。 |
| `static_dir` | 文字列 | いいえ | `./admin` | 管理画面の静的 HTML/JS アセットディレクトリ。 |
| `username_env` | 文字列 | 管理者機能有効時 | `""` | 管理者ユーザー名が格納された環境変数名。 |
| `password_hash_env` | 文字列 | 管理者機能有効時 | `""` | 管理者パスワードの bcrypt ハッシュが格納された環境変数名。 |
| `token_key_env` | 文字列 | 管理者機能有効時 | `""` | Bearer トークンの HMAC 署名鍵が格納された環境変数名。 |
| `token_ttl_minutes` | 整数 | いいえ | `480` | 互換キー。省略または `480` を推奨します。ログインから固定 8 時間で、期限延長はありません。 `0` も既定値の `480` として扱われます。 |
| `allowed_origins` | 文字列リスト | 管理者機能有効時 | `[]` | 管理 API へのアクセスを許可する完全な Origin リスト（プロトコル・ホスト必須）。 |

#### 7. `sites` 初期シードサイト（任意）
データベースの**初回初期化時**にのみシードとして投入されます。初期化後はデータベース側が正規情報となるため、管理画面からいつでも追加・変更が可能です：
| 設定項目 | 型 | 必須 | 説明 |
| :--- | :--- | :---: | :--- |
| `id` | 文字列 | はい | サイトの一意な識別子（英数字始まり、正規表現 `^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$`）。 |
| `site_url` | 文字列 | はい | 正規サイト URL（例: `https://blog.example.com`）。 |
| `name` | 文字列 | いいえ | サイト表示名（空の場合はドメイン名に自動フォールバック）。 |
| `allowed_origins` | 文字列リスト | はい | コメント API の呼び出しを許可するフロントエンドの完全な Origin リスト。 |
| `management_key_env` | 文字列 | いいえ | コメント削除 API の外部自動化用独立認証キー環境変数名（32文字以上、サイト間で共有不可）。 |
| `comment` | オブジェクト | いいえ | コメントフォームの既定ルール（`placeholder`, `default_sort`, `length_limit`, `empty_message`, `email_required`, `website_required`）。 |

---

## 環境変数 `ecoku.env`

Docker Compose の `env_file` によってコンテナに注入され、すべての重要機密情報を保持します：

| 変数名 | 必須 | セキュリティ制約 | 説明・生成方法 |
| :--- | :---: | :--- | :--- |
| `GIN_MODE` | いいえ | 本番環境では `release` に固定 | Gin エンジンの動作モード。 |
| `TZ` | いいえ | 標準 IANA タイムゾーン識別子 | 例: `Asia/Tokyo`, `UTC`。 |
| `ECOKU_ADMIN_USERNAME` | はい | 1〜80文字の英数記号 | 管理者ログインユーザー名。 |
| `ECOKU_ADMIN_PASSWORD_HASH` | はい | 有効な bcrypt ハッシュ値 | `ecoku-server hash-password` コマンドで生成。 |
| `ECOKU_ADMIN_TOKEN_KEY` | はい | 最低32文字のランダム文字列 | 管理者 Bearer トークンの HMAC 署名鍵（`openssl rand -hex 32`）。 |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | はい | Base64 エンコードされた 32 バイト文字列 | データベース機密フィールド用の AES-256-GCM マスター暗号化鍵（`openssl rand -base64 32`）。 |
