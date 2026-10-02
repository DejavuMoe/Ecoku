# 升級

目前版本是 **v0.2.8**（2026-10-01 發布，schema v9）。

## 升級時會發生什麼

升級就是把 `compose.yaml` 中的映像檔換成新版本再啟動。新版本啟動時會檢查資料庫的 schema 版本，如果低於自己支援的版本，就依序執行遷移：

- 每一步遷移都在一個交易中完成，失敗則整步回滾，資料庫維持原樣，服務不會啟動；
- 遷移在原本的資料庫檔案上進行，不會刪除或重建資料庫、評論、設定、WAL 檔案或你的備份；
- 每完成一步，就在 `schema_migrations` 資料表中新增一筆記錄；
- **只能向上遷移**。舊版本的程式無法開啟 schema 較新的資料庫，會拒絕啟動。

因此，升級前的備份是回滾到舊 schema 的唯一途徑。

可以跨版本直接升級，例如從 v0.1.8 直接換到 v0.2.8，中間的遷移會依序執行。但請把跨過的每個版本的升級說明都讀一遍，有些版本需要調整設定（例如 [v0.2.4](./upgrades/v0.2.4) 要求 `admin.token_ttl_minutes` 為 480 或省略）。

## 下一版本的設定遷移（尚未發佈） {#unreleased-config}

以下變更尚未發佈，不適用於直接重新啟動 v0.2.8。資料庫 schema 保持 v9，既有站點、評論和通知設定皆保留；但下列 YAML 欄位必須刪除，否則新版本會拒絕啟動。

