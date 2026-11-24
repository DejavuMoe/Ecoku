# Docker 安裝

這是正式環境的完整安裝步驟，比 [快速上手](../guide/quick-start) 多了資源限制、設定說明和排錯方法。已經在執行的實例請看 [升級](./upgrade)。

<div class="page-meta">
<div>

**你會完成**

- 用 Docker Compose 執行 Ecoku
- 取得管理員臨時密碼並首次登入

</div>
<div>

**開始之前**

- Linux 主機，Docker Engine 和 Compose v2.17+，`sudo` 權限
- 一個給 Ecoku 單獨用的網域，不和部落格共用
- 同一台主機上的 Caddy 或 Nginx

</div>
</div>

完成後，部署目錄是這樣的：

```text
~/Ecoku/
├── compose.yaml
├── app/
│   └── config.yaml
└── data/                  # 由 Ecoku 建立和寫入
    ├── ecoku.sqlite3
    ├── ecoku.sqlite3-wal
    ├── ecoku.sqlite3-shm
    └── ecoku-secrets.json
```

<div class="steps">

### 建立目錄

容器以 UID/GID `10001:10001` 執行，只有 `data/` 需要可寫入：

```bash
mkdir -p ~/Ecoku/app ~/Ecoku/data
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
```

### 寫 compose.yaml

```yaml
services:
  ecoku:
    image: "ghcr.io/dejavumoe/ecoku:v0.6.3"
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
      test: ["CMD", "/app/ecoku-server", "healthcheck"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    stop_grace_period: 30s
```

- 映像檔寫精確版本號，不要用 `latest`。
- 連接埠只綁定 `127.0.0.1`，外網要經過反向代理。更換主機連接埠只改冒號前的部分。
- `TZ` 和 `ECOKU_ADMIN_LOCALE` 見 [時區與後台語言](#timezone)。

### 寫 app/config.yaml {#config}

新部署只需要一行：

```yaml
notifications:
  instance_public_url: "https://ecoku.example.com"
```

把位址換成 Ecoku 自己的 HTTPS 位址（不是部落格位址），然後讓容器能讀取它：

```bash
chmod 644 ~/Ecoku/app/config.yaml
```

其他設定項都有預設值。想了解全部選項，看 [設定檔](../reference/configuration)。

### 啟動 {#start}

```bash
cd ~/Ecoku
sudo docker compose pull
sudo docker compose up -d --wait --wait-timeout 120
sudo docker compose ps
```

最後一行應顯示 `healthy`。第一次啟動會建立資料庫、管理員帳戶 `admin`，以及儲存金鑰的 `data/ecoku-secrets.json`。

沒有變成 `healthy` 時，用 `sudo docker compose logs --tail=100 ecoku` 查看原因，常見情況見 [常見問題](../reference/faq#deploy)。

### 取得管理員臨時密碼 {#temporary-password}

Ecoku 沒有預設密碼，日誌裡也不會印出密碼。停下服務，用一次性命令產生臨時密碼：

```bash
cd ~/Ecoku
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d --wait --wait-timeout 120
```

在輸出裡找到 `管理员临时密码：…`，記下冒號後的內容。這行只出現在這次命令的終端裡，`docker compose logs` 看不到。遺失了就再執行一次。

::: details 提示「管理员账户尚未初始化」
命令開啟的資料庫裡還沒有帳戶。檢查目前目錄、`config.yaml` 和 `data/` 是否屬於這個實例；全新實例要先完成上一步的啟動。不要刪除資料庫或 `ecoku-secrets.json`。
:::

### 設定 HTTPS

依 [反向代理與 HTTPS](./reverse-proxy) 設定好 Caddy 或 Nginx，確認 `https://ecoku.example.com/api/health` 能開啟。

### 首次登入 {#first-sign-in}

開啟 `https://ecoku.example.com/admin/`，使用者名稱 `admin`，密碼是上面的臨時密碼。

登入後先設定正式密碼：至少 12 個字元，不超過 72 個 UTF-8 位元組，不能與臨時密碼相同。使用者名稱可以順便改掉。儲存後會開啟「新增站點」表單，接著看 [站點設定](../admin/sites)。

</div>

## 時區與後台語言 {#timezone}

這兩項寫在 `compose.yaml` 的 `environment` 裡，改完執行 `sudo docker compose up -d` 生效。

| 變數 | 作用 | 取值 |
| --- | --- | --- |
| `TZ` | 評論區、後台和通知裡時間的顯示時區 | IANA 時區名稱，如 `Asia/Shanghai`、`Europe/Berlin`。預設 `Asia/Shanghai`。 |
| `ECOKU_ADMIN_LOCALE` | 管理後台的介面語言 | `zh-CN`、`zh-Hant` 或 `en`。無法辨識時使用 `zh-CN`。 |

評論區的語言在後台每個站點裡單獨設定，見 [站點設定](../admin/sites)。

## 下一步

<div class="cards">
<Card title="登記站點" link="/admin/sites" icon="globe">在後台新增你的部落格，取得站點 ID。</Card>
<Card title="設定備份" link="/self-hosting/backup" icon="database">資料庫和金鑰檔案要一起備份。</Card>
</div>
