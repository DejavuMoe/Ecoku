# Docker 部署

本頁從一台全新的 Linux 主機開始，用 Docker Compose 執行一個 Ecoku 實例。完成後，服務只能在本機 `127.0.0.1:12123` 上存取；公開網路的 HTTPS 在下一步[反向代理](./reverse-proxy)中設定。

## 開始之前

你需要：

- 一台安裝了 Docker Engine 與 Compose v2（`docker compose` 指令）的 Linux 主機，以及 `sudo` 權限。
- 一個專門給 Ecoku 使用的網域，例如 `ecoku.example.com`。管理後台透過它存取，部落格透過它載入評論區腳本。它不能與部落格網域相同，原因見下文的 `admin.allowed_origins`。
- 在這台主機上執行的 Caddy 或 Nginx，用來終止 HTTPS。

本頁指令中的 `ecoku.example.com`、`blog.example.com` 都是預留位置，請換成自己的網域。映像檔使用目前的發布版本 `git.via.moe/dejavu/ecoku:v0.2.6`。

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

## 1. 建立目錄

容器以 UID/GID `10001:10001` 執行，根檔案系統為唯讀，只有掛載進去的 `app/logs` 和 `data` 可寫入。部署目錄和 `app/` 用你自己的帳號建立，之後編輯設定不需要 `sudo`；`app/logs` 和 `data` 的擁有者則設為容器使用者：

```bash
mkdir -p ~/Ecoku/app && cd ~/Ecoku
sudo install -d -o 10001 -g 10001 -m 750 app/logs data
```

## 2. 撰寫 compose.yaml

```bash
cd ~/Ecoku

cat <<'EOF' > compose.yaml
services:
  ecoku:
    image: "git.via.moe/dejavu/ecoku:v0.2.6"
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
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
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
EOF
```

有兩處請保持原樣：

- **連接埠只繫結 `127.0.0.1`**。寫成 `12123:12123` 會讓 Docker 在所有網路介面上開放連接埠，外部可以繞過反向代理直接存取，速率限制也會失效。
- **映像檔寫明確的版本號**。不要用 `latest`。升級時修改這一行，回滾時改回舊版本號，詳見[升級](./upgrade)。

其餘選項用於收緊容器權限：`read_only` 與 `tmpfs` 讓容器只能寫入 `/tmp`（16 MB）和掛載目錄；`cap_drop: ALL` 與 `no-new-privileges` 移除所有 Linux capability；`healthcheck` 每 30 秒請求一次容器內的 `/api/health`。

## 3. 撰寫 app/config.yaml

```bash
cd ~/Ecoku

cat <<'EOF' > app/config.yaml
site:
  port: 12123
  # 日誌一律寫到 stdout；這裡再額外保存一份到檔案，由程式自動輪替
  log_path: "/var/log/ecoku/ecoku.log"
  # 先留空，設定好反向代理後再填入 Docker 閘道位址，見「反向代理」
  trusted_proxies: []

client:
  static_dir: "/app/client"

rate_limit:
  window_seconds: 60
  comment_submit: 5
  comment_list: 60
  comment_delete: 30
  admin_login: 5
  notification_test: 5

notifications:
  encryption_key_env: "ECOKU_NOTIFICATION_ENCRYPTION_KEY"
  instance_public_url: "https://ecoku.example.com"

database:
  sqlite:
    path: "/data/ecoku.sqlite3"

admin:
  enabled: true
  static_dir: "/app/admin"
  username_env: "ECOKU_ADMIN_USERNAME"
  password_hash_env: "ECOKU_ADMIN_PASSWORD_HASH"
  token_key_env: "ECOKU_ADMIN_TOKEN_KEY"
  token_ttl_minutes: 480
  allowed_origins:
    - "https://ecoku.example.com"
EOF

chmod 644 app/config.yaml
```

`config.yaml` 不含密碼或金鑰，維持屬於你自己、權限 `644` 即可：容器以唯讀方式掛載它，靠其他使用者的讀取權限讀取，之後修改也不需要 `sudo`。

需要依自己的環境修改的只有兩處：

- `notifications.instance_public_url`：Ecoku 的公開網址。啟用電子郵件或 Telegram 通知前必須填寫，否則在後台儲存通知設定會失敗。
- `admin.allowed_origins`：開啟管理後台時瀏覽器網址列中的來源（協定 + 網域 + 選填的連接埠）。它**不能與任何站點的允許來源重複**，在後台儲存站點時會拒絕與它相同的來源。這就是 Ecoku 需要獨立網域的原因。

設定檔不存放任何密碼或金鑰，只寫環境變數的名稱，實際的值放在下一步的 `ecoku.env`。未知欄位會導致啟動失敗，所有欄位的意義見[設定參考](../reference/configuration)。

## 4. 產生 ecoku.env {#env}

`ecoku.env` 存放管理員憑據和兩把金鑰。下面這段腳本可以重複執行：已經存在的項目會略過，不會覆寫；輸入密碼時不會回顯；每個值都用單引號包住，避免 bcrypt 雜湊中的 `$` 被 Compose 當成變數展開。

```bash
cd ~/Ecoku
touch ecoku.env && chmod 600 ecoku.env

grep -q '^GIN_MODE=' ecoku.env || echo "GIN_MODE='release'" >> ecoku.env
grep -q '^TZ=' ecoku.env || echo "TZ='Asia/Shanghai'" >> ecoku.env
grep -q '^ECOKU_ADMIN_USERNAME=' ecoku.env || echo "ECOKU_ADMIN_USERNAME='admin'" >> ecoku.env

# 管理員密碼：互動式輸入，只保存 bcrypt 雜湊
if ! grep -q '^ECOKU_ADMIN_PASSWORD_HASH=' ecoku.env; then
  read -rsp '管理员密码: ' ADMIN_PASS; echo
  HASH=$(printf '%s\n' "$ADMIN_PASS" | sudo docker run --rm -i "git.via.moe/dejavu/ecoku:v0.2.6" hash-password)
  unset ADMIN_PASS
  if [ -n "$HASH" ]; then
    echo "ECOKU_ADMIN_PASSWORD_HASH='$HASH'" >> ecoku.env
  else
    echo '產生密碼雜湊失敗，請重新執行本段腳本' >&2
  fi
fi

# 管理員工作階段簽章金鑰：64 個十六進位字元
grep -q '^ECOKU_ADMIN_TOKEN_KEY=' ecoku.env || \
  echo "ECOKU_ADMIN_TOKEN_KEY='$(openssl rand -hex 32)'" >> ecoku.env

# 憑據加密主金鑰：Base64 編碼的 32 位元組
grep -q '^ECOKU_NOTIFICATION_ENCRYPTION_KEY=' ecoku.env || \
  echo "ECOKU_NOTIFICATION_ENCRYPTION_KEY='$(openssl rand -base64 32)'" >> ecoku.env
```

各變數的作用：

| 變數 | 說明 |
| --- | --- |
| `TZ` | 評論時間依這個時區顯示，填 IANA 名稱，例如 `Asia/Tokyo`。 |
| `ECOKU_ADMIN_USERNAME` | 後台登入使用者名稱，1～80 個字元。 |
| `ECOKU_ADMIN_PASSWORD_HASH` | 後台密碼的 bcrypt 雜湊，由映像檔內建的 `hash-password` 指令產生。 |
| `ECOKU_ADMIN_TOKEN_KEY` | 管理員工作階段的簽章金鑰，至少 32 位元組。更換後所有已登入的工作階段都會失效。 |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | 加密資料庫中的 SMTP 密碼、Telegram Bot Token 和人機驗證 Secret Key。 |

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
