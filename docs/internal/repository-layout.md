# Ecoku 仓库目录约定

本仓库把运行时代码、可复制示例、设计证据、运维配置和本机验收场分开，避免测试数据、构建产物
或私有配置进入发布包和 Docker 构建上下文。

| 路径 | 所有权与用途 | 是否进入运行时镜像 |
| --- | --- | --- |
| `server/` | Go API、SQLite3、Twikoo 导入、通知与嵌入管理端 | 是 |
| `packages/client/` | 可独立分发的浏览器 SDK，以及容器同源托管的加载器、UMD 与可选 CSS | 是，仅复制构建后的 `ecoku-loader.js`、`ecoku.umd.js`、`ecoku.css` 与 `ecoku.unstyled.css` |
| `packages/admin/` | Svelte 5 管理端源码 | 仅构建后的 `dist` |
| `designs/` | 当前设计基线、测试 fixture 与历史原型 | 否 |
| `examples/` | 无私有数据的最小站点接入示例 | 否 |
| `compose.yaml`、`deploy/` | GHCR 精确版本镜像、公开配置模板与私有环境变量占位 | Compose 进入源码，私有文件不进入 Git |
| `.woodpecker/` | 仅启用 `master` push 的文档构建与部署；其他工作流保留 YAML 并显式禁用 | 否 |
| `.github/workflows/` | `master`/PR 完整验证、tag 版本校验、GHCR 双架构镜像、npm SDK 与 GitHub Release 发布 | 否 |
| `docs/` | VitePress 文档站点（简体中文默认，另有 `en/`、`zh-hant/`） | 否 |
| `docs/internal/` | 产品约束与仓库约定，供实现与 Agent 对照，不进入站点导航 | 否 |
| `docs/progress/` | 历史验收记录，不约束当前实现 | 否 |
| `scripts/` | 本地/测试环境同步和真实 API 冒烟工具 | 否 |
| `VERSION`、`CHANGELOG.md` | 服务端容器发布版本与候选版本变更记录 | `VERSION` 保存不带 `v` 的唯一版本号；发布 tag 为 `v$(cat VERSION)`，并作为 OCI 构建参数与标签来源 |
| `LICENSE` | 与容器 OCI `MIT` 标记一致的项目级许可证 | 随源码发布 |

仓库根目录只保留跨包配置、容器入口和项目级说明。依赖缓存、日志、SQLite、构建输出、真实
Twikoo 导出、`node_modules` 与仓库外的本机测试站点均不得成为提交或 Docker 构建上下文。

历史验收记录保留当时的路径、版本和功能边界；移动后的历史原型位于
`designs/archive/admin-layout/`。当前产品边界以 `docs/internal/constraints.md` 和当前源码为准。
面向操作者的部署与接入见 `docs/self-hosting/`；本地开发见 `docs/contribute/local-dev.md`。
文档站点预览：`pnpm docs:dev`。
