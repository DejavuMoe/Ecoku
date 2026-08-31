# 設定リファレンス

`app/config.yaml` および `ecoku.env` の詳細仕様。

`rate_limit.comment_list` は IP ごとの公開一覧読み取り回数です。既定は `window_seconds` の期間（既定 60 秒）に 60 回。両モードは同じ枠を共有し、他の操作は別枠です。超過時は 429 と `Retry-After` を返します。各リミッターの有効アドレス枠は最大 10,000 件で、満杯の場合は期限切れまで新規アドレスを拒否します。既存の `trusted_proxies` 設定に従い、信頼されていないプロキシ経由の訪問者はその IP の枠を共有します。

一覧の受付制限は CORS クエリより前に実行され、プリフライトや拒否された Origin も回数に含まれます。早期拒否では未検証のクロスオリジン許可を追加しないため、ブラウザーには読み込み失敗のみが表示される場合があります。キャンセル後に SQLite 接続が再作成されても、外部キー、同期レベル、ビジータイムアウトの設定は再適用されます。

---

## 設定ファイル `app/config.yaml`

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
  instance_public_url: "https://comments.example.com"

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
    - "https://comments.example.com"
```

---

## 環境変数 `ecoku.env`

| 変数名 | 必須 | 説明 | 例 / ツール |
| :--- | :---: | :--- | :--- |
| `GIN_MODE` | いいえ | Gin エンジン動作モード | `release` |
| `TZ` | いいえ | IANA タイムゾーン | `Asia/Tokyo` |
| `ECOKU_ADMIN_USERNAME` | はい | 管理者ユーザー名 | `admin` |
| `ECOKU_ADMIN_PASSWORD_HASH` | はい | パスワードの bcrypt ハッシュ | `ecoku-server hash-password` で生成 |
| `ECOKU_ADMIN_TOKEN_KEY` | はい | トークン署名鍵（32文字以上） | `openssl rand -hex 32` |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | はい | AES-256-GCM マスター暗号化鍵 | `openssl rand -base64 32` |
