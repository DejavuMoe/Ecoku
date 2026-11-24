# 人機驗證

人機驗證在訪客發布評論和你登入後台之前確認操作的是人。在後台「安全」頁三選一，對所有站點和後台登入同時生效：

| 方式 | 說明 |
| --- | --- |
| 關閉 | 不顯示驗證元件，只靠 [限流](../reference/configuration#rate-limit) 防止灌水 |
| Cloudflare Turnstile | Cloudflare 的託管服務，需要 Cloudflare 帳號 |
| Cap | 開源、自託管的驗證服務，需要自己部署一個實例 |

驗證失敗、沒有完成，或者驗證服務逾時、無法使用時，請求都會被拒絕，不會自動放行。所以驗證服務出問題時，你也會登不進後台；這時依 [關閉驗證](#disable) 處理。

Ecoku 向驗證服務核驗時只傳送 token 和 Secret Key，不帶訪客 IP。Secret Key 加密儲存在資料庫裡，後台不會再顯示它。切換方式時，另一種方式的設定會保留。

## Cloudflare Turnstile

1. 在 Cloudflare 控制台的 Turnstile 頁面新增一個元件（widget）。
2. Hostname 裡加上所有部落格網域，以及 Ecoku 的網域（後台登入頁要用）。
3. 複製 Sitekey 和 Secret key，在 Ecoku 後台「安全」頁選擇 Cloudflare Turnstile，填入並儲存。
4. 開啟一篇文章和後台登入頁，確認驗證能完成。

Ecoku 只在需要互動時顯示元件，評論區裡元件寬度不超過 300px。參考 [Cloudflare Turnstile 文件](https://developers.cloudflare.com/turnstile/)。

## Cap

[Cap](https://trycap.dev/)（[GitHub](https://github.com/tiagozip/cap)）是開源的驗證服務。Ecoku 從你的 Cap 實例載入元件和 WebAssembly 檔案，再向它核驗 token。

Cap 的位址必須是公開網路能存取的 HTTPS 位址。`localhost` 和內網 IP 無法儲存；網域解析到內網位址時能儲存，但 Ecoku 不會去連線，驗證會一直失敗。

### 部署 Cap

還沒有 Cap 實例的話，可以依下面的範例用 Docker Compose 部署一個。

:::: details 用 Docker Compose 部署 Cap

下面在 `~/capjs` 中用 Docker Compose 執行 Cap 和它依賴的 Valkey。Cap 只監聽本機 `127.0.0.1:3000`，再由反向代理提供 HTTPS。

```bash
mkdir -p ~/capjs/data && cd ~/capjs
sudo install -d -o 1000 -g 1000 -m 750 data/cap
sudo install -d -o 999 -g 1000 -m 750 data/valkey
```

寫入 `compose.yml`：

```bash
cd ~/capjs

cat <<'EOF' > compose.yml
services:
  cap:
    image: tiago2/cap:3.1.8
    restart: unless-stopped
    init: true
    stop_grace_period: 30s
    depends_on:
      valkey:
        condition: service_healthy
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      ADMIN_KEY: ${ADMIN_KEY:?ADMIN_KEY is required}
      REDIS_URL: redis://valkey:6379
      SERVER_PORT: "3000"
      CORS_ORIGIN: ${CORS_ORIGIN:?CORS_ORIGIN is required}
      ENABLE_ASSETS_SERVER: "true"
      WIDGET_VERSION: ${WIDGET_VERSION:?WIDGET_VERSION is required}
      WASM_VERSION: ${WASM_VERSION:?WASM_VERSION is required}
    volumes:
      - ./data/cap:/usr/src/app/data
    networks:
      - public
      - data
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    tmpfs:
      - /tmp:rw,noexec,nosuid,nodev,size=64m
    healthcheck:
      test:
        - CMD
        - bun
        - -e
        - "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 20s

  valkey:
    image: valkey/valkey:9.1.1-alpine
    restart: unless-stopped
    stop_grace_period: 30s
    user: "${VALKEY_UID:?VALKEY_UID is required}:${VALKEY_GID:?VALKEY_GID is required}"
    command:
      - valkey-server
      - --save
      - "60"
      - "1"
      - --appendonly
      - "yes"
      - --appendfsync
      - everysec
      - --loglevel
      - warning
      - --maxmemory-policy
      - noeviction
    volumes:
      - ./data/valkey:/data
    networks:
      - data
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    tmpfs:
      - /tmp:rw,noexec,nosuid,nodev,size=32m
    healthcheck:
      test:
        - CMD
        - valkey-cli
        - ping
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 5s

networks:
  public:
  data:
    internal: true
EOF
```

寫入 `.env`，把 `ADMIN_KEY` 換成一段隨機字串（可用 `openssl rand -hex 32` 產生），`CORS_ORIGIN` 換成你的部落格和 Ecoku 網域：

```bash
cd ~/capjs

cat <<'EOF' > .env
# Cap 管理面板的登入金鑰
ADMIN_KEY=replace-with-a-long-random-string
# 會呼叫 Cap 的頁面來源：所有部落格網域和 Ecoku 網域，以逗號分隔
CORS_ORIGIN=https://blog.example.com,https://ecoku.example.com
# Cap 提供的元件與 WebAssembly 檔案版本
WIDGET_VERSION=0.1.56
WASM_VERSION=0.0.7
VALKEY_UID=999
VALKEY_GID=1000
EOF

chmod 600 .env
sudo docker compose up -d
```

用 Caddy 為 Cap 提供 HTTPS，例如 `cap.example.com`：

```caddyfile
cap.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

**Cap 的管理頁也會被公開。** 這份 Caddy 設定代理了整個 Cap，包括它的管理頁。除了 Cap 自己的 `ADMIN_KEY`，建議依你部署的 Cap 版本的路由，給管理頁和管理 API 再加一層存取限制。元件、WebAssembly 和挑戰介面要讓訪客能存取，token 核驗介面要讓 Ecoku 伺服器能存取，不要把整個網域都鎖起來。

::::

### 在 Ecoku 中啟用 Cap

1. 開啟 `https://cap.example.com`，用 `.env` 裡的 `ADMIN_KEY` 登入 Cap 管理面板。
2. 新增一個 key，把部落格網域和 Ecoku 網域加入允許的主機，記下 Site key 和 Secret key。
3. 在 Ecoku 後台「安全」頁選擇 Cap，填寫實例位址 `https://cap.example.com`、Site key 和 Secret key，儲存。
4. 重新整理後台，再開啟一篇文章和後台登入頁，確認驗證能完成。

## 部落格頁面的 CSP {#csp}

Ecoku 管理後台的 CSP 會自動放行所選的驗證服務，重新整理後台後生效。

如果你的部落格頁面自己設定了 CSP，需要為驗證元件放行：

| 方式 | 部落格 CSP 需要允許 |
| --- | --- |
| Turnstile | `script-src` 和 `frame-src` 加 `https://challenges.cloudflare.com` |
| Cap | `script-src` 和 `connect-src` 加 Cap 實例來源，`worker-src blob:`，`frame-src 'self'`，以及 `'wasm-unsafe-eval'` |

Cap 的 key 如果開啟了 instrumentation（執行時檢測），`script-src` 還要加 `'unsafe-eval'`。不想放行的話，在 Cap 裡關掉 instrumentation，或者改用 Turnstile。

部落格使用基於 nonce 的 CSP 時，在載入 Ecoku 之前，用同一個 nonce 設定 `window.CAP_SCRIPT_NONCE` 和 `window.CAP_CSS_NONCE`。

## 登不進後台時關閉驗證 {#disable}

驗證服務設定錯誤或連不上時，你可能無法登入後台。在部署主機上用命令列關閉驗證：

```bash
(
set -eu
cd ~/Ecoku
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d --wait --wait-timeout 120 ecoku
)
```

然後用帳號密碼登入，在「安全」頁修好設定再重新啟用。已儲存的 Sitekey 和 Secret key 不會被清除。
