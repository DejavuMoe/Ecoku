# 快速上手

從一台裝好 Docker 的 Linux 主機開始，到部落格文章下出現評論區。這裡只放必要的命令，每一步的完整說明在對應頁面。

<div class="page-meta">
<div>

**你會完成**

- 在主機上執行 Ecoku
- 透過 HTTPS 登入管理後台
- 在一篇文章下看到評論區

</div>
<div>

**開始之前**

- Linux 主機，已裝 Docker 和 Compose v2.17+
- 一個給 Ecoku 用的網域，如 `ecoku.example.com`
- 主機上裝有 Caddy（或 Nginx）

</div>
</div>

<div class="steps">

### 建立部署目錄

```bash
mkdir -p ~/Ecoku/app ~/Ecoku/data && cd ~/Ecoku
sudo chown -R 10001:10001 data && sudo chmod 750 data
```

### 寫 compose.yaml 和 config.yaml

`compose.yaml`：

```yaml
services:
  ecoku:
    image: "ghcr.io/dejavumoe/ecoku:v0.6.4"
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
```

`app/config.yaml`，把位址換成你給 Ecoku 準備的網域：

```yaml
notifications:
  instance_public_url: "https://ecoku.example.com"
```

```bash
chmod 644 app/config.yaml
```

### 啟動並取得管理員密碼

先啟動一次，讓 Ecoku 建好資料庫和管理員帳戶；再停下來產生臨時密碼：

```bash
sudo docker compose up -d --wait
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d --wait
```

記下輸出裡 `管理员临时密码：` 後面的內容。它不會出現在日誌裡，遺失了就再執行一遍。

### 設定 HTTPS

在 Caddyfile 裡加上：

```caddyfile
ecoku.example.com {
    reverse_proxy 127.0.0.1:12123 {
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

重新載入 Caddy 後，再讓 Ecoku 信任來自 Docker 閘道的轉送標頭，否則所有訪客會共用一個限流額度：

```bash
sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}'
```

把輸出的位址（例如 `172.18.0.1`）寫進 `app/config.yaml`，然後重建容器：

```yaml
site:
  trusted_proxies: ["172.18.0.1/32"]
```

```bash
sudo docker compose up -d --force-recreate --wait
```

### 登入並登記部落格

開啟 `https://ecoku.example.com/admin/`，用 `admin` 和臨時密碼登入，依提示設定正式密碼。

接著在「新增站點」裡填：

- **站點 ID**：例如 `blog`，接入程式碼會用到
- **站點 URL**：`https://blog.example.com`
- **允許來源**：`https://blog.example.com`

### 嵌入評論區

把這段 HTML 放進文章範本裡評論區的位置。`data-page-key` 用範本變數輸出文章路徑，例如 Hugo 的 <code v-pre>{{ .RelPermalink }}</code>。

```html
<section id="ecoku-comments" class="ecoku-shell" data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/"
  data-page-title="你好，世界">
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新載入評論</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

開啟一篇文章，評論區就出現了。

</div>

## 接下來

<div class="cards">
<Card title="設定備份" link="/self-hosting/backup" icon="database">資料庫和金鑰檔案要一起備份。</Card>
<Card title="開啟通知" link="/admin/notifications" icon="bell">有新評論時收到電子郵件或 Telegram 訊息。</Card>
<Card title="設定部落客身分" link="/admin/blogger" icon="message">在自己的評論區以部落客身分回覆。</Card>
<Card title="調整外觀" link="/integration/custom-css" icon="sliders">讓評論區和部落格的配色一致。</Card>
</div>

遇到問題先看 [常見問題](../reference/faq)。正式環境的完整部署說明見 [Docker 安裝](../self-hosting/docker)。
