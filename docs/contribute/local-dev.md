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

本地服务使用 SQLite 文件与 `server/config.yaml`。按需启用管理端并设置允许来源；私密环境变量只在当前 shell 中导出，名称与要求以配置示例为准，不要写入仓库。

首次启动前，至少为示例站点设置管理密钥：

```bash
export ECOKU_EXAMPLE_SITE_MANAGEMENT_KEY="$(openssl rand -hex 32)"
```

## 启动

```bash
(cd server && go run .)
pnpm -C packages/client dev
ECOKU_ADMIN_DEV_API_URL=http://127.0.0.1:12123 pnpm -C packages/admin dev
pnpm docs:dev
```

以上命令按需在不同终端运行。

服务端默认为 `http://127.0.0.1:12123`，评论区开发页默认为 `http://localhost:3000`。若需要由 Go 提供静态文件，先构建相应包。

完整验证由 Woodpecker 执行；本地只运行与当前改动直接相关且 CI 未覆盖的检查。
