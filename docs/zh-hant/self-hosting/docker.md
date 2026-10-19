# Docker 部署

本頁適用於 v0.5.3 及後續公開版本，映像檔使用 GHCR。既有實例請先閱讀 [升級說明](./upgrade)。

本頁從一台空的 Linux 主機開始，用 Docker Compose 部署 Ecoku。新部署只需準備：`compose.yaml`、`app/config.yaml` 和 `data/` 目錄。首次啟動會建立管理員帳戶並產生持久金鑰；登入用的臨時密碼由下方的重設命令輸出，不需要寫進設定檔。

## 開始之前

你需要：

- 一台裝有 Docker Engine 與 Compose 的 Linux 主機，以及 `sudo` 權限；Compose 須支援 `up --wait --wait-timeout`（可用 `docker compose up --help` 檢查）；
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
    image: "ghcr.io/dejavumoe/ecoku:v0.5.3"
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

連接埠只綁定 `127.0.0.1`。要更換主機連接埠，只改冒號前面的部分，例如 `"127.0.0.1:8080:12123"`，不用改容器內連接埠。確實要改容器監聽連接埠時，依 [設定範本](#config) 的說明同時修改 `site.port`、Compose 的容器連接埠和健康檢查。日誌寫到標準輸出，用 `docker compose logs` 查看，保留與輪替由 Docker 管理。

## 3. 建立 app/config.yaml {#config}

下面的範本列出全部設定項及其預設值、可選值和範例。把 `instance_public_url` 改成 Ecoku 自己的 HTTPS 位址，其他未註解的值保持預設即可。註解中的賦值是可選覆寫項，需要時再取消註解，並依註解同步掛載或連接埠。

<div class="config-template">

<<< ../../../deploy/config.zh-hant.yaml.example{yaml}

</div>

讓容器中的非 root 使用者可以讀取設定：

```bash
chmod 644 ~/Ecoku/app/config.yaml
```

## 4. 啟動並等待初始化完成 {#start}

```bash
(
set -eu
cd ~/Ecoku
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d --wait --wait-timeout 120
sudo docker compose ps
)
```

命令成功後，容器狀態應為 `healthy`。`--wait` 會等待健康檢查通過，最多等待 120 秒；結束時報錯或容器未健康時，先執行 `sudo docker compose logs --tail=100 ecoku` 排查，修正後重試，不要繼續重設密碼。

首次啟動會初始化 SQLite、建立管理員 `admin`，並將工作階段簽章金鑰和通知加密主金鑰儲存到 `data/ecoku-secrets.json`。重新啟動不會重設管理員密碼，也不會覆寫持久金鑰。

## 5. 取得管理員臨時密碼 {#temporary-password}

**新部署必須完成這一步。自 v0.5.2 起，啟動日誌不提供初始密碼，也沒有固定預設密碼。** 先完成 [啟動與健康檢查](#start)，再於部署主機終端執行：

```bash
(
set -eu
cd ~/Ecoku
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d --wait --wait-timeout 120
)
```

在這次命令的終端輸出中找到 `管理员临时密码：…`，儲存冒號後的臨時密碼。密碼由 `docker compose run` 的一次性容器輸出；`docker compose logs ecoku` 查看的是服務容器日誌，無法找回它。遺失時重新執行本步，會產生新密碼並使舊密碼與全部管理員工作階段失效。不要將終端輸出轉發到共用日誌或工單。

如果沒有看到這行輸出，先處理命令報錯，再重試；上面的命令組遇錯會停止。提示 `管理员账户尚未初始化` 時，檢查是否使用正確的部署目錄、設定和資料掛載；全新實例須先完成 [第 4 步](#start)。不能透過刪除資料庫或持久金鑰來解決。

已有正式帳戶的實例升級時不需要執行本步。舊實例若仍未完成首次改密，則應執行本步：僅升級不會使舊日誌中的臨時密碼失效。

## 6. 首次登入 {#first-sign-in}

先完成 [取得管理員臨時密碼](#temporary-password)，再依 [為 Ecoku 網域設定 HTTPS 反向代理](./reverse-proxy) 完成 Caddy 或 Nginx 設定，並確認公開健康介面可以存取。容器預設只監聽主機迴路連接埠，不能直接從外網開啟。`notifications.instance_public_url` 必須與實際後台位址的來源一致；不要保留範例網域。

開啟 `https://ecoku.example.com/admin/`，使用者名稱填寫 `admin`，密碼填寫剛才命令輸出的臨時密碼。登入後會進入「设置你的密码」頁面，必須先完成設定：

- 使用者名稱可以保留 `admin`，也可以改成自己的名稱；
- 新密碼至少 12 個字元，最多 72 個 UTF-8 位元組；
- 新密碼不能沿用臨時密碼；
- 完成前不能進入站點、評論、通知或安全頁面。

儲存後，Ecoku 會撤銷臨時工作階段，並直接開啟「站点」頁面的「新增站点」表單。

忘記臨時密碼或正式密碼時，使用同樣的 [管理員密碼重設步驟](../reference/cli#admin-reset-password)。使用者名稱維持目前的值；用它和新的臨時密碼登入後，同樣需要重新設定密碼。

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