| 刪除項目 | 新行為 |
| --- | --- |
| `site.port`、`site.log_path` | 監聽 12123，日誌寫到標準輸出。主機連接埠在 Compose 中修改。 |
| 整個 `client`、`database`，以及 `admin.static_dir` | 映像檔資源與資料庫路徑固定，保留原有資料掛載。 |
| 整個 `sites`（包含 `management_key_env`） | 既有站點繼續從 SQLite 讀取，新站點在後台建立；不再支援 `EcokuSite` 驗證。 |
| `admin.enabled`、`admin.token_ttl_minutes`、`admin.username_env`、`admin.password_hash_env`、`admin.token_key_env`、`notifications.encryption_key_env` | 後台始終啟用，工作階段固定為 8 小時；環境變數名稱見[設定參考](../reference/configuration#env)。 |

發佈後，按以下順序遷移：

1. 按[停服冷備份](./backup#cold-backup)保存並驗證資料庫、原設定、`ecoku.env` 和 Compose。記錄實際使用的 SQLite 路徑與主機掛載位置。
2. 刪除表中的 YAML 欄位及留下的空節。保留 `notifications.instance_public_url`、`site.trusted_proxies`，以及實際使用的 `admin.allowed_origins` 和 `rate_limit`。若曾自訂環境變數名稱，改回標準名稱，**原密碼雜湊、簽章金鑰和加密主金鑰的值保持不變**。
3. 確認原資料庫映射到 `/data/ecoku.sqlite3`。使用官方範本的實例不必搬移資料；自訂位置應調整 Compose 的主機路徑。自訂檔名需在停服後準備為 `ecoku.sqlite3`；若仍有 `-wal`、`-shm` 檔案，必須連同主檔案一起複製並對應改名，保留原副本。不要只複製主檔案或掛載空目錄。目錄與檔案須允許 UID/GID `10001:10001` 讀寫。
4. 從 Compose 刪除 `./app/logs:/var/log/ecoku`，原日誌檔案可以留存。新日誌用 `docker compose logs` 查看，輪替由 Docker 日誌設定負責。使用 `EcokuSite` 的自動化需改用有效的管理員工作階段，或改在後台操作。
5. 把映像檔改為屆時發佈的精確 tag，再按[升級步驟](#steps)拉取、啟動和檢查。確認後台的站點數量、歷史評論和通知設定與升級前一致。

回滾到 v0.2.8 時，停止服務並還原原 Compose、設定與環境變數；若搬移過資料庫，還原原掛載對應的資料庫位置。schema 相同，不需回退資料庫；不要用舊備份覆蓋升級後的新評論。舊版需要的日誌目錄仍須允許容器使用者寫入。

## 升級步驟 {#steps}

**1. 閱讀升級說明**。在下方的[版本清單](#versions)中找到目標版本，確認是否有設定變更、是否涉及 schema 遷移。

**2. 停止服務後冷備份**。依照[備份與還原](./backup#cold-backup)執行，確認輸出 `Verified backup`。

**3. 修改映像檔版本**。編輯 `~/Ecoku/compose.yaml`，把 `image` 改成目標版本，例如：

```yaml
    image: "git.via.moe/dejavu/ecoku:v0.2.8"
```

請寫明確的版本號，不要用 `latest`。如果升級說明要求修改 `app/config.yaml` 或 `ecoku.env`，請一併修改。

**4. 拉取並啟動。**

```bash
cd ~/Ecoku
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
```

**5. 檢查。**

```bash
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

容器狀態為 `healthy`、日誌中沒有錯誤後，再開啟部落格文章頁和管理後台，確認評論能正常載入、發布，後台能登入。

## 回滾

先看新舊兩個版本的 schema 是否相同（見下表）：

- **schema 相同**：停止服務，把 `compose.yaml` 中的映像檔改回舊版本號，拉取並啟動。資料庫不用動，升級後產生的新評論也會保留。如果使用了新版本對省略欄位的預設值，先還原舊版所需的完整設定；如果新版本要求加入過新的設定項目，而舊版本不認得它，要先刪掉，否則舊版本會因未知欄位拒絕啟動。
- **schema 不同**：只改回映像檔版本號是不夠的，舊版本無法開啟已遷移的資料庫。需要用升級前的冷備份[還原](./backup#restore)。備份之後產生的評論和設定修改會遺失。

## 版本清單 {#versions}

| 版本 | 發布日期 | schema | 重點 |
| --- | --- | --- | --- |
| [v0.2.8](./upgrades/v0.2.8) | 2026-10-01 | v9 | 管理後台改為評論流與列式設定，增加快捷鍵和底部導覽；容器內建預設設定，部署範本精簡。 |
| [v0.2.7](./upgrades/v0.2.7) | 2026-09-29 | v8 → v9 | 通知郵件改用紙墨視覺與系統字型，主旨附帶文章標題；刪除評論時取消未寄出的通知並撤回已寄出的 Telegram 訊息；通知佇列不再重試注定失敗的投遞。 |
| [v0.2.6](./upgrades/v0.2.6) | 2026-09-29 | v8 | 管理後台改用與評論區一致的紙墨配色和系統字型，重新編排各頁面版面；功能與介面不變。 |
| [v0.2.5](./upgrades/v0.2.5) | 2026-09-26 | v8 | 評論區預設樣式改為「紙與墨」，可直接覆寫 CSS 變數；Turnstile 核驗拒絕重新導向。 |
| [v0.2.4](./upgrades/v0.2.4) | 2026-09-16 | v7 → v8 | 管理員工作階段改為可撤銷的 Cookie 工作階段；`token_ttl_minutes` 只能為 480；新回覆最多 16 層。 |
| [v0.2.3](./upgrades/v0.2.3) | 2026-09-16 | v7 | 儲存站點不再改寫歷史部落客標記；通知、匯入、SDK 多項修正。 |
| [v0.2.2](./upgrades/v0.2.2) | 2026-09-13 | v7 | 修正窄螢幕下貼圖選擇器超出頁面。 |
| [v0.2.1](./upgrades/v0.2.1) | 2026-09-12 | v7 | Smoji 清單容量提高，支援 `base` 範本。 |
| [v0.2.0](./upgrades/v0.2.0) | 2026-09-12 | v7 | 文件與 API 參考修訂，執行階段無變化。 |
| [v0.1.9](./upgrades/v0.1.9) | 2026-08-31 | v7 | 評論清單增加讀取預算、逐層讀取 API 和獨立的讀取速率限制。 |
| [v0.1.8](./upgrades/v0.1.8) | 2026-08-27 | v6 → v7 | 新增 Smoji 貼圖包。 |
| [v0.1.7](./upgrades/v0.1.7) | 2026-08-26 | v6 | 建置工具鏈與文件網站更新，執行階段無變化。 |
| [v0.1.6](./upgrades/v0.1.6) | 2026-08-18 | v6 | 修正 Cap 所需的後台 CSP。 |
| [v0.1.5](./upgrades/v0.1.5) | 2026-08-17 | v5 → v6 | 人機驗證改為關閉 / Turnstile / Cap 三選一。 |
| [v0.1.4](./upgrades/v0.1.4) | 2026-08-15 | v5 | 儲存部落客口令時回填歷史部落客標記（v0.2.3 起取消）。 |
| [v0.1.3](./upgrades/v0.1.3) | 2026-08-15 | v4 → v5 | 部落客改用口令驗證；通知依收件者拆分。 |
| [v0.1.2](./upgrades/v0.1.2) | 2026-08-15 | v4 | 評論中繼資訊排版調整。 |
| [v0.1.1](./upgrades/v0.1.1) | 2026-08-15 | v4 | 摺疊按鈕改為固定寬度，切換時不再跳動。 |
| [v0.1.0](./upgrades/v0.1.0) | 2026-08-15 | v4 | 第一個正式版本。 |
| [更早的候選版本](./upgrades/earlier) | 2026-08-14 | v1 ～ v4 | `v0.1.0-rc.*` 系列。 |

表中 schema 欄只寫一個版本號的，表示該版本沒有資料庫遷移。
