# 升級

只改 Compose 裡的**精確映像 tag**，不要整份覆蓋現有 Compose 檔。操作順序見下文；各版本變更見頁末索引。

## 操作順序

1. 閱讀目標版本說明，確認 schema、環境變數和掛載是否有變化。
2. 按 [備份與還原](./backup) 停服冷備份（資料庫、設定、金鑰、Compose）。
3. 保留現有資源限制與掛載，只修改映像 tag。
4. 若版本說明要求補充環境變數或設定，一併改好。
5. 拉取並啟動，檢查日誌與健康介面。
6. 驗證管理登入、站點、評論、回覆、通知，以及已啟用的人機驗證。

```bash
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=200 ecoku
curl --fail http://127.0.0.1:12123/api/health
```

`/api/health` 只表示行程可回應，不證明遷移或依賴全部正常。

## 資料庫

遷移在 `data/ecoku.sqlite3` 內按版本、按事務執行。成功只追加 `schema_migrations` 記錄，不自動刪除資料庫、WAL 或備份；失敗版本不會標記完成，服務會拒絕啟動。沒有向下遷移。

| 映像 | Schema |
| --- | --- |
| `v0.1.0`–`v0.1.2` | v4 |
| `v0.1.3`–`v0.1.4` | v5 |
| `v0.1.5`–`v0.1.7` | v6 |
| `v0.1.8` | v7 |

已寫入更高 schema 的資料庫不能只換回舊映像；需要還原停服前的整庫備份後再用舊 tag 啟動。

## 回滾

停服，保留失敗現場，按 [備份與還原](./backup) 還原，把 Compose 改回舊的精確 tag，再啟動。

## 版本索引

| 版本 | 日期 | Schema | 要點 |
| --- | --- | --- | --- |
| [v0.1.8](./upgrades/v0.1.8) | 2026-08-27 | v6 → v7 | Smoji 表情包；站點新增兩項設定 |
| [v0.1.7](./upgrades/v0.1.7) | 2026-08-26 | v6 | 建置工具鏈與文件站；執行時契約不變 |
| [v0.1.6](./upgrades/v0.1.6) | 2026-08-18 | v6 | Cap instrumentation 的管理端 CSP |
| [v0.1.5](./upgrades/v0.1.5) | 2026-08-17 | v5 → v6 | Turnstile / Cap 三態 |
| [v0.1.4](./upgrades/v0.1.4) | 2026-08-15 | v5 | 儲存口令時回填 `is_blogger` |
| [v0.1.3](./upgrades/v0.1.3) | 2026-08-15 | v4 → v5 | 部落客口令、outbox 按目標拆行 |
| [v0.1.2](./upgrades/v0.1.2) | 2026-08-15 | v4 | 評論元資訊字級 |
| [v0.1.1](./upgrades/v0.1.1) | 2026-08-15 | v4 | 摺疊按鈕等寬 |
| [v0.1.0](./upgrades/v0.1.0) | 2026-08-15 | v4 | 首個正式版 |
| [更早候選](./upgrades/earlier) | 2026-08-14 | v1–v4 | 目錄佈局、WAL、時區、Turnstile 初版 |
