# 升級

公開版本從 v0.3.0 開始。新部署直接使用 [Docker 部署](./docker)；本頁用於既有實例升級。

目前版本是 **v0.3.1**（2026-10-03 發布，schema v12）。

新映像檔統一發布到 GHCR。使用 Forgejo 映像檔的實例，後續升級請將 `image` 改為 `ghcr.io/dejavumoe/ecoku:v0.3.1` 或目標版本的精確 tag，保留原本的資料與設定掛載；Forgejo registry 不再發布新版本。同版本切換倉庫不必重新初始化實例。

## 升級時會發生什麼

升級就是把 `compose.yaml` 中的映像檔換成新版本再啟動。新版本啟動時會檢查資料庫的 schema 版本，如果低於自己支援的版本，就依序執行遷移：

- 每一步遷移都在一個交易中完成，失敗則整步回滾，資料庫維持原樣，服務不會啟動；
- 遷移在原本的資料庫檔案上進行，不會刪除或重建資料庫、評論、設定、WAL 檔案或你的備份；
- 每完成一步，就在 `schema_migrations` 資料表中新增一筆記錄；
- **只能向上遷移**。舊版本的程式無法開啟 schema 較新的資料庫，會拒絕啟動。

因此，升級前的備份是回滾到舊 schema 的唯一途徑。

## 升級步驟 {#steps}

**1. 閱讀升級說明**。在下方的[版本清單](#versions)中找到目標版本，確認是否有設定變更、是否涉及 schema 遷移。

**2. 停止服務後冷備份**。依照[備份與還原](./backup#cold-backup)執行，確認輸出 `Verified backup`。

**3. 修改映像檔版本**。編輯 `~/Ecoku/compose.yaml`，把 `image` 改成目標版本，例如：

```yaml
    image: "ghcr.io/dejavumoe/ecoku:v0.3.1"
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
| [v0.3.1](./upgrades/v0.3.1) | 2026-10-03 | v11 → v12 | 三語後台與評論區、站點語言、文件主題同步。 |
| [v0.3.0](./upgrades/v0.3.0) | 2026-10-03 | v10 → v11 | Smoji 獨立圖片來源、npm SDK 與 GHCR 發布、設定範本及文件主題更新。 |

表中 schema 欄只寫一個版本號的，表示該版本沒有資料庫遷移。

::: details 內測版本記錄（請勿使用）
僅保留版本標籤、變更和歷史升級事項。公開部署從 v0.3.0 開始；舊映像檔不再提供部署支援。請使用 [目前部署文件](./docker)。

| 版本 | 日期 | schema | 歷史變更 |
| --- | --- | --- | --- |
| [v0.2.9](./upgrades/v0.2.9) | 2026-10-02 | v9 → v10 | 首次登入改密碼、持久管理員與金鑰、舊設定相容及後台修復。 |
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
:::

<details id="legacy-config" class="details custom-block">
<summary>內測實例的舊設定遷移</summary>

v0.2.9 在 schema v9 上新增 v10 管理員帳戶表。既有站點、評論、通知、驗證設定和舊管理員憑據都會保留，既有實例升級前不必修改設定。

保留原本的 `compose.yaml`、`app/config.yaml` 和 `ecoku.env`，按[升級步驟](#steps)停服備份後啟動新映像檔。首次啟動會導入舊管理員憑據、把通知加密主金鑰寫入 `data/ecoku-secrets.json`，保留舊連接埠、檔案日誌、靜態目錄、SQLite 路徑、YAML `sites` 和 `management_key_env` 的相容行為，不會產生臨時密碼，也不會強迫舊管理員改密碼。

確認新版本正常後，再遷移為簡化設定：

1. 確認可以登入後台，站點數量、歷史評論和通知設定正確；
2. 確認 `data/ecoku-secrets.json` 已建立，日誌沒有解密憑據錯誤；
3. 停服並備份整個 `data/`、`app/config.yaml`、`compose.yaml` 和舊的 `ecoku.env`；
4. 停服後從 `ecoku.env` 刪除管理員變數和 `ECOKU_NOTIFICATION_ENCRYPTION_KEY`。需要 `TZ` 時移到 Compose 的 `environment`；若留在 `ecoku.env`，則須保留 `env_file`；
5. 不再需要環境檔案時才從 Compose 刪除 `env_file`；如果仍透過它注入 `TZ` 或站點管理金鑰，則保留；
6. 保留 `notifications.instance_public_url`、實際使用的 `site.trusted_proxies`、`admin.allowed_origins` 和 `rate_limit`。確認不再需要舊資料庫路徑、檔案日誌或 `EcokuSite` 自動化後，才刪除舊欄位；
7. 重建容器，再次檢查後台、評論和通知。

舊的通知加密主金鑰與 `data/ecoku-secrets.json` 不一致時，服務會拒絕啟動，以免已有憑據無法解密。舊資料庫路徑仍然有效，不要直接刪除 `database.sqlite.path` 後掛載空的 `/data`。

內測版本不再提供正式環境回滾映像檔。歷史 schema 的還原需要當時的完整冷備份；此處僅保留設定遷移記錄。

</details>
