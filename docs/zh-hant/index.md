---
layout: home
hero:
  name: Ecoku
  text: 自託管，多站點<br>專注文字討論
  tagline: 給部落格與個人網站的評論系統。訪客無需註冊，評論送出即公開，資料由你保管。
  image:
    src: /logo.svg
    alt: Ecoku 標誌
  actions:
    - theme: brand
      text: 開始部署
      link: /zh-hant/self-hosting/docker
    - theme: alt
      text: 認識 Ecoku
      link: /zh-hant/guide/introduction
    - theme: alt
      text: 嵌入評論區
      link: /zh-hant/integration/html

features:
  - title: 送出即公開
    details: 無審核佇列。回覆就地展開，刪除保留墓碑，討論上下文始終連貫。
    link: /zh-hant/guide/concepts#threads
  - title: 不記錄訪客 IP
    details: 僅儲存暱稱、正文與訪客填寫的信箱和網址；公開 API 不回傳信箱，不記錄訪客 IP 與 User-Agent。瀏覽器本機加密記住身分 7 天。
    link: /zh-hant/guide/concepts#data
  - title: 單容器獨立執行
    details: Go 單一二進位整合 API、後台與嵌入腳本；SQLite 儲存業務資料，金鑰獨立持久化。冷備資料目錄、設定與 Compose 即可還原。
    link: /zh-hant/guide/introduction#components
  - title: 多站點支援
    details: 單一實例服務多個網站，各站點獨立設定來源白名單、表單欄位、限制規則與部落客身分。
    link: /zh-hant/self-hosting/admin#sites
  - title: 通知與人機驗證
    details: 新評論即時透過電子郵件或 Telegram 通知部落客；支援 Cloudflare Turnstile 與自託管 Cap 防止灌水。
    link: /zh-hant/self-hosting/notifications
  - title: 一段 HTML 即可接入
    details: 適用於 Hugo、Hexo、Astro 等靜態站點與 Vue、React 單頁應用程式；支援透過 CSS 變數自訂樣式。
    link: /zh-hant/integration/html
---
