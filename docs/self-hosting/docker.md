# Docker 部署

Ecoku 采用单容器 Docker Compose 部署模型，以极小资源开销提供全套服务。容器在内部监听 `127.0.0.1:12123`，公网 HTTPS 由宿主机反向代理（Caddy / Nginx）终止。

> [!NOTE]
> 文档中的 `registry.example.com/ecoku:v0.1.8` 与 `comments.example.com` 均为示例占位符，实际部署时请替换为您的镜像仓库地址与真实域名。

---

## 1. 准备目录与权限

Ecoku 容器采用非 root 用户 `10001:10001` 运行，以只读根文件系统启动。请先在宿主机上创建部署目录并设置正确的所有者权限：

```bash
# 创建部署目录结构
mkdir -p ~/Ecoku/app/logs ~/Ecoku/data
cd ~/Ecoku

# 创建空配置文件与环境变量文件
touch app/config.yaml ecoku.env
```

配置宿主机目录权限，确保容器用户拥有读写数据的最小必要权限：

```bash
# 设置 UID/GID 10001
sudo chown -R 10001:10001 app/logs data
sudo chown 10001:10001 app/config.yaml

# 设置严格文件权限
sudo chmod 750 app/logs data
sudo chmod 640 app/config.yaml
sudo chmod 600 ecoku.env
```

---

## 2. 编写 Compose 配置

在 `~/Ecoku/compose.yaml` 中编写如下内容：

```yaml
services:
  ecoku:
    image: registry.example.com/ecoku:v0.1.8
    container_name: ecoku
    restart: unless-stopped
    read_only: true
    user: "10001:10001"
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    env_file:
      - ./ecoku.env
    ports:
      # 仅绑定宿主机本地回环地址，严禁直接暴露 0.0.0.0
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
      - ./app/logs:/var/log/ecoku
      - ./data:/data
    tmpfs:
      - /tmp:rw,noexec,nosuid,size=64m
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:12123/api/health | grep -q 'ok' || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

> [!IMPORTANT]
> - 生产环境**严禁**使用 `latest` 等浮动标签，必须显式指定具体的语义化版本号（如 `v0.1.8`）。
> - 容器端口请务必绑定到 `127.0.0.1:12123`，防止绕过反向代理直接访问裸端口。

---

## 3. 配置文件 `app/config.yaml`

编辑 `~/Ecoku/app/config.yaml`：

```yaml
site:
  port: 12123
  # 日志始终输出到 stdout；指定普通文件路径时，进程内额外轮转保存日志文件
  log_path: "/var/log/ecoku/ecoku.log"
  # 信任的反代 IP 或 CIDR。生产若通过 Caddy 反代，填入 Docker 容器网关 (如 172.18.0.1/32)
  # 为空表示所有访客共用一个全局限流桶。严禁配置 0.0.0.0/0
  trusted_proxies: []

client:
  static_dir: "/app/client"

rate_limit:
  window_seconds: 60
  comment_submit: 5      # 评论提交频控（次/窗口）
  comment_delete: 30     # 评论删除频控
  admin_login: 5         # 管理员登录频控
  notification_test: 5   # 通知测试发送频控

notifications:
  # 数据库敏感字段加密主密钥对应的环境变量名称
  encryption_key_env: "ECOKU_NOTIFICATION_ENCRYPTION_KEY"
  # 实例对外公网规范 URL（用于拼装邮件中的回复链接）
  instance_public_url: "https://comments.example.com"

database:
  sqlite:
    path: "/data/ecoku.sqlite3"

admin:
  enabled: true
  static_dir: "/app/admin"
  username_env: "ECOKU_ADMIN_USERNAME"
  password_hash_env: "ECOKU_ADMIN_PASSWORD_HASH"
  token_key_env: "ECOKU_ADMIN_TOKEN_KEY"
  token_ttl_minutes: 480 # 管理员会话有效期 8 小时
  allowed_origins:
    # 允许访问管理端后台的精确 Origin
    - "https://comments.example.com"
```

---

## 4. 环境变量与密钥生成 `ecoku.env`

创建并编辑 `~/Ecoku/ecoku.env`（该文件严禁提交至版本控制系统）：

```dotenv
GIN_MODE=release
TZ=Asia/Shanghai

# 管理员用户名
ECOKU_ADMIN_USERNAME=admin

# 管理员密码 Bcrypt 哈希
ECOKU_ADMIN_PASSWORD_HASH=

# 管理端 Token 签名密钥 (至少 32 字符)
ECOKU_ADMIN_TOKEN_KEY=

# 数据库敏感凭据 (SMTP/Telegram/Captcha) 加密主密钥 (Base64 编码的 32 字节随机串)
ECOKU_NOTIFICATION_ENCRYPTION_KEY=
```

### 生成各密钥

通过以下命令分别生成独立高强度密钥并填入 `ecoku.env`：

1. **生成管理员密码 Bcrypt 哈希**：
   ```bash
   export ECOKU_IMAGE=registry.example.com/ecoku:v0.1.8
   read -rsp '输入管理员密码: ' ECOKU_PASSWORD; echo
   printf '%s\n' "$ECOKU_PASSWORD" | sudo docker run --rm -i --entrypoint /app/ecoku-server "$ECOKU_IMAGE" hash-password
   unset ECOKU_PASSWORD
   ```
   将输出的哈希值（形如 `$2a$10$...`）粘贴到 `ECOKU_ADMIN_PASSWORD_HASH`。

2. **生成管理员 Token 签名密钥**：
   ```bash
   openssl rand -hex 32
   ```
   将生成的 64 位十六进制字符串填入 `ECOKU_ADMIN_TOKEN_KEY`。

3. **生成主加密密钥**：
   ```bash
   openssl rand -base64 32
   ```
   将生成的 Base64 字符串填入 `ECOKU_NOTIFICATION_ENCRYPTION_KEY`。

---

## 5. 启动与验证

```bash
# 验证 Compose 配置语法
sudo docker compose config --quiet

# 拉取镜像并后台启动
sudo docker compose pull
sudo docker compose up -d

# 检查容器状态与运行日志
sudo docker compose ps
sudo docker compose logs --tail=100 -f ecoku
```

### 健康检查验证

```bash
curl -fail http://127.0.0.1:12123/api/health
# 预期输出: {"status":"ok"}
```

接下来，请配置前端 [反向代理](/self-hosting/reverse-proxy) 终止 HTTPS 并完成公网转发。
