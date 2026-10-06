# 本地开发

本地开发使用仓库根 `mise.toml` 固定的 Go、Node.js 与 pnpm，不使用 Corepack。GitHub Actions 安装对应版本的工具链；容器构建和 Woodpecker 文档部署使用官方镜像，不安装 mise。生产部署仍使用 Docker Compose。

## 初始化

```bash
mise install
pnpm install --frozen-lockfile
cp server/config.yaml.example server/config.yaml
mkdir -p server/data
```

一次性构建产物与验证文件放在 Git 排除的根目录 `tmp/`。本地数据库和持久密钥由服务按配置写入 `server/data/`，不要提交这些运行数据。

本地服务使用 SQLite 文件与 `server/config.yaml`。新数据库首次启动时会自动创建管理员 `admin`，在终端打印临时密码，并在 `server/data/ecoku-secrets.json` 保存持久密钥。用临时密码登录后台后必须改密；无需预先导出管理员凭据或通知加密密钥。

已有开发数据库继续使用原管理员账号；如之前配置过旧环境变量，请先完成持久化迁移再移除，参见 [旧配置迁移](../self-hosting/upgrade#legacy-config)。

## 启动

```bash
(cd server && go run .)
pnpm -C packages/client dev
ECOKU_ADMIN_DEV_API_URL=http://127.0.0.1:12123 pnpm -C packages/admin dev
pnpm docs:dev
```

以上命令按需在不同终端运行。

源码运行默认仅监听 `127.0.0.1`，通过 `http://127.0.0.1:12123` 访问 API，默认端口为 `12123`，数据库位于 `server/data/ecoku.bin`，持久密钥位于同目录的 `ecoku-secrets.json`。源码运行默认不提供浏览器静态资源，评论区与管理后台使用各自的 Vite 开发服务器；Docker 镜像提供构建后的静态页面。容器模式（`ECOKU_RUNTIME=container`）继续监听容器内所有接口，宿主机可访问范围仍由 Compose 端口映射决定。

评论区开发 demo 固定使用本机 API `http://127.0.0.1:12123/`，URL 查询参数不能选择或覆盖服务端地址。

完整验证由 GitHub Actions 执行；本地只运行与当前改动直接相关且 CI 未覆盖的检查。

管理端开发页的来源（示例配置中的 `http://localhost:5174`）必须写在独立的 `admin.allowed_origins` 中，开发页通过 Vite 的同源 `/api` 代理访问服务端。仅 `http://localhost`、回环 IP 的明确允许来源使用非 Secure Cookie，生产必须 HTTPS。
