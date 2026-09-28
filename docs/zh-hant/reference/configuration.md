# 設定參考

Ecoku 的設定分為兩處：

- `app/config.yaml`：實例層級的參數，容器啟動時讀取一次，以唯讀方式掛載。修改後需要重建容器才會生效。
- `ecoku.env`：管理員憑據、金鑰和時區，透過 Compose 的 `env_file` 注入。

站點、部落客、人機驗證和通知設定不在這兩個檔案中，而是保存在 SQLite 資料庫裡，在[管理後台](../self-hosting/admin)修改。

## 通用規則

- 設定檔只能包含一個 YAML 文件，出現未知欄位會拒絕啟動。舊版本遺留的 MySQL、一般使用者等欄位也會導致啟動失敗。
- 數值類欄位寫 `0` 或省略時，使用下表中的預設值。
- 表中的「預設值」是程式在欄位省略時採用的值。[Docker 部署](../self-hosting/docker)中的範本明確寫出了容器內的路徑，請保留這些值。
- 設定檔中只寫環境變數的**名稱**（`*_env` 欄位），金鑰本身放在 `ecoku.env`。

修改 `config.yaml` 或 `ecoku.env` 後，執行下面的指令重建容器：

```bash
cd ~/Ecoku && sudo docker compose up -d --force-recreate ecoku
```

`docker compose restart` 不會重新讀取 `ecoku.env`。

## site

