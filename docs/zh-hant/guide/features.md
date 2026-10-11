# 功能

依使用者分組列出 Ecoku 目前版本（v0.5.0）的功能，每一項末尾的連結指向詳細說明。

## 訪客

- 無需註冊，填寫暱稱、信箱和網址即可發言；信箱與網址的必填性由站點設定決定（預設信箱必填、網址選填）。 [訪客身分](./concepts#visitor-identity)
- 在任一則評論下就地回覆，缺少的身分資訊直接在回覆框內補填。
- 瀏覽器本地加密記住身分 7 天，不使用 Cookie。
- 發布前支援即時預覽；字數以 Unicode 字元計算，一個漢字計為一個字元。
- 支援在最新、最早兩種排序之間切換。
- 支援摺疊冗長的討論分支。
- 站點啟用貼圖包後，可插入 Smoji 貼圖。 [Smoji 貼圖包](../integration/smoji)

## 部落客

- 在評論區暱稱欄輸入口令，即可按部落客身分發布並顯示部落客標誌。 [部落客身分](./concepts#blogger)
- 新評論與新回覆即時透過電子郵件或 Telegram 通知。 [通知](../self-hosting/notifications)
- 訪客評論收到回覆時，自動向被回覆者寄送電子郵件通知。

## 管理員

- 單一實例註冊並管理多個站點，各自獨立設定允許來源、預設排序、必填欄位、字數上限與提示文字。 [管理後台](../self-hosting/admin#sites)
- 依「已發布 / 已刪除」篩選評論流，可直達原文所在位置。
- 墓碑刪除保留上下文結構；無後代的墓碑可徹底刪除。 [刪除](./concepts#deletion)
- 在關閉、Cloudflare Turnstile、自託管 Cap 三種人機驗證之間切換，同時保護評論與後台登入。 [人機驗證](../self-hosting/captcha)
- 支援從 Twikoo 匯入歷史評論。 [從 Twikoo 遷移](../self-hosting/twikoo)

## 接入

- 一段 HTML 加一個腳本即可嵌入，適用於各種靜態網站產生器。 [HTML 接入](../integration/html)
- 在 Vue、React 等單頁應用程式中切換文章時，評論區跟隨切換。 [JavaScript SDK](../integration/sdk)
- 提供 Hugo PaperMod 主題的現成範本。 [Hugo PaperMod](../integration/hugo)
- 預設樣式透過 CSS 變數調整顏色、圓角和字級；亦可使用結構樣式或完全自寫樣式。 [自訂樣式](../integration/custom-css)
- 自動繼承頁面的淺色與深色模式。

## 維運

- 單一 Docker 容器執行，採用非 root 使用者與唯讀檔案系統。 [Docker 部署](../self-hosting/docker)
- 停服備份資料目錄、持久金鑰與設定檔即可完整儲存狀態。 [備份與還原](../self-hosting/backup)
- 升級時資料庫自動循序遷移，既有業務資料原位保留。 [升級](../self-hosting/upgrade)
- 基於 IP 進行記憶體速率限制，支援位於反向代理與 CDN 之後。 [反向代理](../self-hosting/reverse-proxy)
- 通知透過資料庫 Outbox 佇列非同步投遞，失敗自動重試，不阻塞評論送出。

## 隱私

- 不持久化或記錄訪客 IP、User-Agent 與地理位置。 [儲存和公開的資料](./concepts#data)
- 信箱不會出現在任何公開 API 中。
- SMTP 密碼、Bot Token 與人機驗證金鑰在資料庫中加密儲存，管理端不回顯明文。
- 評論區前端不請求任何第三方大頭貼、統計分析或 IP 查詢服務。
