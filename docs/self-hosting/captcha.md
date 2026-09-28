# 人机验证

Ecoku 可以要求访客在发布评论前、管理员在登录前通过一次人机验证。在后台「安全」页从三种方式中选一种：

| 方式 | 说明 |
| --- | --- |
| 关闭 | 不显示验证组件，只靠[限流](../reference/configuration#rate-limit)防刷。 |
| Cloudflare Turnstile | Cloudflare 提供的托管验证服务，需要 Cloudflare 账号。 |
| Cap | 开源、可自托管的验证服务，需要自己部署一个 Cap 实例。 |

这个设置对整个实例生效，所有站点和后台登录使用同一种方式。

## 验证如何生效

- 浏览器在提交评论或登录时附带一个一次性 token，服务端向 Turnstile 或 Cap 核验后才继续处理。核验发生在检查博主口令之前，没通过验证就无法试探口令。
- 核验失败、token 缺失，或者验证服务超时、不可用，请求都会被拒绝，不会自动放行，也不会改用另一种方式。
- 服务端核验时只发送 token 和 Secret Key，不附带访客 IP。
- Secret Key 用 `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 加密后存进数据库，后台只显示“已设置”。没有配置这把密钥时无法保存验证设置。
- 切换或关闭验证方式时，另一种方式已填写的配置会保留，切回来不必重填。

## Cloudflare Turnstile

1. 在 Cloudflare 控制台的 Turnstile 页面新建一个组件（widget）。
2. 在 Hostname 列表中加入所有博客域名（如 `blog.example.com`），以及 Ecoku 的域名（如 `ecoku.example.com`，后台登录页需要）。
3. 组件模式按需选择。Ecoku 以“仅在需要交互时显示”的方式渲染组件，宽度不超过 300px。
4. 复制 Sitekey 和 Secret key，在后台「安全」页选择 Cloudflare Turnstile，填入并保存。

官方文档：[Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)

## Cap

[Cap](https://trycap.dev/)（[GitHub](https://github.com/tiagozip/cap)）是一个开源的验证服务，可以部署在自己的服务器上。Ecoku 从你的 Cap 实例加载验证组件和 WebAssembly 文件，再向它核验 token。

Cap 实例地址必须是**公网可访问的 HTTPS 地址**。`localhost`、内网 IP 等地址会被拒绝保存。

### 部署 Cap

下面的示例在 `~/capjs` 中用 Docker Compose 运行 Cap 和它依赖的 Valkey，Cap 只监听本机 `127.0.0.1:3000`，再由反向代理提供 HTTPS。

```bash
mkdir -p ~/capjs/data/cap ~/capjs/data/valkey && cd ~/capjs
sudo chown -R 999:1000 data/valkey
chmod 750 data/cap data/valkey
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

### 在 Ecoku 中启用 Cap

1. 打开 `https://cap.example.com`，用 `.env` 里的 `ADMIN_KEY` 登录 Cap 管理面板。
2. 新建一个 key，把博客域名和 Ecoku 域名加入允许的主机列表，记下 Site key 和 Secret key。
3. 在 Ecoku 后台「安全」页选择 Cap，填写：
   - **实例地址**：`https://cap.example.com`，末尾不带 `/`；
   - **Site key** 和 **Secret key**。
4. 保存后，打开一篇文章和后台登录页，确认验证组件能正常完成。

### 内容安全策略 {#csp}

启用 Cap 后，Ecoku 会自动调整管理后台的 CSP：放行 Cap 实例的来源、WebAssembly、`blob:` Worker，以及 Cap 3.x 运行时检测脚本需要的 `'unsafe-eval'`。切换到 Turnstile 或关闭验证后，这些放行会立即撤回。

如果你的博客页面自己设置了 CSP，也要为验证组件放行：

| 验证方式 | 博客页面 CSP 需要允许 |
| --- | --- |
| Turnstile | `script-src` 与 `frame-src` 中加入 `https://challenges.cloudflare.com`。 |
| Cap | `script-src` 与 `connect-src` 中加入 Cap 实例来源（如 `https://cap.example.com`），`worker-src blob:`，`frame-src 'self'`，并允许 WebAssembly（`'wasm-unsafe-eval'`）。 |

Cap key 如果启用了 instrumentation（运行时检测），`script-src` 还需要 `'unsafe-eval'`，`'wasm-unsafe-eval'` 不能代替它。不想放行时，可以在 Cap 中关闭 instrumentation，或改用 Turnstile。

博客使用基于 nonce 的 CSP 时，在加载 Ecoku 之前用同一个 nonce 设置 `window.CAP_SCRIPT_NONCE` 和 `window.CAP_CSS_NONCE`，Cap 组件插入的脚本和样式会带上它。

## 无法登录时关闭验证 {#disable}

如果验证服务配置错误或无法访问，管理员可能无法登录后台。这时在服务器上用命令行关闭验证：

```bash
cd ~/Ecoku
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku captcha status
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```

关闭后用账号密码登录后台，在「安全」页修正配置再重新启用。已保存的 Sitekey 和 Secret key 不会被清除。
