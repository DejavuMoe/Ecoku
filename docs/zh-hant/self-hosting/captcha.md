# 人機驗證

Ecoku 可以要求訪客在發布評論前、管理員在登入前先通過一次人機驗證。在後台「安全」頁從三種方式中選擇一種：

| 方式 | 說明 |
| --- | --- |
| 關閉 | 不顯示驗證元件，只靠[速率限制](../reference/configuration#rate-limit)防止灌水。 |
| Cloudflare Turnstile | Cloudflare 提供的託管驗證服務，需要 Cloudflare 帳號。 |
| Cap | 開源、可自行託管的驗證服務，需要自己部署一個 Cap 實例。 |

這項設定對整個實例生效，所有站點和後台登入都使用同一種方式。

## 驗證如何生效

- 瀏覽器在送出評論或登入時附帶一個一次性 token，伺服器端向 Turnstile 或 Cap 核驗後才繼續處理。核驗發生在檢查部落客口令之前，沒通過驗證就無法試探口令。
- 核驗失敗、缺少 token，或者驗證服務逾時、無法使用，請求都會被拒絕，不會自動放行，也不會改用另一種方式。
- 伺服器端核驗時只傳送 token 和 Secret Key，不附帶訪客 IP。
- Secret Key 使用 `data/ecoku-secrets.json` 中的通知加密主金鑰加密後存入資料庫；主金鑰首次啟動時自動產生，後台只顯示「已设置，输入新值以更换」。備份時必須同時保存資料庫和此金鑰檔案。
- 切換或關閉驗證方式時，另一種方式已填寫的設定會保留，切換回來時不必重填。

## Cloudflare Turnstile

1. 在 Cloudflare 主控台的 Turnstile 頁面新增一個元件（widget）。
2. 在 Hostname 清單中加入所有部落格網域（例如 `blog.example.com`），以及 Ecoku 的網域（例如 `ecoku.example.com`，後台登入頁需要）。
3. 元件模式依需要選擇。Ecoku 以「僅在需要互動時顯示」的方式呈現元件；評論區中的元件寬度不超過 300px。
4. 複製 Sitekey 和 Secret key，在後台「安全」頁選擇 Cloudflare Turnstile，填入並儲存。

官方文件：[Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)

## Cap

[Cap](https://trycap.dev/)（[GitHub](https://github.com/tiagozip/cap)）是一套開源的驗證服務，可以部署在自己的伺服器上。Ecoku 從你的 Cap 實例載入驗證元件和 WebAssembly 檔案，再向它核驗 token。

Cap 實例位址必須是**可從公開網路存取的 HTTPS 位址**。`localhost`、內部網路 IP 等位址會被拒絕儲存；網域解析到內部網路位址時雖然能儲存，但核驗時 Ecoku 不會連線，驗證會一直失敗。

### 部署 Cap

下面的範例在 `~/capjs` 中用 Docker Compose 執行 Cap 和它所依賴的 Valkey。Cap 只監聽本機 `127.0.0.1:3000`，再由反向代理提供 HTTPS。

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

### 在 Ecoku 中啟用 Cap

1. 開啟 `https://cap.example.com`，用 `.env` 中的 `ADMIN_KEY` 登入 Cap 管理面板。
2. 新增一個 key，把部落格網域和 Ecoku 網域加入允許的主機清單，記下 Site key 和 Secret key。
3. 在 Ecoku 後台「安全」頁選擇 Cap，填寫：
   - **实例地址**：`https://cap.example.com`，結尾的 `/` 會自動去掉；
   - **Site key** 和 **Secret key**。
4. 儲存後，開啟一篇文章和後台登入頁，確認驗證元件能正常完成驗證。

### 內容安全政策 {#csp}

啟用 Cap 後，Ecoku 會自動調整管理後台的 CSP：放行 Cap 實例的來源、WebAssembly、`blob:` Worker，以及 Cap 3.x 執行階段偵測腳本所需的 `'unsafe-eval'`。切換到 Turnstile 或關閉驗證後，這些放行會立即撤回。

如果你的部落格頁面自行設定了 CSP，也要為驗證元件放行：

| 驗證方式 | 部落格頁面 CSP 需要允許 |
| --- | --- |
| Turnstile | 在 `script-src` 與 `frame-src` 中加入 `https://challenges.cloudflare.com`。 |
| Cap | 在 `script-src` 與 `connect-src` 中加入 Cap 實例來源（例如 `https://cap.example.com`），加上 `worker-src blob:`、`frame-src 'self'`，並允許 WebAssembly（`'wasm-unsafe-eval'`）。 |

Cap key 如果啟用了 instrumentation（執行階段偵測），`script-src` 還需要 `'unsafe-eval'`，`'wasm-unsafe-eval'` 無法取代它。不想放行時，可以在 Cap 中關閉 instrumentation，或改用 Turnstile。

部落格使用以 nonce 為基礎的 CSP 時，請在載入 Ecoku 之前用同一個 nonce 設定 `window.CAP_SCRIPT_NONCE` 和 `window.CAP_CSS_NONCE`，Cap 元件插入的腳本和樣式會帶上它。

## 無法登入時關閉驗證 {#disable}

如果驗證服務設定錯誤或無法連線，管理員可能無法登入後台。這時請在伺服器上用命令列關閉驗證：

```bash
cd ~/Ecoku
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku captcha status
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```

關閉後用帳號密碼登入後台，在「安全」頁修正設定再重新啟用。已儲存的 Sitekey 和 Secret key 不會被清除。
