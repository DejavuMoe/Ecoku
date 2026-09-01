# 概要とシステム構成

Ecoku は、静的ブログやドキュメントサイトのために設計された**セルフホスト対応のマルチサイト純テキストコメントシステム**です。

肥大化した審査キューや複雑なユーザー管理、外部トラッキングサービスを排除し、シングルコンテナ + SQLite3 の極小構成で提供されます。コメントは投稿後、セキュリティ検証を経てその場で公開されます。

---

## 設計思想

- **極小シングルコンテナ**：単一の Go バイナリが REST API、静的管理画面（`/admin/`）、ブラウザ SDK（`/client/`）を同時に提供。データは単一の SQLite3 ファイルで管理。
- **純テキストコミュニケーション**：コメント本文は HTML や Markdown として解釈されず、XSS 攻撃を根本から防止。
- **投稿後即時公開**：手動審査による遅延をなくし、IP レート制限、ブロガー合言葉、最新 CAPTCHA（Turnstile / Cap）で安全性を維持。
- **プライバシー保護**：公開 API はメールアドレス、IP、User-Agent、地域情報を返しません。訪問者情報は IndexedDB に AES-GCM 暗号化で 7 日間のみ保持。
- **トランザクショナルなスキーマ移行**：バージョン管理された SQLite マイグレーション（v1〜v7）により、単一トランザクションで安全にアップグレード。

---

## システム構成概要

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
