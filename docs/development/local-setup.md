# Ecoku 本地开发

在仓库根目录进行前后端联调。生产仍以 Docker Compose 为准；本地用 SQLite 文件与 `server/config.yaml`，
不依赖容器。

## 前提

- Go 1.26+（与 CI 一致）
- Node.js 20.19+ / 22.12+ / 24+ 与 [pnpm](https://pnpm.io/) 11.3+
- 可选：[air](https://github.com/air-verse/air)（`go install github.com/air-verse/air@latest`）

## 1. 安装依赖

```bash
pnpm install --frozen-lockfile
```

## 2. 服务端配置

```bash
cp server/config.yaml.example server/config.yaml
mkdir -p server/data
```

按需编辑 `server/config.yaml`：

- `client.static_dir` 指向 `../packages/client/dist`（需先构建 client，见下节）
- `admin.static_dir` 指向 `../packages/admin/dist`（启用管理端时）
- `admin.enabled` 设为 `true` 以调试管理端
- `admin.allowed_origins` 包含管理端 dev 地址（默认 Vite 为 `http://localhost:5173`）
- `sites[].allowed_origins` 包含评论区 dev 地址（client 预览默认为 `http://localhost:3000`）

## 3. 环境变量

在 `server/` 目录下导出（PowerShell 示例；bash 用 `export`）：

```powershell
$env:ECOKU_ADMIN_USERNAME = "dev-admin"
$env:ECOKU_ADMIN_PASSWORD_HASH = "<bcrypt 哈希>"
$env:ECOKU_ADMIN_TOKEN_KEY = "<至少 32 字节的随机十六进制>"
$env:ECOKU_NOTIFICATION_ENCRYPTION_KEY = "<Base64 编码的 32 字节密钥>"
# 若 config.yaml 中站点配置了 management_key_env：
$env:ECOKU_EXAMPLE_SITE_MANAGEMENT_KEY = "<32 字节随机串>"
```

生成 bcrypt 哈希（在仓库根目录，需已构建服务端镜像或本地 `go build`）：

```bash
printf 'your-password\n' | go run ./server hash-password
```

密钥可用 OpenSSL：`openssl rand -hex 32`、`openssl rand -base64 32`。

## 4. 构建前端静态资源

服务端直接托管构建产物时，先构建再启动 Go：

```bash
pnpm -C packages/client build
pnpm -C packages/admin build
```

之后 `client.static_dir` / `admin.static_dir` 才会被 `/client/*` 与 `/admin/` 提供。

## 5. 启动服务端

在 `server/` 目录：

```bash
# 一次性运行
go run .

# 或热重载（读取 server/.air.toml）
air
```

默认监听 `http://127.0.0.1:12123`。健康检查：

```bash
curl --fail http://127.0.0.1:12123/api/health
```

空库首次启动会创建 SQLite 并按顺序执行全部迁移；`data/` 下的库文件可删除以重置。

## 6. 前端开发服务器

### 评论区 SDK（`packages/client`）

```bash
pnpm -C packages/client dev
```

默认 `http://localhost:3000`。在页面里把 `data-server-url` 指向正在运行的 Go 地址，并确保站点
`allowed_origins` 包含该 Origin。

### 管理端（`packages/admin`）

```bash
$env:ECOKU_ADMIN_DEV_API_URL = "http://127.0.0.1:12123"
pnpm -C packages/admin dev
```

Vite 会把 `/api` 代理到 `ECOKU_ADMIN_DEV_API_URL`，无需先构建 `admin/dist`。`admin.allowed_origins`
须包含 Vite 显示的 Origin（一般为 `http://localhost:5173`）。

## 7. 验证

日常改动交给 Woodpecker CI。本地仅在 CI 未覆盖处补充：

| 改动 | 本地 |
| --- | --- |
| client / admin 逻辑 | `pnpm -C packages/<pkg> test` |
| 服务端 | 在 `server/` 下 `go test -count=1 ./...` |
| 已批准原型 | 对应 `designs/**/*.test.mjs` |

## 版本说明

- 容器版本以根目录 `VERSION` 为准；与 `packages/client` 的 npm 版本独立。
- 浏览器接入默认使用实例同源的 `/client/ecoku-loader.js`，不依赖 npm 发布。
- npm 包发布仍延后，见 [产品约束](../product/constraints.md)。
