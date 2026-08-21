# 更早候選版本

以下 tag 仍可能出現在舊實例的 `compose.yaml` 中。升級一律：停服冷備份 → 改精確 tag → `pull && up -d`。跨 schema 回滾必須恢復備份。

## v0.1.0-rc.10 / rc.9 / rc.8

Schema 至 rc.8 寫入 **v3 + v4**（博主徽章、`turnstile_settings`）。rc.9 修復 Turnstile `api.js` 與 `turnstile.ready()` 衝突導致登入槽不出現。rc.10 為評論區文案與布局調整。

已有實例在 `ecoku.env` 增加 `TZ='<IANA>'` 後，用當前 Compose 的 `env_file` 重建容器即可，不必改 `config.yaml`。從 rc.7 升到 rc.8 必須備份；已寫入 v3/v4 的庫不能只換回 rc.7。

## v0.1.0-rc.7

接入改為 `data-ecoku-*`，外殼 id 為 `ecoku-comments` / `ecoku-mount`。加載器暫時仍識別舊 `#tcomment`。Schema 仍為 v2。部落格評論 partial 應在本鏡像上線後再部署。

## v0.1.0-rc.6

日誌始終寫 stdout，`docker compose logs -f` 可跟隨。`log_path` 指向檔案時另留行程內副本。Schema 仍為 v2。

## v0.1.0-rc.5

Schema **v1 → v2**：站點增加博主暱稱與信箱。SDK 支援在回覆框填身份，IndexedDB 加密 7 天。管理端不展示通知判定預覽。

## v0.1.0-rc.3

宿主目錄收斂為 `app/config.yaml`、`app/logs/`、`data/`。SQLite 啟用 WAL。從 rc.2 升級需停服後把 `config.yaml` 移到 `app/config.yaml`，舊 `data/ecoku.log` 移到 `app/logs/ecoku.log`。收到 SIGTERM 會先停 HTTP 與通知 worker，再 checkpoint WAL。

Git 上存在 `v0.1.0-rc.4` 標籤，當時未留下對應 CHANGELOG 章節。

## v0.1.0-rc.2 / rc.1

rc.2 起容器內置 `/client/ecoku-loader.js` 與 `hash-password`。rc.1 為第一個用於私有 CI 驗證的候選：多站點純文字評論、管理員、通知、Twikoo 匯入。
