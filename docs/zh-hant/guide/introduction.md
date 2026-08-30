# 簡介

Ecoku 是自託管的多站點純文字評論系統。一個執行個體可服務多個站點，評論送出後立即公開。

適合靜態部落格、文件站，以及希望把評論資料留在自己伺服器上的個人站點。生產環境使用 Docker Compose 與 SQLite3。

目前只發布 Docker 映像，不公開散佈原始碼。

## 適合什麼

- 為多個站點提供評論區。
- 訪客用暱稱、信箱和可選網站發表評論與回覆。
- 可選郵件或 Telegram 通知；可從 Twikoo 一次性匯入歷史評論。
- 可用 Cloudflare Turnstile 或自託管 Cap 做人機驗證。

## 不提供什麼

評論正文是純文字，不解析 HTML 或 Markdown。沒有頭像、按讚、富文本、一般使用者帳戶、按站點審核佇列或 MySQL。

管理員憑據和站點 management key 不得放入瀏覽器、URL 或頁面 markup。

## 怎麼跑

一個非 root 容器同時提供 API、管理端 `/admin/` 和評論前端 `/client/`。預設只綁定宿主機 `127.0.0.1:12123`，公網存取交給 HTTPS 反向代理。

站點、表單與通知在管理端設定，保存在 SQLite。首次部署見 [Docker 部署](/zh-hant/self-hosting/docker)，頁面接入見 [通用 HTML](/zh-hant/integration/html)。
