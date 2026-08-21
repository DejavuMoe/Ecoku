# 專案介紹

Ecoku 是面向自託管場景的多站點純文字評論系統。一個實例可以掛多個站點；評論送出後立即公開。

它適合靜態部落格、文件站，以及不想把評論交給第三方 SaaS 的個人站點。生產部署只支援 Docker Compose + SQLite3。

## 做什麼

- 訪客評論：暱稱必填；信箱與網站是否必填由站點配置。
- 無限語義層級回覆；公開列表按根討論串分頁。
- 刪除保留墓碑，後代回覆仍在。
- 實例級管理員：站點、評論、通知、機器人驗證。
- 瀏覽器 SDK：鏡像同源 `/client/ecoku-loader.js`。
- 可選：SMTP / Telegram 通知、Twikoo 首次匯入、Cloudflare Turnstile 或自託管 Cap。

## 不做什麼

純文字正文，不解釋 HTML 或 Markdown。沒有頭像、讚踩、富文本、普通使用者註冊、按站點審核，也不提供 MySQL。

管理金鑰和站點 management key 不得放進瀏覽器、URL 或頁面 markup。

## 運行形態

一個非 root 容器同時提供 API、管理端 `/admin/` 和評論前端。連接埠綁在宿主機 `127.0.0.1:12123`，公網走本機 Caddy 或 Nginx。

資料在容器外：

| 路徑 | 用途 |
| --- | --- |
| `app/config.yaml` | 公開配置（連接埠、日誌、可信代理、管理端來源） |
| `ecoku.env` | 管理員憑據、通知加密主金鑰、時區 |
| `data/` | SQLite 主庫與 WAL |
| `app/logs/` | 可選檔案日誌副本 |

站點、評論表單和通知渠道由管理端寫入 SQLite。YAML 裡的 `sites` 只在空庫首次初始化時匯入。

## 版本

容器版本以倉庫根 `VERSION` 為準，Git tag 為 `v` + 該值。`compose.yaml` 使用精確鏡像 tag，不要用 `latest`。

下一步：[特性](/zh-hant/guide/features) 或 [Docker 部署](/zh-hant/self-hosting/docker)。
