# Docker 部署

本页从一台空的 Linux 主机开始，用 Docker Compose 跑起一个 Ecoku 实例。你只需要准备三个文件：`compose.yaml`、`app/config.yaml` 和 `ecoku.env`。完成后，服务只在本机 `127.0.0.1:12123` 上可访问；公网 HTTPS 在下一步[反向代理](./reverse-proxy)中配置。

## 开始之前

你需要：

- 一台装有 Docker Engine 与 Compose v2（`docker compose` 命令）的 Linux 主机，以及 `sudo` 权限。
- 一个专门给 Ecoku 用的域名，例如 `ecoku.example.com`。管理后台通过它访问，博客通过它加载评论区脚本。它不能与博客域名相同，原因见[第 3 步](#config)。
- 在这台主机上运行的 Caddy 或 Nginx，用来终止 HTTPS。

本页中的 `ecoku.example.com`、`blog.example.com` 都是占位，请替换成自己的域名。镜像使用当前发布版本 `git.via.moe/dejavu/ecoku:v0.2.7`。

部署完成后，目录结构如下：

```text
~/Ecoku/
├── compose.yaml        # 容器定义
├── ecoku.env           # 管理员凭据、密钥、时区（权限 600）
├── app/
│   ├── config.yaml     # 实例配置（只读挂载）
│   └── logs/           # 日志文件副本
└── data/
    └── ecoku.sqlite3   # 全部数据：站点、评论、设置
```

## 1. 准备目录

容器以 UID/GID `10001:10001` 运行，根文件系统只读，只有挂载进去的 `app/logs` 和 `data` 可写。部署目录和 `app/` 用你自己的账号创建，之后编辑配置不需要 `sudo`；`app/logs` 和 `data` 交给容器用户：

```bash
mkdir -p ~/Ecoku/app && cd ~/Ecoku
sudo install -d -o 10001 -g 10001 -m 750 app/logs data
```

## 2. 创建 compose.yaml

在 `~/Ecoku` 下新建 `compose.yaml`，内容如下：

```yaml
services:
  ecoku:
    image: "git.via.moe/dejavu/ecoku:v0.2.7"
    init: true
    restart: unless-stopped
    container_name: ecoku
    env_file:
      - ./ecoku.env
    ports:
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
      - ./app/logs:/var/log/ecoku
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

容器内的端口、目录、日志和数据库路径都已固定在镜像里，和上面的挂载一一对应。要换宿主机上的位置，只改冒号前面的部分，例如把端口改成 `"127.0.0.1:8080:12123"`，或把数据放到 `/srv/ecoku-data:/data`。

有两处请保持原样：

- **端口只绑定 `127.0.0.1`**。写成 `12123:12123` 会让 Docker 在所有网卡上开放端口，外部可以绕过反向代理直接访问，限流也会失效。
- **镜像写精确版本号**。不要用 `latest`。升级时改这一行，回滚时改回旧版本号，详见[升级](./upgrade)。

其余选项用于收紧容器权限：`read_only` 与 `tmpfs` 让容器只能写 `/tmp`（16 MB）和挂载目录；`cap_drop: ALL` 与 `no-new-privileges` 去掉所有 Linux capability；`healthcheck` 每 30 秒请求一次容器内的 `/api/health`。

## 3. 创建 app/config.yaml {#config}

新建 `app/config.yaml`，只需要写 Ecoku 的公网地址：

```yaml
notifications:
  instance_public_url: "https://ecoku.example.com"
```

然后设置权限：

```bash
chmod 644 ~/Ecoku/app/config.yaml
```

`instance_public_url` 有两个用途：

- 管理后台只接受从这个地址（协议 + 域名 + 可选端口）发来的请求，也就是你打开后台时浏览器地址栏里的来源。它**不能与任何站点的允许来源重复**，后台保存站点时会拒绝与它相同的来源。这就是 Ecoku 需要一个独立域名的原因。
- 启用邮件或 Telegram 通知前必须填写，否则后台保存通知设置会失败。

配置反向代理之后，还需要在这里加上 `site.trusted_proxies`，见[反向代理](./reverse-proxy#trusted-proxies)。限流次数等其他字段都有默认值，需要时再按[配置参考](../reference/configuration)添加。写错字段名会导致启动失败。

`config.yaml` 不含密码或密钥，保持属于你自己、权限 `644` 即可：容器以只读方式挂载它，以后修改也不需要 `sudo`。

## 4. 创建 ecoku.env {#env}

新建 `ecoku.env`，按下面的格式填写，每个值都用单引号包住，避免 bcrypt 哈希里的 `$` 被 Compose 当成变量展开：

```ini
TZ='Asia/Shanghai'
ECOKU_ADMIN_USERNAME='admin'
ECOKU_ADMIN_PASSWORD_HASH='$2a$10$...'
ECOKU_ADMIN_TOKEN_KEY='...'
ECOKU_NOTIFICATION_ENCRYPTION_KEY='...'
```

然后设置权限，只允许自己读写：

```bash
chmod 600 ~/Ecoku/ecoku.env
```

| 变量 | 填什么 |
| --- | --- |
| `TZ` | 评论和通知的显示时区，IANA 名称，如 `Asia/Shanghai`、`Asia/Tokyo`。 |
| `ECOKU_ADMIN_USERNAME` | 后台登录用户名，1～80 个字符。 |
| `ECOKU_ADMIN_PASSWORD_HASH` | 后台密码的 bcrypt 哈希，不填明文密码。用下面的命令生成。 |
| `ECOKU_ADMIN_TOKEN_KEY` | 管理员会话的签名密钥，至少 32 个字符。用下面的命令生成。更换后所有已登录会话失效。 |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | 加密数据库里的 SMTP 密码、Telegram Bot Token 和人机验证 Secret Key，Base64 编码的 32 字节。用下面的命令生成。 |

生成密码哈希（输入时不回显，把输出的整串 `$2a$10$...` 填进 `ECOKU_ADMIN_PASSWORD_HASH`）：

```bash
read -rsp '管理员密码: ' P; echo
printf '%s\n' "$P" | sudo docker run --rm -i git.via.moe/dejavu/ecoku:v0.2.7 hash-password
unset P
```

生成两把密钥（各运行一次，分别填入）：

```bash
openssl rand -hex 32      # ECOKU_ADMIN_TOKEN_KEY
openssl rand -base64 32   # ECOKU_NOTIFICATION_ENCRYPTION_KEY
```

::: danger 请把主密钥和数据库一起备份
在后台保存过 SMTP、Telegram 或人机验证凭据之后，`ECOKU_NOTIFICATION_ENCRYPTION_KEY` 就是解开它们的唯一钥匙。密钥丢失或被改动，Ecoku 会在启动时因为无法解密而拒绝运行。[备份](./backup)时 `ecoku.env` 必须与 `data/` 放在同一份归档里。
:::

## 5. 启动并检查

```bash
cd ~/Ecoku
sudo docker compose config --quiet   # 检查语法，没有输出即正常
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
```

首次启动时，Ecoku 会在 `data/ecoku.sqlite3` 创建数据库并初始化到最新 schema。日志里出现 `Server starting on :12123` 即表示服务已监听。

在宿主机上确认健康接口：

```bash
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

正常时返回：

```json
{"code":200,"message":"Success","data":{"status":"healthy","timestamp":1790000000}}
```

健康接口只说明进程在响应请求。如果容器反复重启，先看 `docker compose logs`：配置错误、环境变量为空、目录权限不对都会在日志里写明原因，常见情况见[常见问题](./faq)。

## 下一步

1. [配置反向代理](./reverse-proxy)，让 `https://ecoku.example.com` 可以从公网访问。
2. 打开 `https://ecoku.example.com/admin/` [登录后台](./admin)，注册第一个站点。
3. 把评论区[嵌入博客页面](../integration/html)。

如果要从 Twikoo 迁移历史评论，请在第 2 步注册站点之后、有人发表新评论之前完成，见[从 Twikoo 迁移](./twikoo)。
