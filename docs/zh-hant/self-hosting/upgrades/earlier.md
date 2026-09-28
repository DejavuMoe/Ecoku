# 更早的候選版本

以下 `v0.1.0-rc.*` 版本可能仍出現在早期實例的 `compose.yaml` 中。升級方法見[升級](../upgrade)。跨 schema 回滾都需要用冷備份還原。

## v0.1.0-rc.8 ～ rc.10

- rc.8 寫入 schema v3 和 v4：評論的部落客標誌，以及 `turnstile_settings` 資料表。
- rc.9 修正 Turnstile `api.js` 與 `turnstile.ready()` 的衝突。
- rc.10 調整評論區文案與版面配置。

時區改為讀取 `ecoku.env` 中的 `TZ='<IANA 时区>'`，加上後重建容器即可，不用修改 `config.yaml`。

從 rc.7 升級到 rc.8 前必須備份。已寫入 v3/v4 的資料庫不能直接換回 rc.7。

## v0.1.0-rc.7

接入程式碼改用 `data-ecoku-*` 屬性，外層 ID 改為 `ecoku-comments` / `ecoku-mount`。載入器暫時仍能辨識舊的 `#tcomment`。schema 仍為 v2。

## v0.1.0-rc.6

日誌一律寫到 stdout；`log_path` 指向檔案時另外保存一份。schema 仍為 v2。

## v0.1.0-rc.5

schema v1 → v2：站點增加部落客暱稱和信箱。SDK 在 IndexedDB 中加密保存訪客身分 7 天。

## v0.1.0-rc.3

主機目錄調整為 `app/config.yaml`、`app/logs/`、`data/`，SQLite 啟用 WAL。從 rc.2 升級時，把 `config.yaml` 移到 `app/config.yaml`，舊的 `data/ecoku.log` 移到 `app/logs/ecoku.log`。

## v0.1.0-rc.1 / rc.2

- rc.1 提供多站點純文字評論、管理後台、通知和 Twikoo 匯入。
- 從 rc.2 起，容器內建 `/client/ecoku-loader.js` 與 `hash-password` 指令。
