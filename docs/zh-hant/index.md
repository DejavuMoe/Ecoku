---
layout: home
hero:
  name: Ecoku
  text: 自託管的純文字評論系統
  tagline: 為靜態部落格與個人站點而生。極簡單容器架構，資料全在 SQLite，送出後立即公開。
  image:
    src: /ecoku-hero.png
    alt: Ecoku 示意圖
  actions:
    - theme: brand
      text: 快速開始部署
      link: /zh-hant/self-hosting/docker
    - theme: alt
      text: 核心設計與機制
      link: /zh-hant/guide/concepts
    - theme: alt
      text: 客戶端快速接入
      link: /zh-hant/integration/html

features:
  - title: 送出即發布 · 討論不中斷
    details: 無審核隊列，回覆直達原評論下方；資料層無限巢狀語意，視覺最多 3 級縮排，軟刪除保留墓碑上下文。
    link: /zh-hant/guide/concepts#樹狀評論與分頁模型
  - title: 嚴格隱私邊界 · 零洩漏
    details: 公開 API 絕不返回信箱、IP 或 User-Agent；訪客身分在瀏覽器 IndexedDB 中使用 AES-GCM 本地加密保存 7 天。
    link: /zh-hant/guide/concepts#訪客身分加密儲存
  - title: 單容器極簡拓撲
    details: Go 單二進位同源提供 API、靜態管理後台 (/admin/) 與 SDK 載入器 (/client/)；單 SQLite 檔案 WAL 交易演進。
    link: /zh-hant/guide/introduction#系統架構全景
  - title: 現代化人機驗證
    details: 實例級三態安全切換：關閉、Cloudflare Turnstile 與開源自託管 Cap，配合動態收斂的 CSP 安全防護。
    link: /zh-hant/self-hosting/admin#人機驗證
  - title: 交易一致性非同步通知
    details: Outbox 模式驅動 SMTP（TLS/STARTTLS）與 Telegram 機器人通知，按目標拆行重試，支援站長口令免密認證。
    link: /zh-hant/guide/concepts#outbox-交易一致性通知
  - title: 輕量且靈活的接入
    details: 提供 2KB 極簡 Loader 宣告式嵌入，支援 Hugo PaperMod、原生 HTML 與 Vue/React，具備全套 CSS Design Tokens。
    link: /zh-hant/integration/html
---
