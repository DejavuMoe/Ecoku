# Docker 部署

Ecoku 采用单容器 Docker Compose 部署模型，以极小资源开销提供全套服务。容器在内部监听 `127.0.0.1:12123`，公网 HTTPS 由宿主机反向代理（Caddy / Nginx）终止。

> [!NOTE]
> 文档中的 `git.via.moe/dejavu/ecoku:v0.1.9` 为当前正式镜像；`ecoku.example.com` 均为示例占位符，实际部署时请替换为您的真实域名。

---

## 1. 准备目录与权限

Ecoku 容器采用非 root 用户 `10001:10001` 运行，以只读根文件系统启动。主流 Linux 环境下可使用 `sudo install -d` 一步创建目录并配置容器所需的所有者与权限：

```bash
# 进入部署根目录
mkdir -p ~/Ecoku && cd ~/Ecoku

# 一步创建 logs 与 data 目录并配置 UID/GID 10001 与 750 权限
sudo install -d -o 10001 -g 10001 -m 750 app/logs data
```

---

## 2. 编写 Compose 配置

使用 `cat <<'EOF'` 写入 `compose.yaml`：

```bash
cd ~/Ecoku

cat <<'EOF' > compose.yaml
services:
  ecoku:
    image: "git.via.moe/dejavu/ecoku:v0.1.9"
    init: true
    restart: unless-stopped
    container_name: ecoku
    env_file:
      - ./ecoku.env
    ports:
      # 仅绑定宿主机本地回环地址，严禁直接暴露 0.0.0.0
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
      - ./app/logs:/var/log/ecoku
      - ./data:/data
    deploy:
      resources:
        limits:
          memory: 384M
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
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
EOF
```

> [!IMPORTANT]
> - 生产环境**严禁**使用 `latest` 等浮动标签，必须显式指定具体的语义化版本号（如 `v0.1.9`）。
> - 容器端口请务必绑定到 `127.0.0.1:12123`，防止绕过反向代理直接访问裸端口。

---

## 3. 配置文件 `app/config.yaml`

使用 `cat <<'EOF'` 生成配置文件，并设置容器只读权限：

```bash
cd ~/Ecoku

cat <<'EOF' > app/config.yaml
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
  instance_public_url: "https://ecoku.example.com"

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
    - "https://ecoku.example.com"
EOF

# 设置所属权与权限，确保容器内非 root 用户 (10001) 拥有只读权限
sudo chown 10001:10001 app/config.yaml
sudo chmod 640 app/config.yaml
```

---

## 4. 环境变量与密钥生成 `ecoku.env`

创建 `ecoku.env` 文件。可通过下列命令自动生成高强度随机密钥并追加至环境变量中。

该流程具备**幂等性**：各条目若已存在会自动跳过，重复执行不会覆盖；随机密钥在终端**无须回显**；密码哈希采用交互式不可见输入生成；环境变量值若带有特殊符号（如 bcrypt 中的 `$` 及 base64 中的字符）均自动以单引号包裹，防止被 shell 或 Compose 错误插值：

```bash
cd ~/Ecoku

# 1. 创建敏感环境变量文件并赋予安全权限（仅当前用户可读写）
touch ecoku.env
chmod 600 ecoku.env

# 2. 写入通用默认变量（已存在则自动跳过）
grep -q "^GIN_MODE=" ecoku.env || echo "GIN_MODE='release'" >> ecoku.env
grep -q "^TZ=" ecoku.env || echo "TZ='Asia/Shanghai'" >> ecoku.env
grep -q "^ECOKU_ADMIN_USERNAME=" ecoku.env || echo "ECOKU_ADMIN_USERNAME='admin'" >> ecoku.env

# 3. 交互式输入管理员密码，生成 Bcrypt 哈希并写入（密码输入不回显，已存在则自动跳过）
if ! grep -q "^ECOKU_ADMIN_PASSWORD_HASH=" ecoku.env; then
  read -rsp '输入管理员密码: ' ADMIN_PASS; echo
  HASH=$(printf '%s\n' "$ADMIN_PASS" | sudo docker run --rm -i --entrypoint /app/ecoku-server "git.via.moe/dejavu/ecoku:v0.1.9" hash-password)
  unset ADMIN_PASS
  echo "ECOKU_ADMIN_PASSWORD_HASH='$HASH'" >> ecoku.env
fi

# 4. 自动生成 64 位十六进制管理员 Token 签名密钥（无终端回显，已存在则自动跳过）
if ! grep -q "^ECOKU_ADMIN_TOKEN_KEY=" ecoku.env; then
  echo "ECOKU_ADMIN_TOKEN_KEY='$(openssl rand -hex 32)'" >> ecoku.env
fi

# 5. 自动生成 32 字节 Base64 主加密密钥（用于通知与验证码凭据加密，无终端回显，已存在则自动跳过）
if ! grep -q "^ECOKU_NOTIFICATION_ENCRYPTION_KEY=" ecoku.env; then
  echo "ECOKU_NOTIFICATION_ENCRYPTION_KEY='$(openssl rand -base64 32)'" >> ecoku.env
fi
```

---

## 5. 启动与验证

```bash
cd ~/Ecoku

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

接下来，请配置前端 [反向代理](/self-hosting/reverse-proxy) 终止 HTTPS 并完成公网转发，或访问 [管理后台配置](/self-hosting/admin) 注册站点与博主身份。

---

## 6. 历史评论导入（可选）

如果您之前使用的是 Twikoo 评论系统，可以在当前实例完成全新部署后，将原有历史评论迁移至 Ecoku。

> [!IMPORTANT]
> - **仅限全新初始部署阶段**：Twikoo 评论导入命令（`import-twikoo`）**仅支持导入到已注册且零评论的目标站点**。
> - 若目标站点已有新评论写入，系统为确保树状层级关系、父子引用约束与评论 ID 连续性，将**严格拒绝导入**。
> - 详细导入步骤、脱敏预检与字段映射说明，请参阅 [Twikoo 评论导入](/self-hosting/twikoo)。
