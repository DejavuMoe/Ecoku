# 升級

升級就是把 `compose.yaml` 裡的映像檔換成新版本，再重建容器。新版本啟動時會檢查資料庫的 schema 版本，必要時依序原地遷移。

目前版本是 **v0.6.4**（2026-11-26，schema v12）。新部署請直接看 [Docker 部署](./docker)。

升級前先在 [版本清單](#versions) 裡讀一遍從你的版本到目標版本之間每個版本的說明。需要特別注意的兩處：

- 從 v0.5.7 或更早版本升級，要同時替換 Compose 裡的健康檢查，見 [遷移到 distroless 映像檔](#distroless)。
- 從 v0.5.0 之前的版本升級，管理後台的來源不能和任何站點的允許來源重複，否則新版本拒絕啟動，見 [v0.5.0 相容性說明](./upgrades/v0.5.0#compatibility)。

## 資料庫遷移

- 每一步遷移在一個交易裡完成。某一步失敗時只回滾這一步，服務不會啟動，之前完成的步驟保留。
- 遷移直接修改原資料庫檔案，不會刪除資料庫、評論、設定或備份。
- 只能向上遷移。舊版本程式打不開更高 schema 的資料庫。

所以升級前的冷備份，是回到舊 schema 的唯一辦法。

## 升級步驟 {#steps}

<div class="steps">


### 讀升級說明

在 [版本清單](#versions) 裡找到目標版本，看有沒有設定變更和資料庫遷移。

### 停服冷備份

依 [備份與還原](./backup#cold-backup) 操作，看到 `Verified backup` 後保持服務停止。

### 改映像檔版本

編輯 `~/Ecoku/compose.yaml`，寫精確的版本號：

```yaml
    image: "ghcr.io/dejavumoe/ecoku:v0.6.4"
```

升級說明要求修改 `app/config.yaml` 的，一併改好。以前從 Forgejo 映像檔倉庫拉取的實例，直接改成上面的 GHCR 位址；Forgejo 不再發布新版本。

### 拉取並啟動


```bash
(
set -eu
cd ~/Ecoku
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d --force-recreate --wait --wait-timeout 120 ecoku
)
```

### 檢查


```bash
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

容器為 `healthy`、日誌沒有錯誤後，開啟一篇文章確認評論能載入和發布，再登入一次後台。

</div>

使用 npm 套件 `ecoku` 的網站，同時把相依套件更新到同一版本並重新建置。

## 回滾 {#rollback}

先看新舊兩個版本的 schema 是否相同（見下表）。

**schema 相同**：停服，把 `compose.yaml` 裡的映像檔改回舊版本，拉取並重建。資料庫不用動，升級後的新評論會保留。如果為新版本加過舊版本不認得的設定項，先刪掉，否則舊版本會因為未知欄位拒絕啟動。

**schema 不同**：改回映像檔沒有用，舊版本打不開已遷移的資料庫。用升級前的冷備份 [還原](./backup#restore)，備份之後的評論和設定修改會遺失。

## 版本清單 {#versions}

schema 一欄只有一個版本號的，表示沒有資料庫遷移。

| 版本 | 發布日期 | schema | 重點 |
| --- | --- | --- | --- |
| [v0.6.4](./upgrades/v0.6.4) | 2026-11-26 | v12 | 管理後台評論頁新增搜尋，可依暱稱、信箱、內文、頁面或編號查找，並標出符合的詞。無資料庫遷移。 |
| [v0.6.3](./upgrades/v0.6.3) | 2026-11-24 | v12 | 評論區右下角顯示「Powered by Ecoku」；管理後台底部顯示署名與目前版本號。無資料庫遷移。 |
| [v0.6.2](./upgrades/v0.6.2) | 2026-11-23 | v12 | 評論區預設樣式的回覆改為樹狀連線，新增 `--ecoku-thread-*` 變數。無資料庫遷移。 |
| [v0.6.1](./upgrades/v0.6.1) | 2026-11-19 | v12 | 修復 Twikoo 匯入、後台評論清單一致性與信任代理驗證，改善評論清單讀取。無資料庫遷移。 |
| [v0.6.0](./upgrades/v0.6.0) | 2026-11-17 | v12 | 執行映像檔遷移至 distroless Debian 13 static，映像檔不含 shell/wget；新增二進位 healthcheck 探針，舊 Compose 須替換探針。無資料庫遷移。 |
| [v0.5.7](./upgrades/v0.5.7) | 2026-11-12 | v12 | 最佳化公開讀取與 SDK 載入；修復回覆草稿、排序和重新整理時序；後台時間跟隨實例時區。無資料庫遷移。 |
| [v0.5.6](./upgrades/v0.5.6) | 2026-11-09 | v12 | 修復執行時映像檔 musl 與 zlib 漏洞及 `x/net` HTML 解析漏洞（GO-2026-6860），包含 v0.5.5 的全部變更；無資料庫遷移，對外行為不變。 |
| [v0.5.5](./upgrades/v0.5.5) | 2026-11-09 | v12 | 映像檔發布未完成，請使用 v0.5.6。 |
| [v0.5.4](./upgrades/v0.5.4) | 2026-10-23 | v12 | 修復 SDK 末頁重新載入、導覽標題和缺少站點的驗證，以及首次管理員設定的資料競爭；無資料庫遷移。 |
| [v0.5.3](./upgrades/v0.5.3) | 2026-10-19 | v12 | 管理後台介面打磨：導覽置中、完整日期、刪除確認卡片；無資料庫遷移，伺服器與 SDK 執行時程式碼不變。 |
| [v0.5.2](./upgrades/v0.5.2) | 2026-10-18 | v12 | 啟動日誌不再輸出管理員密碼，首次登入透過停服重設取得臨時密碼；無資料庫遷移。 |
| [v0.5.1](./upgrades/v0.5.1) | 2026-10-16 | v12 | 清理未使用的設定輔助程式，減少 CI 瀏覽器下載；無資料庫遷移，SDK 執行時程式碼不變。 |
| [v0.5.0](./upgrades/v0.5.0) | 2026-10-11 | v12 | 修復評論區並行請求、後台狀態、匯入、通知與來源驗證；無資料庫遷移，升級前檢查來源衝突。 |
| [v0.4.1](./upgrades/v0.4.1) | 2026-10-09 | v12 | 移除後台全局快捷鍵與提示，修正 npm 套件首頁安裝版本，無資料庫遷移。 |
| [v0.4.0](./upgrades/v0.4.0) | 2026-10-09 | v12 | 後台遷移至 Svelte 5，SDK 與部署方式保持相容，無資料庫遷移。 |
| [v0.3.8](./upgrades/v0.3.8) | 2026-10-09 | v12 | Go 1.27.2 與 x/net v0.60.0 安全修正，無資料庫遷移。 |
| [v0.3.7](./upgrades/v0.3.7) | 2026-10-06 | v12 | 清單效能最佳化、通知刪除協調、安全加固、OpenSSL 更新與映像檔檢查修正。 |
| [v0.3.6](./upgrades/v0.3.6) | 2026-10-06 | v12 | 映像檔發布未完成，請使用 v0.3.7。 |
| [v0.3.5](./upgrades/v0.3.5) | 2026-10-05 | v12 | 修正管理後台切換選單和載入資料時的整頁橫向晃動。 |
| [v0.3.4](./upgrades/v0.3.4) | 2026-10-05 | v12 | 後台驗證載入修正、評論提交結果提示、身分儲存不阻塞載入與成功提示。 |
| [v0.3.3](./upgrades/v0.3.3) | 2026-10-04 | v12 | 重設密碼後保留管理員使用者名稱、評論區回覆層級上限、載入器 `data-i18n` 與失敗提示多語言。 |
| [v0.3.2](./upgrades/v0.3.2) | 2026-10-04 | v12 | 後台設定改用輸入框與逐項列表、郵件頁首印章、SDK 語言優先順序修正。 |
| [v0.3.1](./upgrades/v0.3.1) | 2026-10-03 | v11 → v12 | 三語後台與評論區、站點語言、文件主題同步。 |
| [v0.3.0](./upgrades/v0.3.0) | 2026-10-03 | v10 → v11 | Smoji 獨立圖片來源、npm SDK 與 GHCR 發布、設定範本及文件主題更新。 |


## 遷移到 distroless 映像檔 {#distroless}

從 v0.6.0 起，執行映像檔從 Alpine 換成了 distroless Debian 13 static，裡面沒有 shell、wget 和套件管理器。從 v0.5.7 或更早版本升級時，必須把 Compose 裡舊的 wget 健康檢查換成：

```yaml
    healthcheck:
      test: ["CMD", "/app/ecoku-server", "healthcheck"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

只換映像檔不換探針，舊探針會一直失敗。改了容器內連接埠的，加上 `--port=你的連接埠`。

其他保持不變：UID/GID `10001:10001`、`/app/config.yaml`、`/data` 掛載和 schema v12 都沒變，資料目錄不需要重新變更擁有者，主機也不需要升級到 Debian 13。

排查問題時改用主機上的 `docker compose logs`、`docker inspect`、`docker cp`。依賴 `docker exec … sh` 的腳本需要調整。

回滾到 v0.5.7 時，同時恢復舊的 wget 健康檢查，或者刪掉 Compose 裡的 `healthcheck` 段，使用舊映像檔內建的探針。

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
| [v0.1.0](./upgrades/v0.1.0) | 2026-08-15 | v4 | 第一個帶穩定標籤的內測版本。 |
| [更早的候選版本](./upgrades/earlier) | 2026-08-14 | v1 ～ v4 | `v0.1.0-rc.*` 系列。 |
:::

<details id="legacy-config" class="details custom-block">
<summary>內測實例（v0.2.9 及更早）的舊設定遷移</summary>

v0.2.9 在 schema v9 上新增 v10 管理員帳戶表。既有站點、評論、通知、驗證碼設定和舊管理員憑據都會保留；舊實例不需要在升級前修改設定。

升級時保留原本的 `compose.yaml`、`app/config.yaml` 和 `ecoku.env`，依 [升級步驟](#steps) 停服備份後啟動新映像檔。新版本第一次啟動會：

1. 把舊的 `ECOKU_ADMIN_USERNAME`、`ECOKU_ADMIN_PASSWORD_HASH` 和 `ECOKU_ADMIN_TOKEN_KEY` 導入管理員帳戶和持久工作階段金鑰；
2. 把 `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 寫入 `data/ecoku-secrets.json`，並用它繼續解密資料庫中已有的憑據；
3. 保留舊的 `site.port`、`site.log_path`、靜態目錄、SQLite 路徑、YAML `sites` 和 `management_key_env` 相容行為；
4. 不產生臨時密碼，也不強迫舊管理員改密碼。

確認新版本正常運作後，再遷移為簡化設定：

1. 確認可以登入後台，站點數量、歷史評論正確，通知設定可以開啟；
2. 確認 `data/ecoku-secrets.json` 已建立，並且日誌中沒有 `通知凭据校验失败`；
3. 停服並依 [備份](./backup#cold-backup) 保存整個 `data/`、`app/config.yaml`、`compose.yaml` 和舊的 `ecoku.env`；
4. 停服後從 `ecoku.env` 刪除管理員變數和 `ECOKU_NOTIFICATION_ENCRYPTION_KEY`。如果仍需要 `TZ`，把它移到 Compose 的 `environment`；保留 `env_file` 時也可以只留下 `TZ`；
5. 不再需要該環境檔案時才刪除 Compose 的 `env_file`。如果仍透過它注入 `TZ` 或站點管理金鑰，就保留 `env_file`；
6. 保留 `notifications.instance_public_url`、實際使用的 `site.trusted_proxies`、`admin.allowed_origins` 和 `rate_limit`。確認不再需要舊資料庫路徑、檔案日誌或 `EcokuSite` 自動化後，才刪除舊欄位；
7. 重建容器，再次檢查後台、評論和通知。

舊的 `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 與 `data/ecoku-secrets.json` 不一致時，服務會拒絕啟動，以免覆蓋後無法解密已有憑據。舊資料庫路徑仍然有效，不要直接刪除 `database.sqlite.path` 後掛載空的 `/data`。

內測版本不再提供正式環境回滾映像檔。歷史 schema 的還原需要當時的完整冷備份；此處僅保留設定遷移記錄。

</details>
