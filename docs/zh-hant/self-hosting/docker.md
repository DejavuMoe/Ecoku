# Docker 部署

單容器 Docker Compose，資料庫為 SQLite。容器只監聽宿主機 `127.0.0.1:12123`，公網 HTTPS 交給 Caddy 或 Nginx。

下文 `registry.example.com` 為映像位址佔位符，請換成實際倉庫。

## 準備目錄

需要 Docker Engine、Compose v2 和 HTTPS 網域。為每個執行個體準備獨立目錄：

```bash
mkdir -p ~/Ecoku/app/logs ~/Ecoku/data
cd ~/Ecoku
touch app/config.yaml ecoku.env
```

容器以非 root 使用者 `10001:10001` 執行：

```bash
sudo chown 10001:10001 app/config.yaml app/logs data
sudo chmod 640 app/config.yaml
sudo chmod 750 app/logs data
sudo chmod 600 ecoku.env
```

## Compose

使用與映像版本對應的範本。至少核對映像、連接埠和三個掛載：

```yaml
services:
  ecoku:
    image: registry.example.com/ecoku:vX.Y.Z
    restart: unless-stopped
    env_file: ./ecoku.env
    ports:
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
      - ./app/logs:/var/log/ecoku
      - ./data:/data
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
```

範本中的 `read_only`、`tmpfs`、丟棄能力和健康檢查應保留。不要使用 `latest`，也不要把連接埠綁到 `0.0.0.0`。

## 設定

`app/config.yaml` 至少包含：

```yaml
site:
  port: 12123
  log_path: /var/log/ecoku/ecoku.log
  trusted_proxies: []
notifications:
  encryption_key_env: ECOKU_NOTIFICATION_ENCRYPTION_KEY
  instance_public_url: https://comments.example.com
database:
  sqlite:
    path: /data/ecoku.sqlite3
admin:
  enabled: true
  allowed_origins:
    - https://comments.example.com
```

`trusted_proxies` 與反代見 [反向代理](./reverse-proxy)。`admin.allowed_origins` 是管理端來源，與評論站點來源分開設定。

可選：在 YAML 的 `sites[]` 裡為站點宣告 `management_key_env`，並在 `ecoku.env` 中提供對應變數。management key 只用於可信服務端自動化，且僅對 YAML 註冊的站點生效；管理端單獨建立的站點沒有 management key。不要把 key 寫進頁面或瀏覽器。

## 金鑰

`ecoku.env`（值勿寫入公開頁面或 Compose）：

```dotenv
GIN_MODE=release
TZ=Asia/Shanghai
ECOKU_ADMIN_USERNAME=
ECOKU_ADMIN_PASSWORD_HASH=
ECOKU_ADMIN_TOKEN_KEY=
ECOKU_NOTIFICATION_ENCRYPTION_KEY=
```

產生管理員密碼雜湊：

```bash
export ECOKU_IMAGE=registry.example.com/ecoku:vX.Y.Z
read -rsp 'Admin password: ' ECOKU_PASSWORD; echo
printf '%s\n' "$ECOKU_PASSWORD" | sudo docker run --rm -i --entrypoint /app/ecoku-server "$ECOKU_IMAGE" hash-password
unset ECOKU_PASSWORD
```

把輸出寫入 `ECOKU_ADMIN_PASSWORD_HASH`。其餘金鑰**分別**產生，且互不相同：

| 變數 | 要求 | 範例 |
| --- | --- | --- |
| `ECOKU_ADMIN_TOKEN_KEY` | 至少 32 個字元的隨機字串 | `openssl rand -hex 32` |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | Base64 編碼的 32 位元組 | `openssl rand -base64 32` |

## 啟動

```bash
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=200 ecoku
curl --fail http://127.0.0.1:12123/api/health
```

`healthy` 只表示行程可回應。管理端與評論頁需經反向代理存取後再驗收。
