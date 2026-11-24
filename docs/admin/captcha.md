# 人机验证

人机验证在访客发布评论和你登录后台之前确认操作的是人。在后台「安全」页三选一，对所有站点和后台登录同时生效：

| 方式 | 说明 |
| --- | --- |
| 关闭 | 不显示验证组件，只靠 [限流](../reference/configuration#rate-limit) 防刷 |
| Cloudflare Turnstile | Cloudflare 的托管服务，需要 Cloudflare 账号 |
| Cap | 开源、自托管的验证服务，需要自己部署一个实例 |

验证失败、没有完成，或者验证服务超时、不可用时，请求都会被拒绝，不会自动放行。所以验证服务出问题时，你也会登不进后台；这时按 [关闭验证](#disable) 处理。

Ecoku 向验证服务核验时只发送 token 和 Secret Key，不带访客 IP。Secret Key 加密保存在数据库里，后台不会再显示它。切换方式时，另一种方式的配置会保留。

## Cloudflare Turnstile

1. 在 Cloudflare 控制台的 Turnstile 页面新建一个组件（widget）。
2. Hostname 里加上所有博客域名，以及 Ecoku 的域名（后台登录页要用）。
3. 复制 Sitekey 和 Secret key，在 Ecoku 后台「安全」页选择 Cloudflare Turnstile，填入并保存。
4. 打开一篇文章和后台登录页，确认验证能完成。

Ecoku 只在需要交互时显示组件，评论区里组件宽度不超过 300px。参考 [Cloudflare Turnstile 文档](https://developers.cloudflare.com/turnstile/)。

## Cap

[Cap](https://trycap.dev/)（[GitHub](https://github.com/tiagozip/cap)）是开源的验证服务。Ecoku 从你的 Cap 实例加载组件和 WebAssembly 文件，再向它核验 token。

Cap 的地址必须是公网能访问的 HTTPS 地址。`localhost` 和内网 IP 无法保存；域名解析到内网地址时能保存，但 Ecoku 不会去连接，验证会一直失败。

### 部署 Cap

还没有 Cap 实例的话，可以按下面的示例用 Docker Compose 部署一个。

:::: details 用 Docker Compose 部署 Cap

下面在 `~/capjs` 中用 Docker Compose 运行 Cap 和它依赖的 Valkey。Cap 只监听本机 `127.0.0.1:3000`，再由反向代理提供 HTTPS。

```bash
mkdir -p ~/capjs/data && cd ~/capjs
sudo install -d -o 1000 -g 1000 -m 750 data/cap
sudo install -d -o 999 -g 1000 -m 750 data/valkey
```

写入 `compose.yml`：

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

写入 `.env`，把 `ADMIN_KEY` 换成一段随机字符串（可用 `openssl rand -hex 32` 生成），`CORS_ORIGIN` 换成你的博客和 Ecoku 域名：

```bash
cd ~/capjs

cat <<'EOF' > .env
# Cap 管理面板的登录密钥
ADMIN_KEY=replace-with-a-long-random-string
# 会调用 Cap 的页面来源：所有博客域名和 Ecoku 域名，逗号分隔
CORS_ORIGIN=https://blog.example.com,https://ecoku.example.com
# Cap 提供的组件与 WebAssembly 文件版本
WIDGET_VERSION=0.1.56
WASM_VERSION=0.0.7
VALKEY_UID=999
VALKEY_GID=1000
EOF

chmod 600 .env
sudo docker compose up -d
```

用 Caddy 为 Cap 提供 HTTPS，例如 `cap.example.com`：

```caddyfile
cap.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

**Cap 的管理页也会被公开。**这份 Caddy 配置代理了整个 Cap，包括它的管理页。除了 Cap 自己的 `ADMIN_KEY`，建议按你部署的 Cap 版本的路由，给管理页和管理 API 再加一层访问限制。组件、WebAssembly 和挑战接口要让访客能访问，token 核验接口要让 Ecoku 服务器能访问，不要把整个域名都锁起来。

::::

### 在 Ecoku 中启用 Cap

1. 打开 `https://cap.example.com`，用 `.env` 里的 `ADMIN_KEY` 登录 Cap 管理面板。
2. 新建一个 key，把博客域名和 Ecoku 域名加入允许的主机，记下 Site key 和 Secret key。
3. 在 Ecoku 后台「安全」页选择 Cap，填写实例地址 `https://cap.example.com`、Site key 和 Secret key，保存。
4. 刷新后台，再打开一篇文章和后台登录页，确认验证能完成。

## 博客页面的 CSP {#csp}

Ecoku 管理后台的 CSP 会自动放行所选的验证服务，刷新后台后生效。

如果你的博客页面自己设置了 CSP，需要为验证组件放行：

| 方式 | 博客 CSP 需要允许 |
| --- | --- |
| Turnstile | `script-src` 和 `frame-src` 加 `https://challenges.cloudflare.com` |
| Cap | `script-src` 和 `connect-src` 加 Cap 实例来源，`worker-src blob:`，`frame-src 'self'`，以及 `'wasm-unsafe-eval'` |

Cap 的 key 如果开启了 instrumentation（运行时检测），`script-src` 还要加 `'unsafe-eval'`。不想放行的话，在 Cap 里关掉 instrumentation，或者改用 Turnstile。

博客使用基于 nonce 的 CSP 时，在加载 Ecoku 之前，用同一个 nonce 设置 `window.CAP_SCRIPT_NONCE` 和 `window.CAP_CSS_NONCE`。

## 登不进后台时关闭验证 {#disable}

验证服务配错或连不上时，你可能无法登录后台。在部署主机上用命令行关闭验证：

```bash
(
set -eu
cd ~/Ecoku
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d --wait --wait-timeout 120 ecoku
)
```

然后用账号密码登录，在「安全」页修好配置再重新启用。已保存的 Sitekey 和 Secret key 不会被清除。