| 欄位 | 預設值 | 說明 |
| --- | --- | --- |
| `port` | `12123` | 容器內的監聽連接埠，範圍 1～65535。更動後要同步修改 `compose.yaml` 的連接埠對應。 |
| `log_path` | 空 | 日誌一律寫到 stdout，可用 `docker compose logs` 查看。填入檔案路徑時，會另外保存一份到該檔案，單一檔案滿 10 MB 即輪替，保留 5 個壓縮的舊檔案、最長 28 天。空值、`stdout`、`-` 或 `/dev/stdout` 表示只寫到 stdout。 |
| `trusted_proxies` | `[]` | 允許轉送 `X-Forwarded-For` 的直連對端，填 IP 或 CIDR。通常只填 Docker 閘道，例如 `172.18.0.1/32`。禁止 `0.0.0.0/0` 與 `::/0`。詳見[反向代理](../self-hosting/reverse-proxy#trusted-proxies)。 |

日誌不包含 IP、User-Agent、評論內文或憑據。存取日誌只記錄路由範本（例如 `/api/admin/sites/:siteId`），不記錄實際的路徑參數。

## client

| 欄位 | 預設值 | 說明 |
| --- | --- | --- |
| `static_dir` | 空 | 瀏覽器資源所在的目錄，容器內固定為 `/app/client`。填寫後，Ecoku 在 `/client/` 下提供 `ecoku-loader.js`、`ecoku.umd.js`、`ecoku.css`、`ecoku.unstyled.css`，缺少任一檔案都會拒絕啟動。留空則不提供這些檔案。 |

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
| `encryption_key_env` | 空 | 存放憑據加密主金鑰的環境變數名稱。在後台儲存 SMTP 密碼、Telegram Bot Token 或人機驗證 Secret Key 時需要它。 |
| `instance_public_url` | 空 | Ecoku 的公開網址，例如 `https://ecoku.example.com`。啟用電子郵件或 Telegram 通知前必須填寫。通知中的原文連結由站點 URL 和頁面路徑組成，不使用此網址。 |

## database

| 欄位 | 預設值 | 說明 |
| --- | --- | --- |
| `sqlite.path` | `./data/ecoku.bin` | SQLite 資料庫檔案路徑。容器範本使用 `/data/ecoku.sqlite3`，對應主機上的 `data/ecoku.sqlite3`。 |

資料庫以 WAL 模式執行，執行時同一目錄下會有 `-wal` 和 `-shm` 檔案，備份時需要把整個 `data/` 目錄一起保存。

## admin

| 欄位 | 預設值 | 說明 |
| --- | --- | --- |
| `enabled` | `false` | 是否啟用管理後台和管理 API。部署範本中為 `true`。關閉時 `/admin/` 與 `/api/admin/*` 都不存在。 |
| `static_dir` | `./admin` | 管理後台的靜態檔案目錄，容器內為 `/app/admin`。缺少 `index.html` 或 `assets/` 會拒絕啟動。 |
| `username_env` | — | 存放管理員使用者名稱的環境變數名稱。啟用後台時必填。 |
| `password_hash_env` | — | 存放管理員密碼 bcrypt 雜湊的環境變數名稱。啟用後台時必填。 |
| `token_key_env` | — | 存放工作階段簽章金鑰的環境變數名稱。啟用後台時必填。 |
| `token_ttl_minutes` | `480` | 為相容而保留的欄位。工作階段固定為登入後 8 小時，只能省略或寫 `480`，寫其他值會拒絕啟動。 |
| `allowed_origins` | — | 允許存取管理 API 的瀏覽器來源，也就是開啟後台時網址列中的 `协议://域名[:端口]`。啟用後台時至少填一個。 |

啟用後台時，Ecoku 在啟動階段還會檢查：

- 三個 `*_env` 必須是不同的環境變數，且值都不能為空；
- 密碼雜湊必須是有效的 bcrypt，cost 不低於 10（`hash-password` 產生的雜湊符合要求）；
- 簽章金鑰至少 32 個字元，且不能與密碼雜湊或任何站點管理金鑰相同；
- `allowed_origins` 不能與任何站點的允許來源重複。

## sites（選填） {#sites}

`sites` 用於在**全新資料庫第一次初始化時**預先寫入站點。資料庫一旦建立，站點就以資料庫為準，之後修改 YAML 中的站點設定不會再生效，請在後台管理站點。唯一的例外是 `management_key_env`，每次啟動都會讀取。大多數部署不需要寫這一節。

```yaml
sites:
  - id: "blog"
    site_url: "https://blog.example.com"
    name: "我的博客"
    allowed_origins:
      - "https://blog.example.com"
    management_key_env: "ECOKU_BLOG_MANAGEMENT_KEY"
    comment:
      default_sort: "newest"
      email_required: true
      website_required: false
      length_limit: 1000
```

| 欄位 | 說明 |
| --- | --- |
| `id` | 站點 ID，1～100 個字元，以字母或數字開頭，只能包含字母、數字、`.`、`_`、`-`。 |
| `site_url` | 站點的標準網址，用來組成通知中的原文連結。 |
| `name` | 站點名稱，最多 120 個字元。留空時顯示網域。 |
| `allowed_origins` | 允許嵌入評論區的來源，至少一個。 |
| `management_key_env` | 選填。存放該站點管理金鑰的環境變數名稱，值至少 32 個字元，各站點不能共用。管理金鑰的用途見 [REST API](./api#management-key)。 |
| `comment.default_sort` | `newest`（預設）或 `oldest`。 |
| `comment.email_required` | 信箱是否必填，預設為 `true`。 |
| `comment.website_required` | 網址是否必填，預設為 `false`。 |
| `comment.placeholder` | 評論框的提示文字，最多 80 個字元，不能換行。 |
| `comment.length_limit` | 內文字數上限，1～10000，預設 1000。 |
| `comment.empty_message` | 沒有評論時顯示的文字，最多 240 個字元。 |

## 環境變數

| 變數 | 必填 | 說明 |
| --- | --- | --- |
| `ECOKU_ADMIN_USERNAME` | 啟用後台時 | 管理員使用者名稱，1～80 個字元。變數名稱由 `admin.username_env` 決定。 |
| `ECOKU_ADMIN_PASSWORD_HASH` | 啟用後台時 | 管理員密碼的 bcrypt 雜湊。用 `hash-password` 指令產生，見[命令列](./cli#hash-password)。 |
| `ECOKU_ADMIN_TOKEN_KEY` | 啟用後台時 | 工作階段簽章金鑰，至少 32 個字元。可用 `openssl rand -hex 32` 產生。 |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | 儲存憑據時 | Base64 編碼的 32 位元組金鑰（有無填補皆可）。可用 `openssl rand -base64 32` 產生。 |
| `TZ` | 否 | 評論時間的顯示時區，填 IANA 名稱，例如 `Asia/Shanghai`。未設定時取決於容器的系統時區，建議明確填寫。 |
| `GIN_MODE` | 否 | 映像檔內已設為 `release`，不需要修改。 |

`ecoku.env` 中的每個值建議用單引號包住，避免 bcrypt 雜湊中的 `$` 被 Compose 展開。

更換 `ECOKU_ADMIN_TOKEN_KEY` 或密碼雜湊後重建容器，所有已登入的管理員工作階段都會失效。

`ECOKU_NOTIFICATION_ENCRYPTION_KEY` 不能隨意更換：資料庫中已經儲存的憑據是用舊金鑰加密的，換掉後 Ecoku 無法解密，會在啟動時報錯並結束。
