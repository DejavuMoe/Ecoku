# Docker 部署

本頁從一台全新的 Linux 主機開始，用 Docker Compose 執行一個 Ecoku 實例。你只需要準備三個檔案：`compose.yaml`、`app/config.yaml` 和 `ecoku.env`。完成後，服務只能在本機 `127.0.0.1:12123` 上存取；公開網路的 HTTPS 在下一步[反向代理](./reverse-proxy)中設定。

## 開始之前

你需要：

- 一台安裝了 Docker Engine 與 Compose v2（`docker compose` 指令）的 Linux 主機，以及 `sudo` 權限。
- 一個專門給 Ecoku 使用的網域，例如 `ecoku.example.com`。管理後台透過它存取，部落格透過它載入評論區腳本。它不能與部落格網域相同，原因見[第 3 步](#config)。
- 在這台主機上執行的 Caddy 或 Nginx，用來終止 HTTPS。

本頁中的 `ecoku.example.com`、`blog.example.com` 都是預留位置，請換成自己的網域。映像檔使用目前的發布版本 `git.via.moe/dejavu/ecoku:v0.2.7`。

部署完成後，目錄結構如下：

```text
~/Ecoku/
├── compose.yaml        # 容器定義
├── ecoku.env           # 管理員憑據、金鑰、時區（權限 600）
├── app/
│   ├── config.yaml     # 實例設定（唯讀掛載）
│   └── logs/           # 日誌檔案副本
└── data/
    └── ecoku.sqlite3   # 全部資料：站點、評論、設定
```

## 1. 準備目錄

容器以 UID/GID `10001:10001` 執行，根檔案系統為唯讀，只有掛載進去的 `app/logs` 和 `data` 可寫入。部署目錄和 `app/` 用你自己的帳號建立，之後編輯設定不需要 `sudo`；`app/logs` 和 `data` 的擁有者則設為容器使用者：

```bash
mkdir -p ~/Ecoku/app && cd ~/Ecoku
sudo install -d -o 10001 -g 10001 -m 750 app/logs data
```

## 2. 建立 compose.yaml

在 `~/Ecoku` 下新建 `compose.yaml`，內容如下：

```yaml
services:
  ecoku:
    image: "git.via.moe/dejavu/ecoku:v0.2.7"
    init: true
    restart: unless-stopped
    container_name: ecoku
    env_file:
      - ./ecoku.env
    ports:
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
      - ./app/logs:/var/log/ecoku
      - ./data:/data
    deploy:
      resources:
        limits:
          memory: 384M
    read_only: true
    tmpfs:
      - /tmp:rw,noexec,nosuid,nodev,size=16m
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--output-document=-", "http://127.0.0.1:12123/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    stop_grace_period: 30s
```

容器內的連接埠、目錄、日誌和資料庫路徑都已固定在映像檔裡，和上面的掛載一一對應。要更換主機上的位置，只改冒號前面的部分，例如把連接埠改成 `"127.0.0.1:8080:12123"`，或把資料放到 `/srv/ecoku-data:/data`。

有兩處請保持原樣：

- **連接埠只繫結 `127.0.0.1`**。寫成 `12123:12123` 會讓 Docker 在所有網路介面上開放連接埠，外部可以繞過反向代理直接存取，速率限制也會失效。
- **映像檔寫明確的版本號**。不要用 `latest`。升級時修改這一行，回滾時改回舊版本號，詳見[升級](./upgrade)。

其餘選項用於收緊容器權限：`read_only` 與 `tmpfs` 讓容器只能寫入 `/tmp`（16 MB）和掛載目錄；`cap_drop: ALL` 與 `no-new-privileges` 移除所有 Linux capability；`healthcheck` 每 30 秒請求一次容器內的 `/api/health`。

## 3. 建立 app/config.yaml {#config}

新建 `app/config.yaml`，只需要寫 Ecoku 的公開網址：

```yaml
notifications:
  instance_public_url: "https://ecoku.example.com"
```

然後設定權限：

```bash
chmod 644 ~/Ecoku/app/config.yaml
```

`instance_public_url` 有兩個用途：

- 管理後台只接受從這個位址（協定 + 網域 + 選填的連接埠）送來的請求，也就是你開啟後台時瀏覽器網址列裡的來源。它**不能與任何站點的允許來源重複**，後台儲存站點時會拒絕與它相同的來源。這就是 Ecoku 需要獨立網域的原因。
- 啟用電子郵件或 Telegram 通知前必須填寫，否則在後台儲存通知設定會失敗。

設定反向代理之後，還需要在這裡加上 `site.trusted_proxies`，見[反向代理](./reverse-proxy#trusted-proxies)。速率限制次數等其他欄位都有預設值，需要時再依[設定參考](../reference/configuration)新增。欄位名稱寫錯會導致啟動失敗。

`config.yaml` 不含密碼或金鑰，維持屬於你自己、權限 `644` 即可：容器以唯讀方式掛載它，之後修改也不需要 `sudo`。

## 4. 建立 ecoku.env {#env}

新建 `ecoku.env`，依下面的格式填寫，每個值都用單引號包住，避免 bcrypt 雜湊中的 `$` 被 Compose 當成變數展開：

```ini
TZ='Asia/Shanghai'
ECOKU_ADMIN_USERNAME='admin'
ECOKU_ADMIN_PASSWORD_HASH='$2a$10$...'
ECOKU_ADMIN_TOKEN_KEY='...'
ECOKU_NOTIFICATION_ENCRYPTION_KEY='...'
```

然後設定權限，只允許自己讀寫：

```bash
chmod 600 ~/Ecoku/ecoku.env
```

| 變數 | 填什麼 |
| --- | --- |
| `TZ` | 評論和通知的顯示時區，IANA 名稱，例如 `Asia/Shanghai`、`Asia/Tokyo`。 |
| `ECOKU_ADMIN_USERNAME` | 後台登入使用者名稱，1～80 個字元。 |
| `ECOKU_ADMIN_PASSWORD_HASH` | 後台密碼的 bcrypt 雜湊，不填明文密碼。用下面的指令產生。 |
| `ECOKU_ADMIN_TOKEN_KEY` | 管理員工作階段的簽章金鑰，至少 32 個字元。用下面的指令產生。更換後所有已登入的工作階段都會失效。 |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | 加密資料庫中的 SMTP 密碼、Telegram Bot Token 和人機驗證 Secret Key，Base64 編碼的 32 位元組。用下面的指令產生。 |

產生密碼雜湊（輸入時不回顯，把輸出的整串 `$2a$10$...` 填進 `ECOKU_ADMIN_PASSWORD_HASH`）：

```bash
read -rsp '管理員密碼: ' P; echo
printf '%s\n' "$P" | sudo docker run --rm -i git.via.moe/dejavu/ecoku:v0.2.7 hash-password
unset P
```

產生兩把金鑰（各執行一次，分別填入）：

```bash
openssl rand -hex 32      # ECOKU_ADMIN_TOKEN_KEY
openssl rand -base64 32   # ECOKU_NOTIFICATION_ENCRYPTION_KEY
```

::: danger 請把主金鑰和資料庫一起備份
在後台儲存過 SMTP、Telegram 或人機驗證憑據之後，`ECOKU_NOTIFICATION_ENCRYPTION_KEY` 就是解開它們的唯一鑰匙。金鑰遺失或被更動，Ecoku 會在啟動時因為無法解密而拒絕執行。[備份](./backup)時 `ecoku.env` 必須與 `data/` 放在同一份封存檔裡。
:::

## 5. 啟動並檢查

```bash
cd ~/Ecoku
sudo docker compose config --quiet   # 檢查語法，沒有輸出即為正常
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
```

首次啟動時，Ecoku 會在 `data/ecoku.sqlite3` 建立資料庫並初始化到最新的 schema。日誌中出現 `Server starting on :12123` 即表示服務已開始監聽。

在主機上確認健康檢查端點：

```bash
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

正常時回傳：

```json
{"code":200,"message":"Success","data":{"status":"healthy","timestamp":1790000000}}
```

健康檢查端點只能說明程式有在回應請求。如果容器反覆重新啟動，先看 `docker compose logs`：設定錯誤、環境變數為空、目錄權限不對，都會在日誌中寫明原因，常見情況見[常見問題](./faq)。

## 下一步

1. [設定反向代理](./reverse-proxy)，讓 `https://ecoku.example.com` 可以從公開網路存取。
2. 開啟 `https://ecoku.example.com/admin/` [登入後台](./admin)，註冊第一個站點。
3. 把評論區[嵌入部落格頁面](../integration/html)。

如果要從 Twikoo 遷移歷史評論，請在第 2 步註冊站點之後、有人發表新評論之前完成，見[從 Twikoo 遷移](./twikoo)。
