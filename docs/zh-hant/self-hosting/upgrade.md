# 升級流程

每次發版後，把對應說明放進 [升級說明](/zh-hant/self-hosting/upgrades/)。升級前讀該版本頁面與倉庫 `CHANGELOG.md`。

## 固定順序

1. 確認目標 tag、schema、環境變量與目錄變化。
2. [停服冷備份](/zh-hant/self-hosting/backup) 資料庫與配置。
3. 把 `compose.yaml` 的精確鏡像 tag 改為新版本；若舊檔案沒有 `logging` 段，按當前倉庫補上。
4. 若該版本要求新環境變量（例如 `TZ`），寫入 `ecoku.env` 後再啟動，不要寫進 `config.yaml`。
5. 拉取並啟動，觀察遷移日誌，確認 `healthy`。
6. 驗證管理登入、站點、評論時間、送出、回覆與通知。若啟用了 Turnstile 或 Cap，登入和發表都要能完成當前驗證。

```bash
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=200 ecoku
curl --fail http://127.0.0.1:12123/api/health
```

## Schema

遷移在原 `data/ecoku.sqlite3` 內按版本事務執行。成功只增加 `schema_migrations` 記錄，不會自動刪除資料庫、WAL 或 `backups/`。失敗的版本不會被記為完成，服務拒絕啟動。沒有向下遷移。

已寫入更高 schema 的庫不能只換回舊鏡像，必須用停服前整庫備份恢復。

| 鏡像 | Schema |
| --- | --- |
| `v0.1.0` – `v0.1.2` | v4 |
| `v0.1.3` – `v0.1.4` | v5 |
| `v0.1.5` – `v0.1.7` | v6 |

當前最新為 schema v6：`turnstile_settings` 已重命名為 `captcha_settings`，並增加 Cap 欄位。

## 回滾

停服 → 保留失敗現場 → 恢復備份 → 改回舊精確 tag → 啟動。細節見 [備份與恢復](/zh-hant/self-hosting/backup#恢復)。
