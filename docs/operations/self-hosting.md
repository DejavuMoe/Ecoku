# Ecoku Docker Compose 自托管指南

部署与接入的唯一运维入口。Ecoku 只支持 Docker Compose 与 SQLite3；示例中的域名、镜像地址、
用户名和路径须替换为自己的值。

## 目录

1. [前提与目录](#1-前提与目录)
2. [准备 Compose 与公开配置](#2-准备-compose-与公开配置)
3. [首次初始化管理员](#3-首次初始化管理员)
4. [启动与健康检查](#4-启动与健康检查)
5. [反向代理](#5-反向代理)
6. [登录、站点与通知](#6-登录站点与通知)
7. [Twikoo 首次导入](#7-添加站点后首次导入-twikoo)
8. [静态网站接入](#8-静态网站与-hugo-papermod-接入)
9. [备份、升级与恢复](#9-sqlite-wal备份升级与恢复)
10. [故障排查](#10-故障排查)
11. [验收清单](#11-验收清单)

## 1. 前提与目录

需要 Linux、Docker Engine、Docker Compose v2、OpenSSL、一个指向服务器的 HTTPS 域名，
以及可拉取的精确版本镜像：

```text
<REGISTRY_HOST>/<OWNER>/ecoku:<VERSION>
```

不要使用 `latest`。建议在普通运维用户的目录中建立：

```bash
mkdir -p ~/Ecoku/app/logs ~/Ecoku/data ~/Ecoku/backups
cd ~/Ecoku
chmod 700 ./backups
```

最终结构：

```text
Ecoku/
├── app/
│   ├── config.yaml
│   └── logs/
├── backups/
├── compose.yaml
├── data/
└── ecoku.env
```

容器固定以 UID/GID `10001:10001` 运行。`data/` 保存数据库、WAL 与共享内存边车文件；
`app/logs/` 保存可选的文件副本。升级时必须原样保留 `data/`，并保留仍在使用的日志目录。

## 2. 准备 Compose 与公开配置

复制仓库根 `compose.yaml` 和 `deploy/config.yaml.example`。不要改写端口、挂载或加固项去“对齐文档”；
文档以这两个仓库文件为准。私有仓库尚未公开时，可以从自己的受控文件服务下载；下面仅用占位直链
表达来源：

```bash
curl --fail --show-error --location \
  https://downloads.example.com/ecoku/<VERSION>/compose.yaml \
  --output compose.yaml
curl --fail --show-error --location \
  https://downloads.example.com/ecoku/<VERSION>/config.yaml.example \
  --output app/config.yaml
```

`compose.yaml` 已固定精确镜像版本，并把服务端口绑到宿主机 `127.0.0.1:12123`。公网只应打到本机
Caddy 或 Nginx；不要把 `12123` 改成 `0.0.0.0`。保持三个绑定挂载：`./app/config.yaml`、
`./app/logs`、`./data`，以及 `env_file: ./ecoku.env`。

把 `deploy/config.yaml.example` 复制为 `app/config.yaml` 后，只改公开网址和管理端来源：

```yaml
notifications:
  instance_public_url: "https://comments.example.com"

admin:
  allowed_origins:
    - "https://comments.example.com"
```

其余项与示例保持一致。限流默认只用容器看到的直接连接地址。若本机 Caddy 反代到
`127.0.0.1:12123` 且需要按真实访客限流，把 `trusted_proxies` 设为 Docker 网关 `/32`
（先 `sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}'`），
并让 Caddy **覆盖** `X-Forwarded-For`。留空则所有访客共用一个限流桶。不要填 `0.0.0.0/0` 或 `::/0`。

## 3. 首次初始化管理员

先固定镜像变量，避免重复输入：

```bash
ECOKU_IMAGE='<REGISTRY_HOST>/<OWNER>/ecoku:<VERSION>'
```

交互读取用户名与两次密码。密码不会显示，也不会出现在命令参数、shell 历史或日志中：

```bash
set +x
umask 077

read -rp 'Ecoku 管理员用户名: ' ECOKU_ADMIN_USERNAME
read -rsp '设置管理员密码（输入不会显示）: ' ECOKU_PASSWORD_FIRST
echo
read -rsp '再次输入管理员密码: ' ECOKU_PASSWORD_SECOND
echo

test -n "$ECOKU_ADMIN_USERNAME" || { echo '管理员用户名不能为空'; exit 1; }
test -n "$ECOKU_PASSWORD_FIRST" || { echo '管理员密码不能为空'; exit 1; }
test "$ECOKU_PASSWORD_FIRST" = "$ECOKU_PASSWORD_SECOND" || {
  echo '两次输入的密码不一致'
  unset ECOKU_PASSWORD_FIRST ECOKU_PASSWORD_SECOND
  exit 1
}

ECOKU_ADMIN_PASSWORD_HASH="$(
  printf '%s\n' "$ECOKU_PASSWORD_FIRST" |
    sudo docker run --rm -i --entrypoint /app/ecoku-server \
      "$ECOKU_IMAGE" hash-password
)" || exit 1

ECOKU_ADMIN_TOKEN_KEY="$(openssl rand -hex 32)"
ECOKU_NOTIFICATION_ENCRYPTION_KEY="$(openssl rand -base64 32)"

# TZ 使用 IANA 名称，按机房修改；默认与未设置时的回退值相同。
{
  printf "GIN_MODE='release'\n"
  printf "TZ='Asia/Shanghai'\n"
  printf "ECOKU_ADMIN_USERNAME='%s'\n" "$ECOKU_ADMIN_USERNAME"
  printf "ECOKU_ADMIN_PASSWORD_HASH='%s'\n" "$ECOKU_ADMIN_PASSWORD_HASH"
  printf "ECOKU_ADMIN_TOKEN_KEY='%s'\n" "$ECOKU_ADMIN_TOKEN_KEY"
  printf "ECOKU_NOTIFICATION_ENCRYPTION_KEY='%s'\n" "$ECOKU_NOTIFICATION_ENCRYPTION_KEY"
} > ecoku.env

unset ECOKU_PASSWORD_FIRST ECOKU_PASSWORD_SECOND ECOKU_ADMIN_PASSWORD_HASH
unset ECOKU_ADMIN_TOKEN_KEY ECOKU_NOTIFICATION_ENCRYPTION_KEY ECOKU_IMAGE
```

这些环境变量仅包含首次安装、容器时区与长期密钥。站点、评论表单和通知渠道配置均由管理端写入 SQLite，
不要在环境文件或 YAML 中重复维护。

`TZ` 是标准容器时区（IANA 名称），由 Compose 的 `env_file` 注入进程。它控制公共评论时间与悬停文案，
未设置时回退 `Asia/Shanghai`。不要把 `TZ` 写进 `app/config.yaml`，也不必为它改 Compose 挂载或端口。
已有实例补 `TZ` 的步骤见第 9 节。

设置权限并校验：

```bash
sudo chown "$USER":10001 ./app/config.yaml
sudo chmod 0640 ./app/config.yaml
sudo chown "$USER":"$USER" ./ecoku.env
sudo chmod 0600 ./ecoku.env
sudo chown -R 10001:10001 ./app/logs ./data
sudo chmod 0750 ./app/logs ./data
sudo docker compose config --quiet
```

## 4. 启动与健康检查

```bash
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku

curl --fail http://127.0.0.1:12123/api/health
curl --fail --head http://127.0.0.1:12123/client/ecoku-loader.js
curl --fail --head http://127.0.0.1:12123/client/ecoku.umd.js
```

健康状态必须为 `healthy`。首次启动会创建数据库并按顺序执行全部显式迁移；未知未来版本、
迁移校验和不符或任一迁移失败都会阻止启动。

应用日志始终出现在 `sudo docker compose logs -f ecoku`。若 `log_path` 指向挂载文件，进程还会
把同一行写入该文件并由 lumberjack 按约 10MB / 5 份 / 28 天轮转。Compose 的 `json-file`
`max-size` / `max-file` 负责轮转 Docker 保存的 stdout 副本。不要用 `GIN_MODE=debug` 替代
访问日志；日志仍不得包含 IP、UA、凭据或评论正文。

## 5. 反向代理

把 HTTPS 终止在本机反代，上游指向 `127.0.0.1:12123`。`/api/health` 只表示进程可响应，
不证明数据库或迁移已完成。

### 限流拓扑

Ecoku 默认不信任 `X-Forwarded-For`，限流使用 socket 对端地址。只有**直接 TCP 对端**匹配
`trusted_proxies` 中的 IP/CIDR 时，才从转发头解析访客地址。禁止配置 `0.0.0.0/0` 或 `::/0`。

| 拓扑 | 链路 | `trusted_proxies` | 反代对 `X-Forwarded-For` |
| --- | --- | --- | --- |
| 1（推荐） | 访客 → Caddy → `127.0.0.1:12123` | Docker 网关 `/32` | **覆盖**为 `{remote_host}` / `$remote_addr` |
| 2 | 访客 → CDN → Caddy → Compose | 仍为 Docker 网关 `/32` | Caddy **覆盖**为 CDN Connecting-IP |
| 3 | 直连或不做按人限流 | `[]`（默认） | 不必改头；所有访客共用一个限流桶 |

查 Docker 网关：

```bash
sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}'
```

### Caddy

```caddyfile
comments.example.com {
	encode zstd gzip
	reverse_proxy 127.0.0.1:12123 {
		header_up X-Forwarded-For {remote_host}
		header_up X-Forwarded-Proto {scheme}
	}
}
```

`header_up X-Forwarded-For {remote_host}` 用 Caddy 看到的 TCP 对端**覆盖**该头，不要删。
Caddy 可能提示 `Unnecessary header_up`；默认是把已有头传给上游（访客可以伪造
`X-Forwarded-For`），与覆盖不是一回事，警告可忽略。

保存后先格式化再校验、重载：

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name comments.example.com;

    location / {
        proxy_pass http://127.0.0.1:12123;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_http_version 1.1;
    }
}
```

TLS 证书配置按自己的 Nginx 管理方式补齐。使用 `$remote_addr` 覆盖而不是附加浏览器提交的
`X-Forwarded-For`。验证公网入口：

```bash
curl --fail https://comments.example.com/api/health
curl --fail --head https://comments.example.com/client/ecoku-loader.js
```

### Cloudflare CDN（拓扑 2）

Ecoku 只信任 Docker 网关，不直接信任 Cloudflare IP 段。由本机 Caddy 读取 CDN 提供的真实访客 IP，
再覆盖 `X-Forwarded-For` 传给容器。

```caddyfile
comments.example.com {
	encode zstd gzip
	reverse_proxy 127.0.0.1:12123 {
		header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
		header_up X-Forwarded-Proto {scheme}
	}
}
```

要点：

- `app/config.yaml` 的 `trusted_proxies` 仍只填 Docker 网关 `/32`，不要填 Cloudflare CIDR。
- 限制 Caddy 只接受来自 Cloudflare 的入站连接（防火墙或 `remote_ip` 匹配 Cloudflare 发布段）。
- Turnstile 与 CDN 代理是两套机制：`cf_clearance` 只跳过后续 Cloudflare 安全规则，不会让 Ecoku
  跳过 Siteverify。管理端或评论站不在 Cloudflare 代理之后时，应关闭 Pre-clearance，否则浏览器会
  向站点自身请求 `/cdn-cgi/challenge-platform/` 并得到 404。

## 6. 登录、站点与通知

访问 `https://comments.example.com/admin/`，使用初始化的管理员账户登录。在「站点管理」中创建：

- 站点 ID：稳定、简短，创建后不可修改；
- 站点 URL：例如 `https://blog.example.com`；
- 站点名称：例如 `Example Blog`，留空时回落到 URL 域名；
- 允许来源：每行一个完整 Origin，例如 `https://blog.example.com`；
- 默认排序、邮箱/网站要求、评论框文案、字符上限和无评论文案；
- 博主昵称、博主邮箱与博主口令：昵称与邮箱必须同时设置或同时留空；启用时必须设置口令。口令不会回显。公开评论区昵称栏填写口令即可发表为博主，评论显示配置昵称、可选标志和站点 URL 链接，无头像。升级后保存口令会按昵称+邮箱回填历史博主评论。

默认通知判定由服务端执行，不在管理端展示说明表：

| 提交者 | 回复对象 | 投递结果 |
| --- | --- | --- |
| 访客 | 根评论 | 博主 SMTP/Telegram 渠道 |
| 访客 | 访客 | 博主渠道，并向被回复访客邮箱发送回复通知 |
| 访客 | 博主 | 博主渠道一次，不重复向同一邮箱投递 |
| 博主 | 根评论 | 不发送 |
| 博主 | 访客 | 仅向被回复访客邮箱发送回复通知 |
| 博主 | 博主 | 不发送 |

昵称与邮箱必须共同匹配才用于历史回填；公开徽章和通知去重读取存储的 `is_blogger`。邮箱比较不区分大小写，昵称去除首尾空白后精确比较。
SMTP 只允许 TLS 或 STARTTLS。SMTP、Telegram 与接收目标仍在实例级「通知设置」中配置。密码和 Bot Token 不会明文回显。

## 7. Twikoo 首次导入

仅在目标站点已经创建、但评论数仍为零时执行一次。导入保留时间、昵称、私有邮箱、网站、
页面 key、回复层级和转换后的纯文本正文；不导入 IP、UA、地区、头像、赞踩或外部用户 ID，
也不发送历史通知。

先停服并做冷备份：

```bash
sudo docker compose down
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm

twikoo_stamp="$(date +%Y%m%d-%H%M%S)"
sudo cp --reflink=auto --preserve=mode,timestamps \
  ./data/ecoku.sqlite3 "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3"
sudo chown "$USER":"$USER" "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3"
chmod 600 "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3"
sha256sum "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3" \
  > "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3.sha256"
```

把 Twikoo 导出放在仓库和服务目录之外，使用绝对路径只读挂载。先预检：

```bash
sudo docker compose run --rm --no-deps \
  --volume <ABSOLUTE_PATH>/twikoo-comment.json:/import/twikoo-comment.json:ro \
  ecoku import-twikoo \
  --site <SITE_ID> \
  --file /import/twikoo-comment.json \
  --dry-run
```

确认评论、根评论、回复、页面、邮箱、网站和缺失父记录摘要符合源数据，再执行正式导入：

```bash
sudo docker compose run --rm --no-deps \
  --volume <ABSOLUTE_PATH>/twikoo-comment.json:/import/twikoo-comment.json:ro \
  ecoku import-twikoo \
  --site <SITE_ID> \
  --file /import/twikoo-comment.json

sudo docker compose up -d
sudo docker compose ps
```

整批导入使用一个事务；失败不会留下部分数据，目标站点已有评论时会拒绝。验收后从服务器删除
含私有邮箱的原始导出；冷备份是否保留由管理员决定，Ecoku 不会自动删除它。

## 8. 静态网站接入

### 通用静态网站

每个页面提供专用容器和稳定的页面 key：

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://comments.example.com"
  data-site-id="blog"
  data-page-key="/posts/example/"
  data-page-title="示例文章"
  data-page-size="10"
  data-theme="auto"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新加载评论</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://comments.example.com/client/ecoku-loader.js" defer></script>
```

加载器以 `data-ecoku-*` 为准：外壳、挂载点、加载态、状态文案和重试按钮缺一则不会初始化。
规范 id 为 `ecoku-comments` 与 `ecoku-mount`。当前加载器仍兼容旧的 `#tcomment` 与
`.comment-loader` / `.comment-status` / `.comment-retry`，新站点不要再使用这些名称。
加载过程不显示「正在加载评论…」；失败时才展示状态文案和「重新加载评论」。未配置站点应渲染
「评论服务尚未配置。」

`pageKey` 必须由站点生成器明确提供，只能是站内相对路径（例如 `.RelPermalink`），不能是绝对 URL，
不能包含查询参数，也不能随标题或域名变化；`pageTitle`
用于通知中的文章标题。浏览器只接收公开配置，不得放入管理员 token 或 management key。

默认 SDK 会把评论区样式注入宿主页面。可选 `data-css-url`（Hugo 配置 `css_url`）后不再注入，
加载器改为插入该样式表。容器提供 `/client/ecoku.css`（与默认注入相同）和
`/client/ecoku.unstyled.css`（只保留结构）。`css_url: none` 表示完全自写 CSS。可选 `js_url`
替换默认 `{server_url}/client/ecoku-loader.js`。自定义样式只作用于评论区前端。
完整片段见 [`examples/html`](../../examples/html) 与
[`examples/hugo-papermod`](../../examples/hugo-papermod)。

可选的宿主
[`examples/hugo-papermod/assets/css/extended/ecoku.css`](../../examples/hugo-papermod/assets/css/extended/ecoku.css)
只美化失败/未配置外壳。若站点使用严格 `style-src 'self'`，必须为 SDK
注入样式或你改用的外部 CSS 制定经过审核的 CSP 方案；不要仅为消除报错而全局放宽脚本策略。若当前验证方式为 Cloudflare
Turnstile，宿主 CSP 还必须允许 `https://challenges.cloudflare.com` 的 `script-src`、`frame-src`
和 `connect-src`。若当前方式为自托管 Cap，宿主 CSP 必须把该实例 HTTPS Origin 加入 `script-src` 与
`connect-src`，允许 `worker-src blob:`、instrumentation 所需的 `frame-src 'self'`，以及 WebAssembly 所需的精确 `script-src 'wasm-unsafe-eval'`。当前 Cap 3.x 生成的 sandboxed instrumentation 脚本还会调用 JavaScript `eval` / `new Function`，因此启用该能力的严格宿主 CSP 必须同时加入 `script-src 'unsafe-eval'`；`'wasm-unsafe-eval'` 和 nonce 都不能代替这一权限。事实依据见 [Cap 3.1.8 instrumentation 生成器](https://github.com/tiagozip/cap/blob/1d4f246d29b691275ce0edbbc8290198ebf8bde8/core/src/instrumentation.js#L338-L342)和 [CSP `script-src` 定义](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src)。使用 nonce CSP 时，加载 Widget 前仍把同一 nonce 写入 `window.CAP_CSS_NONCE` 与 `window.CAP_SCRIPT_NONCE`。不接受 JavaScript 动态求值风险的宿主应关闭该 Cap Key 的 instrumentation 或选择 Turnstile；不要添加 `*`、宽泛的 `unsafe-inline` 或自动降级。每次升级 SDK 后重新检查 CSP、控制台和网络请求，确认没有第三方 IP、头像、遥测或管理凭据。

### Hugo PaperMod

在 Hugo 配置中启用评论：

```yaml
params:
  comments: true
  ecoku:
    server_url: "https://comments.example.com"
    site_id: "blog"
    # js_url: "https://cdn.example.com/ecoku-loader.js"
    # css_url: "https://comments.example.com/client/ecoku.unstyled.css"
```

把仓库 [`examples/hugo-papermod/layouts/_partials/comments.html`](../../examples/hugo-papermod/layouts/_partials/comments.html)
合并到主题实际使用的 comments partial。生产模板应继续使用 `.RelPermalink` 作为页面 key、`.Title`
作为标题，并保留 Hugo 的上下文转义。加载前外壳样式可选复制
[`assets/css/extended/ecoku.css`](../../examples/hugo-papermod/assets/css/extended/ecoku.css)。

上线前至少检查：首页以外的普通文章、无评论页、深层回复、根线程分页、移动端、回复通知、CORS
拒绝未登记 Origin，以及刷新后 7 天加密身份恢复。访客身份只存于当前 Origin 的 IndexedDB；
清除浏览器站点数据会自然删除，不提供额外清除按钮。

## 9. 备份、升级与恢复

Ecoku 启动时启用 WAL、外键、忙等待和单连接。运行中可能同时存在：

```text
data/ecoku.sqlite3
data/ecoku.sqlite3-wal
data/ecoku.sqlite3-shm
```

不要在服务运行时只复制主文件。最简单可靠的备份是正常停服后确认边车文件已经 checkpoint：

```bash
set -euo pipefail
sudo docker compose down
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm

umask 077
mkdir -p ./backups
backup_stamp="$(date +%Y%m%d-%H%M%S)"
sudo cp --reflink=auto --preserve=mode,timestamps \
  ./data/ecoku.sqlite3 "./backups/ecoku-${backup_stamp}.sqlite3"
sudo chown "$USER":"$USER" "./backups/ecoku-${backup_stamp}.sqlite3"
chmod 600 "./backups/ecoku-${backup_stamp}.sqlite3"
sha256sum "./backups/ecoku-${backup_stamp}.sqlite3" \
  > "./backups/ecoku-${backup_stamp}.sqlite3.sha256"
sudo cp --preserve=mode,timestamps ./compose.yaml "./backups/compose-${backup_stamp}.yaml"
sudo cp --preserve=mode,timestamps ./app/config.yaml "./backups/config-${backup_stamp}.yaml"
sudo cp --preserve=mode,timestamps ./ecoku.env "./backups/ecoku-${backup_stamp}.env"
```

### 定时冷备份

生产建议用 **停服冷备份**：脚本先 `docker compose down`，确认 WAL/SHM 不存在，再复制主库与配置，
最后 `up -d`。运行中只复制 `ecoku.sqlite3` 可能得到不一致快照。

把下面脚本保存为 `~/Ecoku/scripts/backup-ecoku.sh`（路径自定），并 `chmod 700`：

```bash
#!/usr/bin/env bash
set -euo pipefail
cd ~/Ecoku
umask 077
mkdir -p ./backups
backup_stamp="$(date +%Y%m%d-%H%M%S)"
sudo docker compose down
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm
sudo cp --reflink=auto --preserve=mode,timestamps \
  ./data/ecoku.sqlite3 "./backups/ecoku-${backup_stamp}.sqlite3"
sudo chown "$USER":"$USER" "./backups/ecoku-${backup_stamp}.sqlite3"
chmod 600 "./backups/ecoku-${backup_stamp}.sqlite3"
sha256sum "./backups/ecoku-${backup_stamp}.sqlite3" \
  > "./backups/ecoku-${backup_stamp}.sqlite3.sha256"
sudo cp --preserve=mode,timestamps ./compose.yaml "./backups/compose-${backup_stamp}.yaml"
sudo cp --preserve=mode,timestamps ./app/config.yaml "./backups/config-${backup_stamp}.yaml"
sudo cp --preserve=mode,timestamps ./ecoku.env "./backups/ecoku-${backup_stamp}.env"
# 保留最近 30 份数据库备份（按修改时间）
ls -1t ./backups/ecoku-*.sqlite3 2>/dev/null | tail -n +31 | xargs -r rm -f
ls -1t ./backups/ecoku-*.sqlite3.sha256 2>/dev/null | tail -n +31 | xargs -r rm -f
sudo docker compose up -d
```

**systemd 定时器**（每天 03:15，按需改路径与用户）：

```ini
# /etc/systemd/system/ecoku-backup.service
[Unit]
Description=Ecoku cold backup
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=ecoku
WorkingDirectory=/home/ecoku/Ecoku
ExecStart=/home/ecoku/Ecoku/scripts/backup-ecoku.sh
```

```ini
# /etc/systemd/system/ecoku-backup.timer
[Unit]
Description=Daily Ecoku cold backup

[Timer]
OnCalendar=*-*-* 03:15:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ecoku-backup.timer
systemctl list-timers ecoku-backup.timer
```

**cron** 等价写法：`15 3 * * * /home/ecoku/Ecoku/scripts/backup-ecoku.sh`。备份期间服务会短暂不可用；
若不能接受停服，须在维护窗口手动执行第 9 节的一次性备份命令。

升级顺序：

1. 阅读 `CHANGELOG.md`，确认目标 tag、schema、环境变量与目录变化；
2. 正常停服并完成上面的数据库与配置备份；
3. 把 `compose.yaml` 的精确镜像 tag 改为新版本，并补上当前仓库中的 `logging` 段（若旧文件没有）；
4. 若该版本要求新的环境变量（例如 `TZ`），写入 `ecoku.env` 后再启动；不要写进 `config.yaml`；
5. 拉取、启动，用 `sudo docker compose logs -f ecoku` 观察启动与迁移日志，确认健康状态；
6. 验证管理登录、站点配置、公开评论时间与悬停时区、提交、回复与通知。
   若启用了 Turnstile 或 Cap，再确认评论发表和管理员登录都能完成当前提供方验证。

```bash
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=200 ecoku
curl --fail http://127.0.0.1:12123/api/health
```

显式 schema 迁移在原 `data/ecoku.sqlite3` 文件内按版本事务执行。成功后只增加
`schema_migrations` 记录；不会自动删除旧数据库、业务数据、WAL 边车文件或 `backups/` 中的备份。
失败的版本不会被记为完成，服务会拒绝启动。不存在单独的“v1 数据库”可供自动清理，也不得手工
删除迁移历史或伪造版本。含博主口令与按目标拆分 outbox 的版本会把 schema 从 v4 升到 v5；统一 CAPTCHA 提供方会把 v5 原位升到 v6、保留既有 Turnstile 配置并新增 Cap 字段。升级前必须冷备份，
已写入 v6 的库不能只换回旧镜像，必须用停服前的整库备份恢复。

### 机器人验证

「安全」页提供关闭、Cloudflare Turnstile 和自托管 Cap 三态选择；启用时后两者只能选择一个，并同时保护访客评论和管理员登录。切换或关闭不会清除另一提供方已经保存的配置。两者故障时都失败关闭，不会自动降级。

#### Cloudflare Turnstile

选择 Turnstile 时，它作为实例级提供方同时用于访客评论和管理员登录，不按站点分开。在 Cloudflare 控制台创建小组件后：

1. 把管理端来源和所有评论站点来源都加入该小组件的主机名列表；
2. 在管理端「安全」选择 Cloudflare Turnstile，填入 Sitekey 与 Secret key 并保存；
3. 小组件模式（托管 / 非交互式 / 不可见）只在 Cloudflare 配置，同一组密钥都兼容。

「为已验证的访问者跳过将来的安全规则质询」（Pre-clearance）也只在 Cloudflare 控制台配置。`cf_clearance` 只跳过后续 Cloudflare 安全规则质询，不会让 Ecoku 跳过 Siteverify。评论区和登录页仍会调用小组件；需要交互时才出现勾选框。若管理端或评论站点不在 Cloudflare 区域代理之后，应关闭 Pre-clearance：浏览器会向站点自身请求 `/cdn-cgi/challenge-platform/` 并得到 404，控制台出现 `aborting clearance redemption`；小组件仍可完成 Siteverify。

Secret key 使用与通知相同的 `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 加密。未配置该密钥时不能保存已启用的 Turnstile。

#### 自托管 Cap

先在 Cap Standalone 管理台为 Ecoku 创建一组 Site key / Secret key。Cap 的 `ADMIN_KEY` 只用于 Cap 自身后台，不能填入 Ecoku。然后：

1. 保持 Cap 的 instrumentation challenges 开启，并把 Ecoku 管理端 Origin 与每个实际评论站点 Origin 加入该 Key 的 CORS 允许列表；
2. 确认 Cap 实例使用公开 HTTPS，且 Standalone 已启用固定版本的 `/assets/widget.js` 与 `/assets/cap_wasm_bg.wasm`；
3. 在 Ecoku 管理端「安全」选择 Cap，填写实例根地址、Site key 和 Secret key；实例地址只接受公开 HTTPS，不接受凭据、query、fragment、localhost 或私网 IP；
4. 保存后在当前管理会话仍打开时，用另一个普通浏览器窗口验证管理员登录和评论发表；Cap token 单次使用，重试会重新求解。

Ecoku `v0.1.6` 起，管理端只在 Cap 是当前启用方式时为已保存的精确实例 Origin 加入 Widget、连接、WASM、Blob Worker、nonce 与 instrumentation 所需的 `'unsafe-eval'`；切换到关闭或 Turnstile 会在下一次页面响应中移除 Cap Origin 和这些放宽项，但不会清除 Cap 配置。若 instrumentation 返回 `instr_timeout` 且 `/redeem` 为 429，先核对响应 CSP 是否来自当前镜像，不能通过改 CORS、关闭失败关闭或给 Caddy 添加第二份宽泛 CSP 处理。

使用当前镜像同源 `/client/ecoku-loader.js` 的站点会随镜像获得 Cap 支持。若站点自行固定旧 npm/UMD SDK，必须先更新到包含 `formConfig.captcha` / `captchaToken` 的版本再选择 Cap；旧 Turnstile-only 客户端无法求解 Cap，服务端会失败关闭并拒绝提交。

Ecoku 浏览器端只从该实例加载 Widget/WASM，并把同一实例下的兼容回退 URL 交给 Widget，避免浏览器回退到公共 CDN；缺少现代 `DecompressionStream` 的旧浏览器会失败关闭。服务端向 `<实例>/<Site key>/siteverify` 发送 JSON，不附加客户端 IP，不记录完整 token、Secret 或第三方响应正文。Cap Secret 与 Turnstile Secret 分别使用 `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 加密。

#### 验证服务故障时恢复管理员登录

若当前 Turnstile 或 Cap 故障、Cap 数据被删除，导致管理员无法登录，必须在 Ecoku 主机执行显式停服恢复；不要配置自动降级或长期环境变量绕过。下面命令会先保留冷备份，再把验证方式设为关闭；两套 Sitekey、实例地址和加密 Secret 均保留：

```bash
set -euo pipefail
cd ~/Ecoku

sudo docker compose down
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm

umask 077
mkdir -p ./backups
backup_stamp="$(date +%Y%m%d-%H%M%S)"
sudo cp --reflink=auto --preserve=mode,timestamps \
  ./data/ecoku.sqlite3 "./backups/ecoku-before-captcha-disable-${backup_stamp}.sqlite3"
sudo chown "$USER":"$USER" "./backups/ecoku-before-captcha-disable-${backup_stamp}.sqlite3"
chmod 600 "./backups/ecoku-before-captcha-disable-${backup_stamp}.sqlite3"

sudo docker compose run --rm --no-deps ecoku captcha status
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
sudo docker compose ps
curl --fail http://127.0.0.1:12123/api/health
```

随后无 CAPTCHA 登录管理端，修复或切换提供方，再保存。命令必须使用当前精确镜像和同一个 `./data` 挂载；不得直接用 `sqlite3` 手改设置表或伪造 revision。

需要回滚时先停止失败版本，保留现场副本，把 Compose 恢复到旧镜像 tag，再用停服前备份替换
`data/ecoku.sqlite3`，恢复 `10001:10001` 权限后启动。若新版本已经写入旧程序不认识的 schema，
绝不能只回退镜像而继续使用已升级数据库。

```bash
set -euo pipefail
sudo docker compose down
# 保留失败现场，勿覆盖停服前备份
sudo cp --preserve=mode,timestamps ./data/ecoku.sqlite3 "./backups/ecoku-failed-$(date +%Y%m%d-%H%M%S).sqlite3"
sudo rm -f ./data/ecoku.sqlite3 ./data/ecoku.sqlite3-wal ./data/ecoku.sqlite3-shm
sudo cp --preserve=mode,timestamps "./backups/ecoku-${backup_stamp}.sqlite3" ./data/ecoku.sqlite3
sudo chown 10001:10001 ./data/ecoku.sqlite3
sudo chmod 600 ./data/ecoku.sqlite3
# 把 compose.yaml 的 image 改回旧精确 tag 后：
sudo docker compose up -d
sudo docker compose ps
curl --fail http://127.0.0.1:12123/api/health
```

停服后若要查看当前库布局（只读）：

```bash
python3 - <<'PY'
import sqlite3
db = sqlite3.connect("./data/ecoku.sqlite3")
print("migrations:")
for row in db.execute("SELECT version, name FROM schema_migrations ORDER BY version"):
    print(row)
print("comments columns:")
for row in db.execute("PRAGMA table_info(comments)"):
    print(row)
print("outbox columns:")
for row in db.execute("PRAGMA table_info(notification_outbox)"):
    print(row)
PY
```

### 已有实例补充 `TZ`

`TZ` 只写在 `ecoku.env`。当前 `compose.yaml` 已通过 `env_file` 注入全部环境变量，因此不必改
Compose 服务定义、端口、挂载或 `app/config.yaml`。

在含评论时区代码的镜像上（`v0.1.0-rc.8` 及之后）：

```bash
umask 077
# 按机房填写 IANA 名称。新加坡示例：
printf "\nTZ='Asia/Singapore'\n" >> ecoku.env
sudo chmod 0600 ./ecoku.env
sudo docker compose config --quiet
sudo docker compose up -d
sudo docker compose exec ecoku wget -q -O- http://127.0.0.1:12123/api/health
```

改 `ecoku.env` 后必须重建容器，正在运行的进程不会自动重读该文件。验证公开评论时间与悬停提示
（例如 `Asia/Singapore UTC+8`）。未设置 `TZ` 时评论时间回退 `Asia/Shanghai`。

若生产仍运行 `v0.1.0-rc.7`，先加入 `TZ` 再 `up -d` 只会把变量送进容器，**不会**改变评论区时间
格式；要等含上述变更的新镜像 tag。该版本也未改 schema，升级仍是停服冷备份 → 改精确镜像 tag →
`sudo docker compose pull && sudo docker compose up -d`。

## 10. 故障排查

| 现象 | 常见原因 | 处理 |
| --- | --- | --- |
| 容器 `unhealthy` 或反复重启 | 迁移失败、配置校验失败、管理员静态目录缺失 | `sudo docker compose logs --tail=200 ecoku`；对照 `CHANGELOG.md` 与第 9 节 schema 说明 |
| 启动报未知 schema / 校验和不符 | 用旧镜像打开已升级库，或手工改过 `schema_migrations` | 停服，用升级前冷备份整库恢复；不要只回退镜像 |
| 限流像「所有人共用一个桶」 | `trusted_proxies` 为空，或反代**追加**而非覆盖 `X-Forwarded-For` | 按第 5 节拓扑 1 配置网关 `/32` 与 Caddy/Nginx 头 |
| 配置了 `trusted_proxies` 仍不按人限流 | 填了 `0.0.0.0/0` 或 CDN 段而非 Docker 网关 | 只填 `docker inspect` 得到的网关 `/32` |
| CORS 拒绝评论提交 | 站点 `allowed_origins` 未登记页面 Origin | 管理端补全来源；区分管理端与公开站点来源 |
| Turnstile 登录/评论失败 | 未启用、token 缺失、Siteverify 失败 | 管理端「安全」检查 Sitekey/Secret；Secret 需 `ECOKU_NOTIFICATION_ENCRYPTION_KEY` |
| Cap 登录/评论失败 | 实例/CORS/资产不可达，Site key 或 Secret 不匹配，token 已消费 | 检查 Cap 健康、Key 的 CORS、`/assets/widget.js`、WASM 与 Siteverify；无法登录时按第 9 节执行停服 `captcha disable` |
| 控制台 `aborting clearance redemption` | 开启了 Cloudflare Pre-clearance，但站点不在 CF 代理后 | 在 Cloudflare 控制台关闭 Pre-clearance；小组件仍可完成 Siteverify |
| 备份后恢复仍异常 | 备份时存在 WAL/SHM，或只复制了主文件 | 必须停服且确认无 WAL/SHM 后再备份（见第 9 节） |
| 评论时间不对 | 容器未设置 `TZ` 或改 `ecoku.env` 后未重建容器 | 在 `ecoku.env` 写 IANA 名称后 `docker compose up -d` |
| 博主评论无标志 | 历史评论未回填 | 管理端保存博主口令；昵称+邮箱须与历史评论一致 |
| management key 能删不能看列表 | 产品设计：key 仅墓碑删除 | 列表/详情用管理员 Bearer；自动化删除用 `EcokuSite` key |

停服后只读查看库结构，见第 9 节末尾的 Python 片段。

## 11. 验收清单

- `sudo docker compose ps` 显示 `healthy`；
- 公网 `/api/health`、`/admin/`、加载器和 UMD 均为 HTTPS；
- 管理员能登录，刷新后需要重新登录；
- 站点 ID、URL、名称、允许来源、表单配置、博主身份（含口令已设置状态，不明文）和评论区标志保存后可读回；
- 公共列表不含邮箱或管理字段；博主评论只多一个公开标志、`isBlogger` 和站点 URL 链接；未登记 Origin 被 CORS 拒绝；
- 根评论、内联回复、7 天身份恢复、Unicode 上限和根线程分页符合预期；
- 评论时间按容器 `TZ` 显示，悬停为 IANA 加偏移；未设置 `TZ` 时为 `Asia/Shanghai`；
- 安全页三态切换正确；若选择 Turnstile 或 Cap，管理员登录、根评论与内联回复都必须完成同一提供方验证，Secret 不回显；
- SMTP/Telegram 测试和真实通知去重符合默认矩阵；
- SQLite、WAL、日志、环境文件和备份均未进入公开目录、Git 或镜像层；
- 已完成一次可校验的冷备份与恢复演练。
