# Ecoku 首次自托管指南

Ecoku 由一个 Go 进程提供公开 API、管理员 API、通知队列、健康检查和 `/admin/` 管理端，
`/client/ecoku-loader.js`、`/client/ecoku.umd.js`，只使用 SQLite3。本指南分别给出一般二进制和 Docker Compose
部署，并在后半部分共用首次初始化、站点创建和 Twikoo 导入步骤。

## 1. 选择部署方式

- **一般二进制**：适合已有 systemd、希望直接管理进程和文件权限的 Linux 服务器。
- **Docker Compose**：适合直接拉取 Forgejo 已发布镜像，并用只读根文件系统和部署目录绑定挂载管理运行环境的服务器。

两种方式不能共用同一个正在运行的 SQLite 文件。先选定一种方式，再完成全部初始化步骤。

## 2. 准备私有配置

从仓库复制模板：

```bash
cp deploy/config.yaml.example config.yaml
cp deploy/ecoku.env.example ecoku.env
chmod 640 config.yaml
chmod 600 ecoku.env
```

`config.yaml` 不得包含密码、哈希或 key。管理员密码哈希、token key 和通知加密主密钥只放在
`ecoku.env`，不得进入 Git、构建上下文、命令参数、日志或截图。只有明确启用受信服务端
`EcokuSite` 自动化认证时，才额外声明对应的 management key 环境变量；浏览器与默认部署不需要它。

首次启动前至少配置：

- 管理员用户名、bcrypt cost 不低于 10 的密码哈希和独立 token key；
- 独立的 32 字节通知加密主密钥；
- 管理端对外 Origin，例如 `https://ecoku.via.moe`；
- SQLite、日志和管理端静态文件的实际绝对路径；
- `trusted_proxies: []`，除非已经验证反向代理的精确 socket 地址或最小 CIDR。

站点不写入部署配置。空数据库启动后，通过管理端把站点写入 SQLite 注册表；以后同样从管理端维护。

可用 `openssl rand -base64 48` 生成随机 key。容器内置的 `hash-password` 子命令从标准输入读取
明文并只输出 bcrypt 哈希，不会把密码放入进程参数：

```bash
read -rsp '设置 Ecoku 管理员密码: ' ECOKU_ADMIN_PASSWORD; echo
printf '%s\n' "$ECOKU_ADMIN_PASSWORD" | \
  sudo docker run --rm -i --entrypoint /app/ecoku-server \
  git.via.moe/dejavu/ecoku:v0.1.0-rc.3 hash-password
unset ECOKU_ADMIN_PASSWORD
```

将输出完整复制到 `ECOKU_ADMIN_PASSWORD_HASH='...'`，并设置一个非空
`ECOKU_ADMIN_USERNAME`。Ecoku 没有默认账号或默认密码，也不会把管理员写入 SQLite。每个 Origin 必须是完整的
`http/https + 主机 + 可选端口`，不能包含路径、通配符或尾部斜杠。

## 3. 一般二进制部署

构建所需版本与仓库镜像一致：Node.js 24.18.0、pnpm 11、Go 1.26.5。先在源码目录构建：

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --dir packages/admin build
pnpm --dir packages/client build

cd server
CGO_ENABLED=0 go build -trimpath -o ../ecoku-server .
cd ..
```

先把本地 `config.yaml` 中的路径改为：

```yaml
site:
  log_path: "/var/lib/ecoku/ecoku.log"
database:
  sqlite:
    path: "/var/lib/ecoku/ecoku.sqlite3"
admin:
  static_dir: "/opt/ecoku/admin"
client:
  static_dir: "/opt/ecoku/client"
```

再在 Linux 上建立独立用户和目录；以下路径可按实际环境调整：

```bash
sudo useradd --system --home /var/lib/ecoku --shell /usr/sbin/nologin ecoku
sudo install -d -o root -g ecoku -m 0750 /etc/ecoku /opt/ecoku/admin /opt/ecoku/client
sudo install -d -o ecoku -g ecoku -m 0750 /var/lib/ecoku
sudo install -o root -g ecoku -m 0750 ecoku-server /opt/ecoku/ecoku-server
sudo cp -a packages/admin/dist/. /opt/ecoku/admin/
sudo install -o root -g ecoku -m 0640 packages/client/dist/ecoku.umd.js /opt/ecoku/client/ecoku.umd.js
sudo install -o root -g ecoku -m 0640 packages/client/dist/ecoku-loader.js /opt/ecoku/client/ecoku-loader.js
sudo chown -R root:ecoku /opt/ecoku/admin
sudo chmod -R u=rwX,g=rX,o= /opt/ecoku/admin
sudo install -o root -g ecoku -m 0640 config.yaml /etc/ecoku/config.yaml
sudo install -o root -g ecoku -m 0640 ecoku.env /etc/ecoku/ecoku.env
```

创建 `/etc/systemd/system/ecoku.service`：

```ini
[Unit]
Description=Ecoku comment system
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ecoku
Group=ecoku
WorkingDirectory=/etc/ecoku
EnvironmentFile=/etc/ecoku/ecoku.env
ExecStart=/opt/ecoku/ecoku-server
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/ecoku

