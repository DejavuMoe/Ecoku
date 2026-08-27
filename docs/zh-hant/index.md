---
layout: home
hero:
  name: Ecoku
  text: 自託管的純文字評論
  tagline: Docker 部署，資料放 SQLite。一個執行個體服務多個站點，評論送出後立即公開。
  image:
    src: /ecoku-hero.png
    alt: Ecoku 示意圖
  actions:
    - theme: brand
      text: Docker 部署
      link: /zh-hant/self-hosting/docker
    - theme: alt
      text: 特性說明
      link: /zh-hant/guide/features
features:
  - title: 送出即公開
    details: 沒有審核佇列。回覆寫在原評論下方，可多層巢狀。
  - title: 公開介面不含隱私欄位
    details: 不返回信箱、IP、UA。訪客身份只在瀏覽器 IndexedDB 加密保存 7 天。
  - title: 單個容器
    details: 固定鏡像版本，資料掛在主機。管理端與評論 SDK 由同一服務提供。
  - title: 郵件與 Telegram
    details: 可選 SMTP 或 Telegram 通知。博主可用口令證明身份。
---
