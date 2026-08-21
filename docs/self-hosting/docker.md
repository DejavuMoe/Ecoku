# Docker 部署

生产只支持 Docker Compose + SQLite3。以仓库根 `compose.yaml` 和 `deploy/` 模板为准，不要为了「对齐文档」改端口或挂载。

## 前提

Linux、Docker Engine、Compose v2、OpenSSL，以及一个指向服务器的 HTTPS 域名。镜像使用精确 tag：

```text
git.via.moe/dejavu/ecoku:<VERSION>
```

不要使用 `latest`。建议在普通运维用户目录：

```bash
mkdir -p ~/Ecoku/app/logs ~/Ecoku/data ~/Ecoku/backups
cd ~/Ecoku
chmod 700 ./backups
```

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

容器以 UID/GID `10001:10001` 运行。`data/` 保存数据库与 WAL；升级时原样保留。

## 复制模板

从你要部署的 Git tag 复制 `compose.yaml` 与 `deploy/config.yaml.example`。服务端口已绑到 `127.0.0.1:12123`，公网只应打到本机反代。保持三个绑定挂载：`./app/config.yaml`、`./app/logs`、`./data`，以及 `env_file: ./ecoku.env`。

`app/config.yaml` 只改公开网址和管理端来源：

```yaml
notifications:
  instance_public_url: "https://comments.example.com"

admin:
  allowed_origins:
    - "https://comments.example.com"
```

其余与示例保持一致。限流默认使用容器看到的直接连接地址。需要按真实访客限流时，见 [反向代理](/self-hosting/reverse-proxy)。

## 初始化管理员

密码不会出现在命令参数、shell 历史或日志中：

```bash
ECOKU_IMAGE='git.via.moe/dejavu/ecoku:<VERSION>'

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

`TZ` 为 IANA 名称，控制评论时间显示，未设置时回退 `Asia/Shanghai`。不要把 `TZ` 写进 `app/config.yaml`。单引号包裹环境值，避免 Compose 插值 bcrypt 里的 `$`。

```bash
sudo chown "$USER":10001 ./app/config.yaml
sudo chmod 0640 ./app/config.yaml
sudo chown "$USER":"$USER" ./ecoku.env
sudo chmod 0600 ./ecoku.env
sudo chown -R 10001:10001 ./app/logs ./data
sudo chmod 0750 ./app/logs ./data
sudo docker compose config --quiet
```

## 启动

```bash
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku

curl --fail http://127.0.0.1:12123/api/health
curl --fail --head http://127.0.0.1:12123/client/ecoku-loader.js
```

健康状态必须为 `healthy`。空库会按顺序执行全部迁移；未知版本或校验失败会拒绝启动。

日志在 `sudo docker compose logs -f ecoku`。`log_path` 指向挂载文件时，进程另写一份并按约 10MB / 5 份 / 28 天轮转。不要用 `GIN_MODE=debug` 替代访问日志。日志不含 IP、UA、凭据或评论正文。

`/api/health` 只表示进程可响应，不证明数据库或迁移已完成。

接下来配置 [反向代理](/self-hosting/reverse-proxy)，然后在 [后台](/self-hosting/admin) 创建站点。
