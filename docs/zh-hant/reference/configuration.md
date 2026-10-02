# 設定參考

本頁對應下一版本，既有實例請先閱讀[設定遷移](../self-hosting/upgrade#unreleased-config)。

Ecoku 的設定分為兩處：

- `app/config.yaml`：實例層級的參數，容器啟動時讀取一次，以唯讀方式掛載。修改後需要重建容器才會生效。
- `ecoku.env`：管理員憑據、金鑰和時區，透過 Compose 的 `env_file` 注入。

站點、部落客、人機驗證和通知設定不在這兩個檔案中，而是保存在 SQLite 資料庫裡，在[管理後台](../self-hosting/admin)修改。 映像檔內的監聽連接埠 `12123`、瀏覽器資源 `/app/client`、管理後台頁面 `/app/admin` 和資料庫 `/data/ecoku.sqlite3` 都已固定，不能在 YAML 中設定。

## 通用規則

- 設定檔只能包含一個 YAML 文件，出現未知欄位會拒絕啟動，日誌會指出欄位所在的行。
- 數值類欄位寫 `0` 或省略時，使用下表中的預設值。
- [Docker 部署](../self-hosting/docker)時，`config.yaml` 通常只需要 `notifications.instance_public_url`，設定反向代理後再加上 `site.trusted_proxies`。

修改 `config.yaml` 或 `ecoku.env` 後，執行下面的指令重建容器：

```bash
cd ~/Ecoku && sudo docker compose up -d --force-recreate ecoku
```

`docker compose restart` 不會重新讀取 `ecoku.env`。

## site

| 欄位 | 預設值 | 說明 |
| --- | --- | --- |
| `trusted_proxies` | `[]` | 允許轉送 `X-Forwarded-For` 的直連對端，填 IP 或 CIDR。通常只填 Docker 閘道，例如 `172.18.0.1/32`。禁止 `0.0.0.0/0` 與 `::/0`。詳見[反向代理](../self-hosting/reverse-proxy#trusted-proxies)。 |

## rate_limit {#rate-limit}

所有速率限制都依用戶端 IP 計數，採固定時間窗，狀態保存在程式的記憶體中，重新啟動後歸零。超過限額時回傳 `429` 和 `Retry-After` 回應標頭。每種操作的計數彼此獨立。

| 欄位 | 預設值 | 說明 |
| --- | --- | --- |
| `window_seconds` | `60` | 計數時間窗的長度（秒），所有操作共用。 |
| `comment_submit` | `5` | 每個時間窗內允許送出的評論數。 |
| `comment_list` | `60` | 每個時間窗內允許讀取評論清單的次數。瀏覽器的 CORS 預檢和來源被拒絕的請求也會計入。 |
| `comment_delete` | `30` | 每個時間窗內允許的刪除請求數。軟刪除與徹底刪除分別計數。 |
| `admin_login` | `5` | 每個時間窗內允許的管理員登入嘗試次數。 |
| `notification_test` | `5` | 每個時間窗內允許寄送測試通知的次數。測試郵件與測試 Telegram 訊息分別計數。 |

每種速率限制最多同時追蹤 10,000 個 IP。已滿時，新出現的 IP 會被拒絕，直到有舊記錄過期；既有 IP 的額度不會被擠掉。

沒有正確設定 `trusted_proxies` 時，反向代理後面的所有訪客會被算成同一個 IP，共用這裡的額度。

## notifications

| 欄位 | 預設值 | 說明 |
| --- | --- | --- |
| `instance_public_url` | 空 | Ecoku 的公開網址，例如 `https://ecoku.example.com`。啟用電子郵件或 Telegram 通知前必須填寫。沒有寫 `admin.allowed_origins` 時，它的來源（協定 + 網域 + 選填的連接埠）也是管理後台的來源。通知中的原文連結由站點 URL 和頁面路徑組成，不使用此網址。 |

## admin

管理後台與管理 API 始終啟用，映像檔在 `/admin/` 提供後台頁面。

| 欄位 | 預設值 | 說明 |
| --- | --- | --- |
| `allowed_origins` | `notifications.instance_public_url` 的來源 | 允許存取管理 API 的瀏覽器來源，也就是開啟後台時網址列中的 `協定://網域[:連接埠]`。只有用多個位址開啟後台時才需要填寫。它和 `instance_public_url` 至少要有一個，否則服務無法啟動。 |

Ecoku 在啟動階段還會檢查：

- `ECOKU_ADMIN_USERNAME`、`ECOKU_ADMIN_PASSWORD_HASH`、`ECOKU_ADMIN_TOKEN_KEY` 都不能為空；
- 密碼雜湊必須是有效的 bcrypt，cost 不低於 10（`hash-password` 產生的雜湊符合要求）；
- 簽章金鑰至少 32 位元組，且不能與密碼雜湊相同。

在後台新增或修改站點時，站點允許來源不能與管理後台來源相同，否則儲存失敗。

## 日誌 {#logs}

日誌寫到標準輸出，用 `docker compose logs` 查看，保留與輪替由 Docker 的日誌設定決定。日誌不包含 IP、User-Agent、評論內文或憑據。存取日誌只記錄路由範本（如 `/api/admin/sites/:siteId`），不記錄實際路徑參數。

## 環境變數 {#env}

| 變數 | 必填 | 說明 |
| --- | --- | --- |
| `ECOKU_ADMIN_USERNAME` | 是 | 管理員使用者名稱，1～80 個字元。 |
| `ECOKU_ADMIN_PASSWORD_HASH` | 是 | 管理員密碼的 bcrypt 雜湊。用 `hash-password` 指令產生，見[命令列](./cli#hash-password)。 |
| `ECOKU_ADMIN_TOKEN_KEY` | 是 | 工作階段簽章金鑰，至少 32 位元組。可用 `openssl rand -hex 32` 產生。 |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | 儲存憑據時 | 加密資料庫中的 SMTP 密碼、Telegram Bot Token 和人機驗證 Secret Key。Base64 編碼的 32 位元組金鑰（有無填補皆可），可用 `openssl rand -base64 32` 產生。 |
| `TZ` | 否 | 評論時間的顯示時區，填 IANA 名稱，例如 `Asia/Shanghai`。未設定或名稱無效時回退到容器的系統時區，無法辨識時使用 `Asia/Shanghai`。建議明確填寫。 |

`ecoku.env` 中的每個值建議用單引號包住，避免 bcrypt 雜湊中的 `$` 被 Compose 展開。填寫範例與產生指令見 [Docker 部署](../self-hosting/docker#env)。

映像檔內已設定 `GIN_MODE=release` 與 `ECOKU_RUNTIME=container`，不要在 `ecoku.env` 中修改。

更換 `ECOKU_ADMIN_TOKEN_KEY` 或密碼雜湊後重建容器，所有已登入的管理員工作階段都會失效。

`ECOKU_NOTIFICATION_ENCRYPTION_KEY` 不能隨意更換：資料庫中已經儲存的憑據是用舊金鑰加密的，換掉後 Ecoku 無法解密，會在啟動時報錯並結束。
