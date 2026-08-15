# Ecoku Docker Compose 自托管指南

本文是当前唯一的部署与接入指南，覆盖首次部署、管理员初始化、Caddy/Nginx、站点注册、
Twikoo 首次导入、静态网站接入、SQLite 备份、升级与恢复。Ecoku 当前只支持 Docker Compose
和 SQLite3；示例中的域名、镜像地址、用户名和文件路径都必须替换成自己的值。

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

其余项与示例保持一致。`trusted_proxies` 保持 `[]`：限流只用容器看到的直接连接地址，本机反代
不必填 `127.0.0.1/32`。不要填 `0.0.0.0/0`。

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

## 5. Caddy 或 Nginx 反向代理

把 HTTPS 终止在本机反代，上游指向 `127.0.0.1:12123`。不必改 `app/config.yaml` 里的 `trusted_proxies`。

### Caddy

```caddyfile
comments.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:12123
}
```

Caddy 会自动申请和续期 TLS。保存后：

```bash
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

## 6. 登录、添加站点与通知规则

访问 `https://comments.example.com/admin/`，使用初始化的管理员账户登录。在「站点管理」中创建：

- 站点 ID：稳定、简短，创建后不可修改；
- 站点 URL：例如 `https://blog.example.com`；
- 站点名称：例如 `Example Blog`，留空时回落到 URL 域名；
- 允许来源：每行一个完整 Origin，例如 `https://blog.example.com`；
- 默认排序、邮箱/网站要求、评论框文案、字符上限和无评论文案；
- 博主昵称与博主邮箱：必须同时设置或同时留空，仅用于识别博主本人和通知去重。

默认通知判定由服务端执行，不在管理端展示说明表：

| 提交者 | 回复对象 | 投递结果 |
| --- | --- | --- |
| 访客 | 根评论 | 博主 SMTP/Telegram 渠道 |
| 访客 | 访客 | 博主渠道，并向被回复访客邮箱发送回复通知 |
| 访客 | 博主 | 博主渠道一次，不重复向同一邮箱投递 |
| 博主 | 根评论 | 不发送 |
| 博主 | 访客 | 仅向被回复访客邮箱发送回复通知 |
| 博主 | 博主 | 不发送 |

昵称与邮箱必须共同匹配才视为博主；邮箱比较不区分大小写，昵称去除首尾空白后精确比较。
SMTP、Telegram 与接收目标仍在实例级「通知设置」中配置。密码和 Bot Token 不会明文回显。

## 7. 添加站点后首次导入 Twikoo

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

## 8. 静态网站与 Hugo PaperMod 接入

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
  <div class="ecoku-loader" data-ecoku-loader role="status" aria-live="polite">
    <p class="ecoku-loader-status" data-ecoku-status>正在加载评论…</p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新加载评论</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://comments.example.com/client/ecoku-loader.js" defer></script>
```

加载器以 `data-ecoku-*` 为准：外壳、挂载点、加载态、状态文案和重试按钮缺一则不会初始化。
规范 id 为 `ecoku-comments` 与 `ecoku-mount`。当前加载器仍兼容旧的 `#tcomment` 与
`.comment-loader` / `.comment-status` / `.comment-retry`，新站点不要再使用这些名称。

`pageKey` 必须由站点生成器明确提供，不能包含查询参数，也不能随标题或域名变化；`pageTitle`
用于通知中的文章标题。浏览器只接收公开配置，不得放入管理员 token 或 management key。

当前 SDK 会把评论区样式注入宿主页面，评论表面不需要再加载一份组件 CSS。可选的
[`examples/hugo-papermod/assets/css/extended/ecoku.css`](../../examples/hugo-papermod/assets/css/extended/ecoku.css)
只美化 SDK 初始化前的外壳、状态文案和重试按钮。若站点使用严格 `style-src 'self'`，必须为 SDK
注入样式制定经过审核的 CSP 方案；不要仅为消除报错而全局放宽脚本策略。若实例启用了 Cloudflare
Turnstile，宿主 CSP 还必须允许 `https://challenges.cloudflare.com` 的 `script-src`、`frame-src`
和 `connect-src`。每次升级 SDK 后重新检查
CSP、控制台和网络请求，确认没有第三方 IP、头像、遥测或管理凭据。

### Hugo PaperMod

在 Hugo 配置中启用评论：

```yaml
params:
  comments: true
  ecoku:
    server_url: "https://comments.example.com"
    site_id: "blog"
```

把仓库 [`examples/hugo-papermod/layouts/_partials/comments.html`](../../examples/hugo-papermod/layouts/_partials/comments.html)
合并到主题实际使用的 comments partial。生产模板应继续使用 `.RelPermalink` 作为页面 key、`.Title`
作为标题，并保留 Hugo 的上下文转义。加载前外壳样式可选复制
[`assets/css/extended/ecoku.css`](../../examples/hugo-papermod/assets/css/extended/ecoku.css)。

