# 設定字典與環境變數參考

提供 `app/config.yaml` 與 `ecoku.env` 的完整欄位參考。

`rate_limit.comment_list` 控制每個 IP 的公開列表讀取次數，預設每個 `window_seconds` 視窗 60 次（視窗預設 60 秒）。兩種列表模式共用同一額度，其他操作使用獨立額度。超限回傳 429 與 `Retry-After`。每個限流器最多保留 10,000 個活躍位址桶，額滿時拒絕新位址，過期後釋放。沿用 `trusted_proxies` 規則；反向代理未受信任時，訪客共用代理 IP 的額度。

列表保護在 CORS 查詢前執行，預檢與被拒絕來源也計入讀取額度。提前拒絕不添加未經驗證的跨域許可，因此跨域瀏覽器可能只顯示載入失敗。取消交易後若 SQLite 重建連線，外鍵、同步級別與忙等待設定會自動重新套用。

---

## 設定檔 `app/config.yaml`

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

## 環境變數 `ecoku.env`

| 變數名 | 必填 | 說明 | 範例 / 工具 |
| :--- | :---: | :--- | :--- |
| `GIN_MODE` | 否 | Gin 引擎模式 | `release` |
| `TZ` | 否 | IANA 時區 | `Asia/Taipei` |
| `ECOKU_ADMIN_USERNAME` | 是 | 管理員使用者名稱 | `admin` |
| `ECOKU_ADMIN_PASSWORD_HASH` | 是 | 管理員密碼 bcrypt 哈希 | 由 `ecoku-server hash-password` 產生 |
| `ECOKU_ADMIN_TOKEN_KEY` | 是 | Bearer Token 簽名金鑰 | `openssl rand -hex 32` |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | 是 | 敏感憑證 AES-256-GCM 主加密金鑰 | `openssl rand -base64 32` |
