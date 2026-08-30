# 特性

## 評論

- 純文字，送出後立即公開，沒有審核佇列。
- 回覆寫在被回覆評論下方；資料層可無限巢狀，介面縮排最多三級。
- 根評論分頁，目前頁帶上該批根評論的全部公開回覆。
- 可按最新或最早排序。
- 刪除保留佔位（墓碑），不拆散討論串；墓碑不可再回覆。
- 可選啟用 Smoji 表情包；選擇器按需載入同源清單，表情以純文字標記保存。

## 身分與隱私

- 暱稱必填；信箱與網站是否必填由站點設定（預設信箱必填、網站可選）。
- 訪客身分在瀏覽器 IndexedDB 中加密保存 7 天，不寫入 localStorage、Cookie 或 URL。
- 公開介面不回傳信箱、IP、User-Agent、地區或金鑰。

## 管理與通知

- `/admin/` 設定站點、評論、部落客身分、通知和人機驗證。
- 部落客由暱稱與信箱共同匹配，可顯示部落客標記；啟用時用口令證明身分。
- 通知支援 SMTP 與 Telegram；規則與渠道設定見 [後台設定](/zh-hant/self-hosting/admin#通知)。
- 人機驗證按執行個體選擇關閉、Cloudflare Turnstile 或自託管 Cap；啟用後同時保護評論送出與管理員登入。

## 資料與接入

- 僅 SQLite；多站點；schema 原位順序遷移。
- 資源：`/client/ecoku-loader.js`、`/client/ecoku.umd.js`、`/client/ecoku.css`、`/client/ecoku.unstyled.css`。
- 接入需要服務位址、站點 ID、穩定的頁面 key，以及可選的頁面標題。詳見 [通用 HTML](/zh-hant/integration/html)。
