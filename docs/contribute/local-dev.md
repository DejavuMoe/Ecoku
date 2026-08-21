# 本地开发

生产以 Docker Compose 为准。本地用 SQLite 文件与 `server/config.yaml`，不依赖容器。

## 前提

- Go 1.26+（与 CI 一致）
- Node.js 20.19+ / 22.12+ / 24+ 与 pnpm 11.3+
- 可选：[air](https://github.com/air-verse/air)

```bash
pnpm install --frozen-lockfile
cp server/config.yaml.example server/config.yaml
mkdir -p server/data
```

按需编辑 `server/config.yaml`：`client.static_dir` / `admin.static_dir` 指向对应 `dist`；启用管理端时 `admin.enabled: true`；`admin.allowed_origins` 含管理端 dev 地址（默认 `http://localhost:5173`）；站点 `allowed_origins` 含评论区预览（默认 `http://localhost:3000`）。

## 环境变量

在 `server/` 下导出（bash）：

```bash
export ECOKU_ADMIN_USERNAME="dev-admin"
export ECOKU_ADMIN_PASSWORD_HASH="<bcrypt 哈希>"
export ECOKU_ADMIN_TOKEN_KEY="<至少 32 字节的随机十六进制>"
export ECOKU_NOTIFICATION_ENCRYPTION_KEY="<Base64 编码的 32 字节密钥>"
```

```bash
printf 'your-password\n' | go run ./server hash-password
openssl rand -hex 32
openssl rand -base64 32
```

## 启动

```bash
pnpm -C packages/client build
pnpm -C packages/admin build
cd server && go run .
# 或：air
```

默认 `http://127.0.0.1:12123`。空库首次启动会跑完全部迁移；删除 `server/data/` 可重置。

评论区：`pnpm -C packages/client dev`（`http://localhost:3000`）。

管理端：

```bash
export ECOKU_ADMIN_DEV_API_URL="http://127.0.0.1:12123"
pnpm -C packages/admin dev
```

Vite 把 `/api` 代理到该地址。文档站点：`pnpm docs:dev`。

日常验证交给 Woodpecker。本地只在 CI 未覆盖处补充：`pnpm -C packages/<pkg> test`、`go test -count=1 ./...`、已批准原型的 `designs/**/*.test.mjs`。
