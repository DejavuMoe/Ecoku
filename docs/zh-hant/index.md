---
layout: home
hero:
  name: Ecoku
  text: 自託管的<br>純文字評論系統
  tagline: 給靜態部落格和個人網站使用。一個 Docker 容器，一個 SQLite 檔案，評論送出即公開。
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
    details: 沒有審核佇列。回覆在被回覆的評論下方展開，刪除時保留墓碑，討論上下文不會中斷。
    link: /zh-hant/guide/concepts#threads
  - title: 不蒐集訪客資訊
    details: 不儲存 IP 和 User-Agent，公開 API 不回傳信箱。訪客身分只在瀏覽器中加密保存 7 天。
    link: /zh-hant/guide/concepts#data
  - title: 一個容器，一個檔案
    details: 一個 Go 程式同時提供 API、管理後台和嵌入腳本，全部資料都在一個 SQLite 檔案中。
    link: /zh-hant/guide/introduction#components
  - title: 多站點
    details: 一個實例服務多個網站，每個站點有獨立的來源白名單、評論設定和部落客身分。
    link: /zh-hant/self-hosting/admin#sites
  - title: 通知與人機驗證
    details: 新評論透過電子郵件或 Telegram 通知部落客；可選用 Cloudflare Turnstile 或自託管的 Cap 防止灌水。
    link: /zh-hant/self-hosting/notifications
  - title: 一段 HTML 即可接入
    details: 適用於 Hugo、Hexo、Astro 等任何靜態網站，也支援 Vue、React 單頁應用程式；樣式可用 CSS 變數調整。
    link: /zh-hant/integration/html
---
