# 本地开发

本地开发使用仓库根 `mise.toml` 固定的 Go、Node.js 与 pnpm，不使用 Corepack。CI 与容器构建直接使用相同版本的官方 Node/Go 镜像，不安装 mise；生产部署仍以 Docker Compose 为准。

## 初始化

```bash
mise install
pnpm install --frozen-lockfile
cp server/config.yaml.example server/config.yaml
mkdir -p server/data
```

本机构建产物、运行数据与一次性发布验证统一放在 Git 排除的根目录 `tmp/`，不要写入源码目录。

本地服务使用 SQLite 文件与 `server/config.yaml`。管理后台始终启用，启动服务前在当前 shell 中导出管理员凭据，不要写入仓库。下面的登录密码是 `local-dev-password`：

```bash
export ECOKU_ADMIN_USERNAME=admin
export ECOKU_ADMIN_PASSWORD_HASH="$(printf '%s\n' 'local-dev-password' | (cd server && go run . hash-password))"
export ECOKU_ADMIN_TOKEN_KEY="$(openssl rand -hex 32)"
```

在后台保存 SMTP 密码、Telegram Bot Token 或人机验证密钥时，还需要导出 `ECOKU_NOTIFICATION_ENCRYPTION_KEY`（可用 `openssl rand -base64 32` 生成）。

## 启动

```bash
(cd server && go run .)
pnpm -C packages/client dev
ECOKU_ADMIN_DEV_API_URL=http://127.0.0.1:12123 pnpm -C packages/admin dev
pnpm docs:dev
```

以上命令按需在不同终端运行。

服务端固定监听 `http://127.0.0.1:12123`，数据库位于 `server/data/ecoku.bin`。源码运行只提供 API，评论区与管理后台使用各自的 Vite 开发服务器；Docker 镜像提供构建后的静态页面。

完整验证由 Woodpecker 执行；本地只运行与当前改动直接相关且 CI 未覆盖的检查。

管理端开发页的来源（示例配置中的 `http://localhost:5174`）必须写在独立的 `admin.allowed_origins` 中，开发页通过 Vite 的同源 `/api` 代理访问服务端。仅 `http://localhost`、回环 IP 的明确允许来源使用非 Secure Cookie，生产必须 HTTPS。