[Install]
WantedBy=multi-user.target
```

然后启动并检查：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ecoku
sudo systemctl status ecoku --no-pager
curl --fail http://127.0.0.1:12123/api/health
```

## 4. Docker Compose 部署

生产服务器不需要仓库目录，也不在服务器构建源码。先建立一个独立部署目录；此后的全部命令都在
该目录中执行：

```bash
sudo install -d -o "$USER" -g "$USER" -m 0750 /opt/ecoku
cd /opt/ecoku
mkdir -p app/logs data backups
```

从已检出的私有仓库安全复制 `compose.yaml`、`deploy/config.yaml.example` 和
`deploy/ecoku.env.example` 到此目录，分别命名为 `compose.yaml`、`app/config.yaml`、
`ecoku.env`。
例如在保存源码的工作站执行（替换生产 SSH 主机）：

```bash
scp compose.yaml ops@production:/opt/ecoku/compose.yaml
scp deploy/config.yaml.example ops@production:/opt/ecoku/app/config.yaml
scp deploy/ecoku.env.example ops@production:/opt/ecoku/ecoku.env
```
生产目录最终只有运行所需文件：

```text
/opt/ecoku/
├── compose.yaml
├── ecoku.env
├── app/
│   ├── config.yaml
│   └── logs/
├── data/
└── backups/
```

`compose.yaml` 直接固定镜像 `git.via.moe/dejavu/ecoku:v0.1.0-rc.3`，不存在重复维护版本的
Compose `.env`。Forgejo 容器包为公开包时不需要
`sudo docker login`；若以后改为私有包，再使用只授予该包读取权限的细粒度令牌交互登录。

先编辑 `app/config.yaml`：

- `notifications.instance_public_url: "https://ecoku.via.moe"`；
- `admin.allowed_origins` 只包含 `https://ecoku.via.moe`；
- 保留 `client.static_dir: "/app/client"`、SQLite `/data/ecoku.sqlite3` 和日志
  `/var/log/ecoku/ecoku.log`；
- 站点、评论规则、SMTP 与 Telegram 配置均在管理员界面维护，不重复写入部署配置。

再编辑 `ecoku.env`。为每个 key 单独生成随机值，并按上一节交互生成管理员哈希；不要复用 key，
不要留下空值。运行镜像默认使用 release 模式，无需在 `ecoku.env` 重复设置。现有部署修改
`ecoku.env` 后必须执行
`sudo docker compose up -d ecoku` 重新创建容器；`sudo docker compose restart` 不会重新读取
`env_file`。
完成后设置绑定挂载权限：

```bash
test -f ./compose.yaml
test -f ./app/config.yaml
test -f ./ecoku.env
test -d ./app/logs
test -d ./data

sudo chown "$USER":10001 app/config.yaml
sudo chmod 0640 app/config.yaml
sudo chown "$USER":"$USER" ecoku.env
sudo chmod 0600 ecoku.env
sudo chown -R 10001:10001 app/logs
sudo chmod 0750 app/logs
sudo chown -R 10001:10001 data
sudo chmod 0750 data
sudo chown "$USER":"$USER" backups
sudo chmod 0700 backups

sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
curl --fail http://127.0.0.1:12123/api/health
curl --fail --head http://127.0.0.1:12123/client/ecoku-loader.js
curl --fail --head http://127.0.0.1:12123/client/ecoku.umd.js
```

Compose 没有顶层命名卷：宿主 `./app/config.yaml` 只读映射到 `/app/config.yaml`，
`./app/logs/` 映射到 `/var/log/ecoku/`，`./data/` 映射到 `/data/`。短语法会在宿主路径缺失时
自动创建目录，因此首次启动和每次迁移都必须先执行上面的 `test` 检查，不能跳过。不要删除、移动或
让其他实例同时写 `./data/`。

