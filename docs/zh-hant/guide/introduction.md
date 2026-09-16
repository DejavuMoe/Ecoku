# 簡介與系統架構

Ecoku 是一個專為靜態部落格與內容驅動型站點設計的**自託管、多站點純文字評論系統**。

它摒棄了繁重的審核隊列、複雜的使用者中心與外部依賴，以單容器 + SQLite3 的極致輕量化形態交付。評論一旦送出，通過安全檢查後立即面向公眾呈現。

---

## 核心設計哲學

- **極簡拓撲**：單個 Docker 容器同時託管 Go API、靜態管理後台（`/admin/`）與瀏覽器 SDK（`/client/`），資料單檔案落盤於 SQLite3，無附加 Redis/MySQL 依賴。
- **純文字交流**：正文永不解析 HTML 或 Markdown，杜絕 XSS 注入風險，回歸評論討論的本質。
- **送出即公開**：無前置人工審核隊列，依靠 IP 頻控限流、站長口令與現代化人機驗證（Turnstile / Cap）維護討論秩序。
- **強隱私邊界**：公共 API 絕不輸出信箱、IP、User-Agent、地區或資料庫內部 ID；訪客身分僅在本地 IndexedDB 加密保存 7 天。
- **交易性升級**：Schema 原位版本化演進（v1～v8），單向遷移，杜絕破壞性重構。

---

## 系統架構全景

```mermaid
flowchart TD
    subgraph Client["🌐 客戶端層 (Browser / Web)"]
        direction LR
        Visitor["📱 部落格訪客接入<br/>• 極簡載入器 (ecoku-loader.js)<br/>• 原生 SDK (ESM / UMD / CJS)<br/>• 身分憑據本地加密 7 天 (IndexedDB)<br/>• Smoji 輕量純文字表情包按需載入"]
        Admin["💻 管理後台 (/admin/)<br/>• Vue 3 + Pinia + 系統襯線字型棧<br/>• HttpOnly Cookie + SQLite 可撤銷會話<br/>• 多站點配置 / 安全人機驗證管理<br/>• 評論軟刪除墓碑與物理徹底清除"]
    end

    subgraph Edge["🛡️ 邊界反代層 (Reverse Proxy)"]
        Proxy["Caddy / Nginx / CDN<br/>• HTTPS / SSL 憑證自動申請與終結<br/>• 客戶端真實 IP 識別與透傳 (防標頭偽造)<br/>• 本地 TCP 連線轉發至 127.0.0.1:12123"]
    end

    subgraph Runtime["📦 Ecoku 單容器運行環境 (10001:10001)"]
        direction TB
        subgraph Core["Go 1.24 HTTP 核心引擎"]
            direction LR
            Engine["⚡ Gin HTTP 核心服務<br/>• 處理程序內 IP 頻控限流 (Rate Limiter)<br/>• 動態收斂 CSP 安全策略 (Turnstile / Cap)<br/>• 人機驗證 Siteverify 遠端校驗<br/>• 管理員 Bcrypt 會話鑑權與版本控制"]
            Outbox["📬 Outbox 非同步通知工作協程<br/>• 單實例輪詢機制與指數退避重試<br/>• SMTP 郵件通知 (TLS / STARTTLS)<br/>• Telegram Bot 機器人訊息推送<br/>• 站長口令免密身分識別與通知去重"]
        end
        Storage["💾 SQLite3 儲存引擎 (WAL 模式)<br/>• /data/ecoku.sqlite3 (嚴格外部鍵約束 · 原位版本遷移 v1~v8)<br/>• AES-256-GCM 敏感欄位落盤加密 (SMTP 密碼 / Bot Token / 驗證碼 Secret)"]
        Core --> Storage
    end

    Visitor -->|HTTPS REST| Proxy
    Admin -->|HTTPS REST| Proxy
    Proxy -->|127.0.0.1:12123| Engine
    Engine -.->|寫入待發任務| Outbox
```

---

## 適用場景與產品邊界

### 適合什麼

- **多站點統一託管**：單個 Ecoku 實例可同時為多個獨立網域或子站點提供隔離的評論服務。
- **靜態部落格與文件站**：完美適配 Hugo、Hexo、Astro、VitePress、Next.js、SvelteKit 等現代靜態網站產生器。
- **重視隱私的個人創作者**：將評論資料完全掌握在自己的伺服器上，不依賴第三方雲端或閉源服務。
- **彈性的人機防護**：支援在純粹 IP 限流、Cloudflare Turnstile 與完全自託管的 Cap 驗證碼之間自由切換。

### 不提供什麼

為了保持極簡與純粹，Ecoku 明確將以下特性排除在產品範圍之外：

- ❌ **富文字與 Markdown 渲染**：評論正文永久按純文字處理，不渲染圖片標籤（除規範的 Smoji 表情外）、不解析 HTML。
- ❌ **普通使用者註冊與登入系統**：訪客無需註冊帳號，僅以暱稱、私有信箱和可選網站發表。
- ❌ **按讚、倒讚、表態與頭像服務**：不請求任何第三方 Gravatar / IP / 分析服務，減少外部網路依賴與追蹤。
- ❌ **前置審核隊列**：所有合規評論即發即顯，管理者透過軟刪除墓碑進行事後治理。
- ❌ **MySQL / PostgreSQL 適配**：專注 SQLite3 的單機高可靠性，不維護多資料庫驅動相容層。

---

## 部署概覽

Ecoku 映像檔採用非 root 使用者（`10001:10001`）運行，對外僅監聽本地回環 `127.0.0.1:12123`。

1. **準備環境**：配置 `compose.yaml`、`app/config.yaml` 與 `ecoku.env`。
2. **反向代理**：透過 Caddy 或 Nginx 配置網域與 HTTPS 憑證並反代至本地埠。
3. **管理後台**：訪問 `/admin/` 完成站點註冊、站長口令與通知配置。
4. **頁面接入**：在部落格模板中引入 `ecoku-loader.js` 即可完成接入。

詳細部署指引請參閱 [Docker 部署](/zh-hant/self-hosting/docker)。
