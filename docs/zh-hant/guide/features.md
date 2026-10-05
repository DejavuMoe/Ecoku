# 功能

依使用者分組列出 Ecoku 目前版本（v0.3.4）的功能。每一項後面的連結指向詳細說明。

## 訪客

- 不用註冊，填寫暱稱、信箱和選填的網址即可發言；信箱和網址是否必填由站點決定。[訪客身分](./concepts#visitor-identity)
- 在任一則評論下直接回覆，回覆框就地展開，缺少的身分資訊在回覆框裡補填。
- 瀏覽器加密記住身分 7 天，不使用 Cookie。
- 發布前可以預覽；字數以 Unicode 字元計算，一個漢字算一個。
- 在最新、最早兩種排序之間切換。
- 摺疊冗長的討論分支。
- 站點啟用貼圖包後，可以插入 Smoji 貼圖。[Smoji 貼圖包](../integration/smoji)

## 部落客

- 在評論區的暱稱欄輸入口令，即以部落客身分發布，並顯示部落客標誌。[部落客身分](./concepts#blogger)
- 新評論、新回覆透過電子郵件或 Telegram 通知。[通知](../self-hosting/notifications)
- 訪客被回覆時，自動寄送電子郵件通知對方。

## 管理員

- 一個實例註冊多個站點，各自設定允許來源、預設排序、必填欄位、字數上限、提示文字。[管理後台](../self-hosting/admin#sites)
- 依「已發布 / 已刪除」瀏覽評論，一鍵跳到原文位置。
- 墓碑刪除保留討論結構；沒有回覆的墓碑可以徹底刪除。[刪除](./concepts#deletion)
- 在關閉、Cloudflare Turnstile、自託管 Cap 三種人機驗證之間切換，同時保護評論與後台登入。[人機驗證](../self-hosting/captcha)
- 從 Twikoo 匯入歷史評論。[從 Twikoo 遷移](../self-hosting/twikoo)

## 接入

- 一段 HTML 加一個腳本即可嵌入，適用於任何靜態網站。[HTML 接入](../integration/html)
- 在 Vue、React 等單頁應用程式中切換文章時，評論區會跟著切換。[JavaScript SDK](../integration/sdk)
- 提供 Hugo PaperMod 主題的現成範本。[Hugo PaperMod](../integration/hugo)
- 預設樣式可透過 CSS 變數調整顏色、圓角和字級；也可以只用結構樣式，或完全自己撰寫。[自訂樣式](../integration/custom-css)
- 跟隨頁面的淺色與深色模式。

## 維運

- 單一 Docker 容器，以非 root、唯讀檔案系統執行。[Docker 部署](../self-hosting/docker)
- 停服備份整個資料目錄、持久金鑰和設定。[備份與還原](../self-hosting/backup)
- 升級時資料庫自動遷移，既有資料原地保留。[升級](../self-hosting/upgrade)
- 依 IP 進行速率限制，支援放在反向代理和 CDN 後面。[反向代理](../self-hosting/reverse-proxy)
- 通知透過資料庫佇列非同步寄送，失敗時自動重試，不影響評論送出。

## 隱私

- 不儲存訪客 IP、User-Agent 或地理位置。[儲存和公開的資料](./concepts#data)
- 信箱不會出現在任何公開 API 中。
- SMTP 密碼、Bot Token、人機驗證金鑰加密後存入資料庫，後台只顯示「已设置」。
- 評論區不請求第三方大頭貼、統計或 IP 查詢服務。
