# Docker 部署

::: info 升級與設定遷移
本頁描述 v0.2.9 的部署方式。升級 v0.2.8 前請先閱讀[升級與舊設定遷移](./upgrade#legacy-config)。既有實例可以繼續保留舊的 `ecoku.env` 和 Compose；確認新登入正常後再刪除舊環境變數。
:::

新部署只需要 `compose.yaml`、`app/config.yaml` 和 `data/`。Ecoku 會在首次啟動時自動建立管理員密碼、工作階段簽章金鑰和通知加密主金鑰。

## 開始之前

你需要一台裝有 Docker Engine 與 Compose v2 的 Linux 主機、一個獨立網域（例如 `ecoku.example.com`），以及負責終止公開 HTTPS 的反向代理。`instance_public_url` 必須自行填寫；Ecoku 不會從不可信的 Host 或轉送標頭推斷管理後台來源。

```text
~/Ecoku/
├── compose.yaml
├── app/config.yaml
└── data/
    ├── ecoku.sqlite3
    ├── ecoku.sqlite3-wal
    ├── ecoku.sqlite3-shm
    └── ecoku-secrets.json
```

`data/` 中的檔案由 Ecoku 自動建立。資料庫和持久金鑰必須一起備份。

## 1. 準備目錄

容器以 UID/GID `10001:10001` 執行，只有掛載的 `data` 可寫入：

```bash
mkdir -p ~/Ecoku/app ~/Ecoku/data
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
```

## 2. 建立 compose.yaml

```yaml
services:
  ecoku:
    image: "git.via.moe/dejavu/ecoku:v0.2.9"
    init: true
    restart: unless-stopped
    container_name: ecoku
    ports:
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
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

容器內連接埠固定為 `12123`。要更換主機連接埠，只改冒號前面的部分，例如 `"127.0.0.1:8080:12123"`。日誌寫到標準輸出，用 `docker compose logs` 查看，保留與輪替由 Docker 管理。

## 3. 建立 app/config.yaml {#config}

```yaml
notifications:
  instance_public_url: "https://ecoku.example.com"
```

```bash
chmod 644 ~/Ecoku/app/config.yaml
```

設定反向代理後，如需按訪客地址限流，再加入 `site.trusted_proxies`，見[反向代理](./reverse-proxy#trusted-proxies)。其他設定都有預設值。

## 4. 啟動

```bash
cd ~/Ecoku
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
```

首次啟動時，Ecoku 會初始化 SQLite、建立 `admin`、把一次性隨機臨時密碼印到日誌，並把工作階段簽章金鑰和通知加密主金鑰保存到 `data/ecoku-secrets.json`。重新啟動不會產生新密碼或替換金鑰。能讀取 Docker 日誌的人也能看到臨時密碼，登入後請立即修改。

確認健康介面：

```bash
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

## 5. 首次登入

開啟 `https://ecoku.example.com/admin/`，以 `admin` 和首次啟動日誌中的臨時密碼登入。接著必須設定正式密碼：

- 可以保留 `admin`，也可以改用其他使用者名稱；
- 至少 12 個字元，最多 72 個 UTF-8 位元組；
- 不能繼續使用臨時密碼；
- 完成前不能進入站點、評論、通知或安全頁面。

儲存後，Ecoku 會撤銷臨時工作階段，並開啟現有的「站點」頁面和「新增站點」狀態。

忘記臨時密碼時，先停止服務，再在本機重設：

```bash
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d
```

命令會列印新的臨時密碼，所有管理員工作階段都會失效。

## 時區

新部署不需要 `ecoku.env`。如果要指定評論和通知的顯示時區，可在 Compose 服務中加入：

```yaml
    environment:
      TZ: Asia/Shanghai
```

既有實例可以保留舊的 `ecoku.env`。升級時其中的管理員憑據和金鑰會導入持久狀態，見[升級](./upgrade#legacy-config)。

## 下一步

1. [設定反向代理](./reverse-proxy) 讓 `https://ecoku.example.com` 可從公開網路存取；
2. 在「站點」頁面建立第一個站點；
3. [嵌入評論區](../integration/html)。

要匯入 Twikoo 歷史評論，先建立站點，再依[Twikoo 遷移](./twikoo)操作。
