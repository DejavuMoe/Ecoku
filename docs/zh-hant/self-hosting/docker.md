# Docker 部署

本頁適用於 v0.3.0 及後續公開版本，映像檔使用 GHCR。既有實例請先閱讀 [升級說明](./upgrade)。

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
    image: "ghcr.io/dejavumoe/ecoku:v0.3.0"
    init: true
    restart: unless-stopped
    container_name: ecoku
    environment:
      TZ: Asia/Shanghai
      ECOKU_ADMIN_LOCALE: zh-CN
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

以下範本集中列出目前原始碼仍支援的設定、預設值、可選值與範例。先將 `instance_public_url` 替換為 Ecoku 自己的 HTTPS 位址；其他未註解的值保持預設。註解中的賦值是可選覆寫項，只在需要時取消註解，並依說明同步掛載或連接埠。

<div class="config-template">

<<< ../../../deploy/config.zh-hant.yaml.example{yaml}

</div>

讓容器中的非 root 使用者可以讀取設定：

```bash
chmod 644 ~/Ecoku/app/config.yaml
```

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

開啟後台前，請先依[為 Ecoku 網域設定 HTTPS 反向代理](./reverse-proxy)完成 Caddy 或 Nginx 設定，並確認公開健康介面可存取。容器預設只綁定主機迴路連接埠，不能直接從外網開啟。

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

## 時區 {#timezone}

上面的 Compose 已設定 `TZ: Asia/Shanghai` 和 `ECOKU_ADMIN_LOCALE: zh-CN`。前者控制評論與通知時區，後者控制管理後台語言，可改為 `zh-Hant` 或 `en`。修改後執行 `sudo docker compose up -d` 重建容器。站點評論區語言在後台站點的「評論區語言」中設定，SDK 的 `i18n` 參數可以覆寫站點預設值。無需另建 `ecoku.env`。

既有實例可以繼續使用原來的 `ecoku.env`。如需刪除舊管理員憑據和金鑰變數，請依[導入持久狀態、停服備份並移除舊變數](./upgrade#legacy-config)操作。如果時區仍寫在舊環境檔中，先把 `TZ` 移到 Compose，再刪除該檔案。

## 下一步

1. 在後台[建立第一個站點](./admin#sites)，取得接入所需的站點 ID；
2. 依 [HTML 接入步驟](../integration/html)將評論區嵌入部落格頁面；
3. 依[備份與還原](./backup)備份設定、資料庫和持久金鑰。

要匯入 Twikoo 歷史評論，先建立站點，再依[Twikoo 遷移](./twikoo)操作。
