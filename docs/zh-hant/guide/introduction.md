# 簡介與系統架構

Ecoku 是一個專為靜態部落格與內容驅動型站點設計的**自託管、多站點純文字評論系統**。

它摒棄了繁重的審核隊列、複雜的使用者中心與外部依賴，以單容器 + SQLite3 的極致輕量化形態交付。評論一旦送出，通過安全檢查後立即面向公眾呈現。

---

## 核心設計哲學

- **極簡拓撲**：單個 Docker 容器同時託管 Go API、靜態管理後台（`/admin/`）與瀏覽器 SDK（`/client/`），資料單檔案落盤於 SQLite3，無附加 Redis/MySQL 依賴。
- **純文字交流**：正文永不解析 HTML 或 Markdown，杜絕 XSS 注入風險，回歸評論討論的本質。
- **送出即公開**：無前置人工審核隊列，依靠 IP 頻控限流、站長口令與現代化人機驗證（Turnstile / Cap）維護討論秩序。
- **強隱私邊界**：公共 API 絕不輸出信箱、IP、User-Agent、地區或資料庫內部 ID；訪客身分僅在本地 IndexedDB 加密保存 7 天。
- **交易性升級**：Schema 原位版本化演進（v1～v7），單向遷移，杜絕破壞性重構。

---

## 系統架構全景

```
+----------------------------------------------------------------------------------------------------+
|                                    Client Layer (Browser / Web)                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ Visitor Page / Static Blog ]                      [ Admin Console: /admin/ ]                    |
|  - ecoku-loader.js (2KB Standalone)                  - Vue 3 + Pinia + System Serif                |
|  - Ecoku SDK (ESM / UMD / CJS)                       - Memory-only Bearer Token (No Storage)       |
|  - WebCrypto AES-GCM (IndexedDB 7-Day TTL)           - Multi-Site & Security Configuration         |
|  - Smoji Sticker Lazy Loader (smoji.json)            - Comment Tombstone & Purge Management        |
|                                                                                                    |
+---------------------------------+----------------------------------+-------------------------------+
                                  | HTTPS REST Requests              |
                                  v                                  v
+----------------------------------------------------------------------------------------------------+
|                                    Edge / Reverse Proxy Layer                                      |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ Caddy / Nginx / CDN ]                                                                           |
|  - SSL / TLS Termination                                                                           |
|  - Forward to 127.0.0.1:12123                                                                      |
|  - Overwrite X-Forwarded-For with {remote_host} / CF-Connecting-IP                                 |
|                                                                                                    |
+-------------------------------------------------+--------------------------------------------------+
                                                  | Local TCP Connection
                                                  v
+----------------------------------------------------------------------------------------------------+
|                                    Ecoku Single Container Runtime                                  |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ Go 1.24 HTTP Core (Gin Engine) ]                                                                |
|  ├── In-Memory Rate Limiter (Socket Peer IP / Trusted Proxies)                                     |
|  ├── Dynamic CSP Policy Engine (Cap / Turnstile Converged Policy)                                  |
|  ├── Captcha Siteverify Client (Turnstile API / Self-Hosted Cap Endpoint)                          |
|  ├── Admin Auth Guard (Bcrypt Hash + HMAC Credential-Versioned Token)                              |
|  └── Outbox Notification Worker (Single-Instance Polling & Exponential Backoff)                    |
|       ├── SMTP Mailer (TLS / STARTTLS)                                                             |
|       └── Telegram Bot Client                                                                      |
|                                                                                                    |
|  [ Storage Layer: SQLite3 (WAL Mode) ]                                                             |
|  - /data/ecoku.sqlite3 (Strict Foreign Keys, In-Place Schema Migrations v1~v7)                     |
|  - AES-256-GCM Credential Encryption (SMTP Passwords / Bot Tokens / Captcha Secrets)               |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```
