# Docker 部署

单容器 Docker Compose，数据库为 SQLite。容器只监听宿主机 `127.0.0.1:12123`，公网 HTTPS 交给 Caddy 或 Nginx。

下文 `registry.example.com` 为镜像地址占位符，请换成实际仓库。

## 准备目录

需要 Docker Engine、Compose v2 和 HTTPS 域名。为每个实例准备独立目录：

```bash
mkdir -p ~/Ecoku/app/logs ~/Ecoku/data
cd ~/Ecoku
touch app/config.yaml ecoku.env
```

容器以非 root 用户 `10001:10001` 运行：

```bash
sudo chown 10001:10001 app/config.yaml app/logs data
sudo chmod 640 app/config.yaml
sudo chmod 750 app/logs data
sudo chmod 600 ecoku.env
```

## Compose

使用与镜像版本对应的模板。至少核对镜像、端口和三个挂载：

```yaml
services:
  ecoku:
    image: registry.example.com/ecoku:vX.Y.Z
    restart: unless-stopped
    env_file: ./ecoku.env
    ports:
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
      - ./app/logs:/var/log/ecoku
      - ./data:/data
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
```

模板中的 `read_only`、`tmpfs`、丢弃能力和健康检查应保留。不要使用 `latest`，也不要把端口绑到 `0.0.0.0`。

## 配置

`app/config.yaml` 至少包含：

```yaml
site:
  port: 12123
  log_path: /var/log/ecoku/ecoku.log
  trusted_proxies: []
notifications:
  encryption_key_env: ECOKU_NOTIFICATION_ENCRYPTION_KEY
  instance_public_url: https://comments.example.com
database:
  sqlite:
    path: /data/ecoku.sqlite3
admin:
  enabled: true
  allowed_origins:
    - https://comments.example.com
```

`trusted_proxies` 与反代见 [反向代理](./reverse-proxy)。`admin.allowed_origins` 是管理端来源，与评论站点来源分开配置。

可选：在 YAML 的 `sites[]` 里为站点声明 `management_key_env`，并在 `ecoku.env` 中提供对应变量。management key 只用于可信服务端自动化，且仅对 YAML 注册的站点生效；管理端单独创建的站点没有 management key。不要把 key 写进页面或浏览器。

## 密钥

`ecoku.env`（值勿写入公开页面或 Compose）：

```dotenv
GIN_MODE=release
TZ=Asia/Shanghai
ECOKU_ADMIN_USERNAME=
ECOKU_ADMIN_PASSWORD_HASH=
ECOKU_ADMIN_TOKEN_KEY=
ECOKU_NOTIFICATION_ENCRYPTION_KEY=
```

生成管理员密码哈希：

```bash
export ECOKU_IMAGE=registry.example.com/ecoku:vX.Y.Z
read -rsp 'Admin password: ' ECOKU_PASSWORD; echo
printf '%s\n' "$ECOKU_PASSWORD" | sudo docker run --rm -i --entrypoint /app/ecoku-server "$ECOKU_IMAGE" hash-password
unset ECOKU_PASSWORD
```

把输出写入 `ECOKU_ADMIN_PASSWORD_HASH`。其余密钥**分别**生成，且互不相同：

| 变量 | 要求 | 示例 |
| --- | --- | --- |
| `ECOKU_ADMIN_TOKEN_KEY` | 至少 32 个字符的随机串 | `openssl rand -hex 32` |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | Base64 编码的 32 字节 | `openssl rand -base64 32` |

## 启动

```bash
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=200 ecoku
curl --fail http://127.0.0.1:12123/api/health
```

`healthy` 只表示进程可响应。管理端与评论页需经反向代理访问后再验收。
