# 更早候選版本

以下 tag 可能仍出現在舊執行個體的 Compose 中。升級步驟一律見 [升級](../upgrade)。跨 schema 回滾必須還原備份。

## v0.1.0-rc.10 / rc.9 / rc.8

Schema 至 rc.8 寫入 **v3 + v4**（部落客標誌、`turnstile_settings`）。rc.9 修復 Turnstile `api.js` 與 `turnstile.ready()` 衝突。rc.10 為評論區文案與版面調整。

在 `ecoku.env` 增加 `TZ='<IANA>'` 後，用目前 Compose 的 `env_file` 重建容器即可，不必改 `config.yaml`。從 rc.7 升到 rc.8 必須備份；已寫入 v3/v4 的庫不能只換回 rc.7。

## v0.1.0-rc.7

接入改為 `data-ecoku-*`，外殼 id 為 `ecoku-comments` / `ecoku-mount`。載入器暫時仍識別舊 `#tcomment`。Schema 仍為 v2。

## v0.1.0-rc.6

日誌始終寫 stdout；`log_path` 指向檔案時另留行程內副本。Schema 仍為 v2。

## v0.1.0-rc.5

Schema **v1 → v2**：站點增加部落客暱稱與信箱。SDK 在 IndexedDB 加密保存身分 7 天。管理端不展示通知判定預覽。

## v0.1.0-rc.3

宿主目錄收斂為 `app/config.yaml`、`app/logs/`、`data/`。SQLite 啟用 WAL。從 rc.2 升級需把 `config.yaml` 移到 `app/config.yaml`，舊 `data/ecoku.log` 移到 `app/logs/ecoku.log`。

## v0.1.0-rc.2 / rc.1

rc.2 起容器內建 `/client/ecoku-loader.js` 與 `hash-password`。rc.1 提供多站點純文字評論、管理員、通知和 Twikoo 匯入。