以后验收新版本时先阅读发行说明，再把 `compose.yaml` 的 `image:` 改成新的精确 tag，按
[兼容版本常规升级](./backup-and-upgrade.md#兼容版本常规升级)执行。不要使用浮动 `latest`。

空 `./data/` 会初始化为当前 schema。非空但无版本、版本或校验和不匹配的数据库会拒绝启动；当前
版本不自动迁移历史 schema。SQLite 启动时使用 WAL、5 秒忙等待、`synchronous=NORMAL` 与外键
约束；运行期间可能出现 `ecoku.sqlite3-wal` 和 `ecoku.sqlite3-shm`，这是正常边车文件，不得单独
删除或在服务运行时只复制主数据库。正常 `sudo docker compose stop ecoku` 会让 RC3 等待请求与
通知任务退出、checkpoint WAL 并关闭数据库；不要用强制 kill 代替停服备份流程。默认 Compose 只
绑定 `127.0.0.1:12123`，应由同机 Caddy、Nginx 或其他反向代理提供 TLS。

## 5. 首次启动后的初始化

1. 确认 `/api/health` 返回成功，并确认反向代理的 `https://ecoku.via.moe/admin/` 可访问。
2. 使用环境文件中对应的管理员用户名和明文密码登录；服务器保存的是 bcrypt 哈希，不提供默认密码。
3. 打开「站点管理」并新建站点：
   - **站点 ID**：浏览器 SDK 使用的稳定标识，创建后不要随意改动；
   - **站点 URL**：内容站点的规范 `https` 根地址；
   - **站点名称**：用于管理端和通知，留空时回落到 URL 域名；
   - **允许来源**：每行一个浏览器实际 Origin；开发端口和生产域名必须分别填写；
   - **评论配置**：默认排序、邮箱/网站必填性、占位文案、Unicode 字符上限和空状态文案。
4. 保存后刷新站点列表，确认站点 ID 和 URL 正确。评论提交后立即发布，不存在审核方式。
5. 在浏览器开发者工具中验证预检请求和评论列表只访问 Ecoku，不携带 management key，也不访问
   第三方 IP、头像或遥测服务。
6. 若没有历史数据，直接进入[一般静态网站接入](../integrations/static-site.md)。若要迁移 Twikoo，
   必须在该站点还没有任何 Ecoku 评论时完成下一节。

## 6. 添加站点后首次导入 Twikoo

导入保留时间、昵称、私有邮箱、访客网站、页面 key、回复层级和转换后的纯文本正文；不导入 IP、
UA、地区、头像、赞踩或外部用户 ID，也不会为历史评论发送通知。目标站点一旦已有评论，命令会拒绝
运行。整批导入使用单个事务，失败不会留下部分数据。

导出文件含私有邮箱，必须存放在受限临时目录，不能放入 Git、构建上下文、日志、截图或工单。

### 一般二进制部署

```bash
sudo systemctl stop ecoku
sudo install -o ecoku -g ecoku -m 0600 /private/path/twikoo-comment.json /var/lib/ecoku/twikoo-comment.json
sudo cp -a /var/lib/ecoku/ecoku.sqlite3 /var/lib/ecoku/ecoku.sqlite3.before-twikoo

sudo -u ecoku sh -c 'set -a; . /etc/ecoku/ecoku.env; set +a; cd /etc/ecoku && /opt/ecoku/ecoku-server import-twikoo --site blog --file /var/lib/ecoku/twikoo-comment.json --dry-run'
sudo -u ecoku sh -c 'set -a; . /etc/ecoku/ecoku.env; set +a; cd /etc/ecoku && /opt/ecoku/ecoku-server import-twikoo --site blog --file /var/lib/ecoku/twikoo-comment.json'

sudo rm -f /var/lib/ecoku/twikoo-comment.json
sudo systemctl start ecoku
```

`blog` 必须替换为刚创建的站点 ID。删除临时文件前，先保存原始导出的离线备份。

### Docker Compose 部署

```bash
sudo docker compose stop ecoku
sudo cp --reflink=auto --preserve=mode,timestamps \
  ./data/ecoku.sqlite3 ./backups/ecoku-before-twikoo.sqlite3
sudo chown "$USER":"$USER" ./backups/ecoku-before-twikoo.sqlite3
chmod 600 ./backups/ecoku-before-twikoo.sqlite3
sha256sum ./backups/ecoku-before-twikoo.sqlite3 \
  > ./backups/ecoku-before-twikoo.sqlite3.sha256
chmod 600 ./backups/ecoku-before-twikoo.sqlite3*

mkdir -p ./import
chmod 700 ./import
sudo install -o 10001 -g 10001 -m 0600 \
  /private/path/twikoo-comment.json ./import/twikoo-comment.json

sudo docker compose run --rm --no-deps \
  --volume "$(pwd)/import/twikoo-comment.json:/tmp/twikoo-comment.json:ro" \
  ecoku import-twikoo --site blog --file /tmp/twikoo-comment.json --dry-run

sudo docker compose run --rm --no-deps \
  --volume "$(pwd)/import/twikoo-comment.json:/tmp/twikoo-comment.json:ro" \
  ecoku import-twikoo --site blog --file /tmp/twikoo-comment.json
sudo rm -f ./import/twikoo-comment.json
rmdir ./import
sudo docker compose up -d ecoku
```

预检摘要中的评论数、页面数、回复数、邮箱数、网站数和缺失父记录数必须与预期一致。正式导入后：

```bash
curl --fail http://127.0.0.1:12123/api/health
sudo docker compose logs --tail=100 ecoku
```

再登录管理端核对总数、时间范围、页面分布和深层回复。源数据中的无效邮箱或网址会影响回复通知；
是否保留、清空或修正应在导入前明确决定，不能在没有备份的情况下直接批量修改。

完成后在公开站点抽查根评论和多层回复，并确认导入没有触发 SMTP 或 Telegram 历史通知。
`import/` 和服务器上的 Twikoo 原始导出必须删除。导入前 SQLite 备份只是回滚点；完成
总数、时间范围、页面分布、深层回复、公开站点和重启持久性验收后，如果明确接受失去
本次导入前的回滚能力，可删除该备份及其 `.sha256`。保留权限为 `0700` 的空
`backups/` 目录，供以后升级创建新回滚点。

## 7. TLS、代理与安全边界

Caddy 与 Nginx 的完整 IPv4/IPv6、TLS、请求体和代理头示例见
[Caddy / Nginx 反向代理](./reverse-proxy.md)。

- 浏览器 Origin 必须精确匹配所属站点允许来源；未知站点和跨站点请求被拒绝。
- 管理端 Origin 使用独立白名单，不能复用公开评论站点列表。
- 默认 `trusted_proxies: []`，任意转发头均不能改变限流身份。只有核验 Go 进程看到的 socket
  对端后，才能填写反向代理的精确 IP 或最小 CIDR；禁止 `*`、`0.0.0.0/0` 和 `::/0`。
- 管理员 Bearer token 只存在页面内存；刷新、关闭、退出、401 或到期都会清除。
- 浏览器永远不接收 management key。

## 8. 通知与凭据轮换

通知配置为实例级，对全部站点生效。SMTP 密码和 Telegram Bot Token 以 AES-256-GCM 加密保存到
SQLite；读取 API 只返回“已设置”标志。模板使用评论所属站点的名称、文章标题和由固定站点 URL
拼接的原文链接，不包含审核按钮、IP、UA、页面 key 或管理链接。

轮换管理员密码哈希或 token key 后重启进程，旧 Bearer token 会立即失效。切勿在没有旧主密钥和
数据库备份时轮换通知加密主密钥。真实 SMTP/Telegram 验收必须使用操作者提供的有效凭据。

## 9. 运行和升级边界

- 限流为单进程内存固定窗口，重启后清空；不支持多实例共享限流。
- 只支持 SQLite3；不创建普通用户、验证码或 Count 表及路由。
- SQLite 使用 WAL 与 5 秒忙等待，但进程内连接池仍限制为单连接；升级和备份必须按停服 SOP 处理
  主数据库及边车文件，不能把 WAL 当作分布式或多实例写入能力。
- 已发布评论可替换为墓碑并保留后代；只有无后代墓碑可由实例管理员彻底删除。
- 日志不得包含评论正文、邮箱、密码、token、management key、Authorization、连接 IP 或 UA。
- 升级前必须执行[SQLite 备份、升级、重建与恢复](./backup-and-upgrade.md)。镜像推送、npm 发布、Git tag
  和 Release 仍需要独立授权。
- 私有 Forgejo/Woodpecker 的测试、原生双架构构建、Secret 配置和精确版本发布见
  [Woodpecker CI 指南](./woodpecker-ci.md)。
