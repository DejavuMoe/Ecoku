# 設定參考

Ecoku 讀取一個 YAML 檔案 `app/config.yaml`，再加上 Compose 裡的兩個環境變數。新部署只需要填 `instance_public_url`，其餘保持預設即可。站點、通知、人機驗證和貼圖包都在管理後台設定，不寫在這裡。

## 完整範本 {#template}

每一項的預設值、可選值和用途都寫在註解裡。註解掉的行是可選覆寫項，需要時取消註解。每個頂層區段（`site:`、`admin:` 等）只能出現一次。

<div class="config-template">

<<< ../../../deploy/config.zh-hant.yaml.example{yaml}

</div>

## 修改後生效 {#reload}

設定不會熱載入。改完後重建容器，再看日誌：

```bash
(
set -eu
sudo docker compose config --quiet
sudo docker compose up -d --force-recreate --wait --wait-timeout 120 ecoku
)
sudo docker compose logs --tail=100 ecoku
```

未知欄位、無效值或重複欄位都會讓服務拒絕啟動，日誌會說明是哪一項。

啟動時還會檢查一件事：管理後台的來源（`instance_public_url` 或 `admin.allowed_origins`）不能和資料庫裡任何站點的允許來源重複。重複時日誌報「管理端来源 … 与已存储的公开站点来源重叠」，服務不啟動。解決辦法是讓管理後台和部落格使用不同的網域：在後台修改站點來源，或者調整管理網域和反向代理。開啟資料庫的命令列子命令也做同樣的檢查。

## 限流 {#rate-limit}

`rate_limit` 下各項依 IP 分別計數，超限時回傳 `429` 和 `Retry-After` 標頭。計數保存在記憶體裡，重新啟動後歸零。填 `0` 表示使用預設值，沒有辦法關閉限流。

Ecoku 在反向代理後面時，一定要設定 [`site.trusted_proxies`](../self-hosting/reverse-proxy#trusted-proxies)，否則所有訪客共用一個額度。

## 日誌 {#logs}

日誌預設寫到標準輸出，用 `docker compose logs` 查看，保留和輪替交給 Docker。設定 `site.log_path` 為檔案路徑時，同時寫標準輸出和這個檔案，你需要掛載一個容器可寫入的目錄。

## 環境變數 {#env}

這兩項寫在 `compose.yaml` 的 `environment` 裡：

| 變數 | 說明 |
| --- | --- |
| `TZ` | 評論區、後台和通知的顯示時區，IANA 時區名稱，例如 `Asia/Shanghai`。 |
| `ECOKU_ADMIN_LOCALE` | 後台語言：`zh-CN`、`zh-Hant` 或 `en`，不區分大小寫，也接受 `zh-TW`、`en-US` 這樣的寫法。無法辨識時使用 `zh-CN`。 |

評論區的語言不受它們影響，在後台每個站點的「評論區語言」裡設定。

範本裡以 `_env` 結尾的欄位填的是環境變數的名稱，不是值。新部署會自動建立管理員和金鑰，不需要注入這些變數。映像檔已經設定了 `GIN_MODE=release` 和 `ECOKU_RUNTIME=container`，不要覆寫。

## 站點種子與資料庫 {#legacy}

`sites` 區段只在建立全新資料庫時匯入一次，之後修改它不會影響既有站點。新部署直接在後台建立站點即可。

資料庫和同目錄的 `ecoku-secrets.json` 必須一起備份、一起搬遷。修改資料庫路徑不會搬遷資料，新路徑上會建立一個空資料庫。
