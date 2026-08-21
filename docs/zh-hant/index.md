---
layout: home
hero:
  name: Ecoku
  text: 自託管的純文字評論
  tagline: 多站點、SQLite、Docker Compose。送出即發布，不把信箱和訪客軌跡暴露給公共介面。
  image:
    src: /ecoku-hero.png
    alt: 連接評論串與自託管資料的 Ecoku 插圖
  actions:
    - theme: brand
      text: Docker 部署
      link: /zh-hant/self-hosting/docker
    - theme: alt
      text: 查看特性
      link: /zh-hant/guide/features
features:
  - title: 送出即發布
    details: 沒有審核佇列。根評論與回覆在被回覆處完成，討論串無限層級，視覺縮進最多三級。
  - title: 隱私預設關閉
    details: 公共介面不返回信箱、IP、UA 或管理欄位。訪客身份只在瀏覽器 IndexedDB 中加密保存 7 天。
  - title: 一個容器
    details: 精確版本鏡像、SQLite 原位遷移、本機反代 HTTPS。管理端與評論 SDK 同源提供。
  - title: 通知可去重
    details: SMTP（TLS/STARTTLS）與 Telegram。博主口令證明身份；服務端按固定矩陣投遞，後台不展示判定表。
---
