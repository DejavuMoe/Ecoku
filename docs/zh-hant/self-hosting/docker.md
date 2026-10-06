# Docker 部署

本頁適用於 v0.3.6 及後續公開版本，映像檔使用 GHCR。既有實例請先閱讀 [升級說明](./upgrade)。

本頁從一台空的 Linux 主機開始，用 Docker Compose 部署 Ecoku。新部署只需要三樣東西：`compose.yaml`、`app/config.yaml` 和 `data/`。管理員臨時密碼、工作階段簽章金鑰和通知加密主金鑰都在首次啟動時自動產生，不需要寫進設定檔。

## 開始之前

你需要：

- 一台裝有 Docker Engine 與 Compose v2 的 Linux 主機，以及 `sudo` 權限；
- 一個專門給 Ecoku 使用的網域，例如 `ecoku.example.com`；
- 一個反向代理，用來終止公開 HTTPS。

`instance_public_url` 必須自行填寫。Ecoku 不會從不可信的 Host 或轉送標頭推斷管理後台來源。

部署目錄如下：

```text
~/Ecoku/
├── compose.yaml
├── app/
│   └── config.yaml
└── data/
    ├── ecoku.sqlite3
    ├── ecoku.sqlite3-wal
    ├── ecoku.sqlite3-shm
    └── ecoku-secrets.json
```

`data/` 中的檔案由 Ecoku 自動建立。資料庫和持久金鑰必須一起備份，見 [備份與還原](./backup)。

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
    image: "ghcr.io/dejavumoe/ecoku:v0.3.6"
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

連接埠只綁定 `127.0.0.1`。要更換主機連接埠，只改冒號前面的部分，例如 `"127.0.0.1:8080:12123"`；容器內連接埠始終是 `12123`。日誌寫到標準輸出，用 `docker compose logs` 查看，保留與輪替由 Docker 管理。

## 3. 建立 app/config.yaml {#config}

下面的範本列出全部設定項及其預設值、可選值和範例。把 `instance_public_url` 改成 Ecoku 自己的 HTTPS 位址，其他未註解的值保持預設即可。註解中的賦值是可選覆寫項，需要時再取消註解，並依註解同步掛載或連接埠。

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

首次啟動時，Ecoku 會：

1. 初始化 SQLite 資料庫並執行遷移；
2. 建立管理員 `admin`；
3. 產生一次性隨機臨時密碼並印到日誌；
4. 在 `data/ecoku-secrets.json` 保存工作階段簽章金鑰和通知加密主金鑰。

日誌中對應的一行是 `Ecoku 首次启动管理员账户：admin；临时密码：…；请登录后台后立即修改密码`。臨時密碼只在首次建立帳戶時產生，重新啟動不會產生新密碼，也不會覆寫持久金鑰。能讀取 Docker 日誌的人都能看到臨時密碼，首次登入改密後它即失效。

確認健康介面：

```bash
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

## 5. 首次登入

開啟後台前，請先依 [為 Ecoku 網域設定 HTTPS 反向代理](./reverse-proxy) 完成 Caddy 或 Nginx 設定，並確認公開健康介面可以存取。容器預設只監聽主機迴路連接埠，不能直接從外網開啟。

開啟 `https://ecoku.example.com/admin/`，使用者名稱填寫 `admin`，密碼填寫首次啟動日誌中的臨時密碼。登入後會進入「设置你的密码」頁面，必須先完成設定：

- 使用者名稱可以保留 `admin`，也可以改成自己的名稱；
- 新密碼至少 12 個字元，最多 72 個 UTF-8 位元組；
- 新密碼不能沿用臨時密碼；
- 完成前不能進入站點、評論、通知或安全頁面。

儲存後，Ecoku 會撤銷臨時工作階段，並直接開啟「站点」頁面的「新增站点」表單。

忘記臨時密碼或正式密碼時，先停止服務，再在主機上執行重設命令：

```bash
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d
```

命令輸出 `管理员临时密码：…`，並使既有的管理員工作階段全部失效。使用者名稱維持目前的值；用它和新的臨時密碼登入後，同樣需要重新設定密碼。

## 時區與後台語言 {#timezone}

上面的 Compose 已設定 `TZ: Asia/Shanghai` 和 `ECOKU_ADMIN_LOCALE: zh-CN`：

- `TZ` 決定評論區和通知中的時間顯示，填寫 IANA 時區名稱，例如 `Asia/Shanghai`、`Europe/Berlin`。
- `ECOKU_ADMIN_LOCALE` 決定管理後台語言，可選 `zh-CN`、`zh-Hant` 或 `en`。無法辨識的值會在啟動日誌中提示，並改用 `zh-CN`。

修改後執行 `sudo docker compose up -d` 重建容器，不需要另建 `ecoku.env`。評論區語言不在這裡設定：它取自後台站點設定的「评论区语言」，接入程式碼中載入器的 `data-i18n` 或 SDK 的 `i18n` 參數可以覆寫。

既有實例可以繼續使用原來的 `ecoku.env`。如需刪除舊管理員憑據和金鑰變數，請依 [導入持久狀態、停服備份並移除舊變數](./upgrade#legacy-config) 操作。如果時區仍寫在舊環境檔中，先把 `TZ` 移到 Compose，再刪除該檔案。

## 下一步

1. 在後台 [建立第一個站點](./admin#sites)，取得接入所需的站點 ID；
2. 依 [HTML 接入步驟](../integration/html) 將評論區嵌入部落格頁面；
3. 依 [備份與還原](./backup) 備份設定、資料庫和持久金鑰。

如果要遷移 Twikoo 歷史評論，請先建立站點，再依 [從 Twikoo 遷移](./twikoo) 操作。