上线前至少检查：首页以外的普通文章、无评论页、深层回复、根线程分页、移动端、回复通知、CORS
拒绝未登记 Origin，以及刷新后 7 天加密身份恢复。访客身份只存于当前 Origin 的 IndexedDB；
清除浏览器站点数据会自然删除，不提供额外清除按钮。

## 9. SQLite WAL、备份、升级与恢复

Ecoku 启动时启用 WAL、外键、忙等待和单连接。运行中可能同时存在：

```text
data/ecoku.sqlite3
data/ecoku.sqlite3-wal
data/ecoku.sqlite3-shm
```

不要在服务运行时只复制主文件。最简单可靠的备份是正常停服后确认边车文件已经 checkpoint：

```bash
sudo docker compose down
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm

backup_stamp="$(date +%Y%m%d-%H%M%S)"
sudo cp --reflink=auto --preserve=mode,timestamps \
  ./data/ecoku.sqlite3 "./backups/ecoku-${backup_stamp}.sqlite3"
sudo chown "$USER":"$USER" "./backups/ecoku-${backup_stamp}.sqlite3"
chmod 600 "./backups/ecoku-${backup_stamp}.sqlite3"
sha256sum "./backups/ecoku-${backup_stamp}.sqlite3" \
  > "./backups/ecoku-${backup_stamp}.sqlite3.sha256"
```

还应备份 `compose.yaml`、`app/config.yaml` 和 `ecoku.env`；环境文件与数据库都属于私密备份。

升级顺序：

1. 阅读 `CHANGELOG.md`，确认目标 tag、schema、环境变量与目录变化；
2. 正常停服并完成上面的数据库与配置备份；
3. 把 `compose.yaml` 的精确镜像 tag 改为新版本，并补上当前仓库中的 `logging` 段（若旧文件没有）；
4. 若该版本要求新的环境变量（例如 `TZ`），写入 `ecoku.env` 后再启动；不要写进 `config.yaml`；
5. 拉取、启动，用 `sudo docker compose logs -f ecoku` 观察启动与迁移日志，确认健康状态；
6. 验证管理登录、站点配置、公开评论时间与悬停时区、提交、回复与通知。
   若启用了 Turnstile，再确认评论发表和管理员登录都能完成验证。

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
删除迁移历史或伪造版本。含实例级 Turnstile 的未发版会把 schema 从 v3 升到 v4；升级前必须冷备份，
已写入 v4 的库不能只换回旧镜像。

### Cloudflare Turnstile

Turnstile 是实例级开关，同时用于访客评论和管理员登录，不按站点分开。在 Cloudflare 控制台创建小组件后：

1. 把管理端来源和所有评论站点来源都加入该小组件的主机名列表；
2. 在管理端「安全」填入 Sitekey 与 Secret key 并启用；
3. 小组件模式（托管 / 非交互式 / 不可见）只在 Cloudflare 配置，同一组密钥都兼容。

「为已验证的访问者跳过将来的安全规则质询」（Pre-clearance）也只在 Cloudflare 控制台配置。`cf_clearance` 只跳过后续 Cloudflare 安全规则质询，不会让 Ecoku 跳过 Siteverify。评论区和登录页仍会调用小组件；需要交互时才出现勾选框。若管理端或评论站点不在 Cloudflare 区域代理之后，应关闭 Pre-clearance：浏览器会向站点自身请求 `/cdn-cgi/challenge-platform/` 并得到 404，控制台出现 `aborting clearance redemption`；小组件仍可完成 Siteverify。

Secret key 使用与通知相同的 `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 加密。未配置该密钥时不能保存已启用的 Turnstile。

需要回滚时先停止失败版本，保留现场副本，把 Compose 恢复到旧镜像 tag，再用停服前备份替换
`data/ecoku.sqlite3`，恢复 `10001:10001` 权限后启动。若新版本已经写入旧程序不认识的 schema，
绝不能只回退镜像而继续使用已升级数据库。

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

## 10. 验收清单

- `sudo docker compose ps` 显示 `healthy`；
- 公网 `/api/health`、`/admin/`、加载器和 UMD 均为 HTTPS；
- 管理员能登录，刷新后需要重新登录；
- 站点 ID、URL、名称、允许来源、表单配置、博主身份和评论区标志保存后可读回；
- 公共列表不含邮箱或管理字段；博主评论只多一个公开标志与 `isBlogger`；未登记 Origin 被 CORS 拒绝；
- 根评论、内联回复、7 天身份恢复、Unicode 上限和根线程分页符合预期；
- 评论时间按容器 `TZ` 显示，悬停为 IANA 加偏移；未设置 `TZ` 时为 `Asia/Shanghai`；
- SMTP/Telegram 测试和真实通知去重符合默认矩阵；
- SQLite、WAL、日志、环境文件和备份均未进入公开目录、Git 或镜像层；
- 已完成一次可校验的冷备份与恢复演练。
