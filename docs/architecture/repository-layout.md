# Ecoku 仓库目录约定

本仓库把运行时代码、可复制示例、设计证据、运维配置和本机验收场分开，避免测试数据、构建产物
或私有配置进入发布包和 Docker 构建上下文。

| 路径 | 所有权与用途 | 是否进入运行时镜像 |
| --- | --- | --- |
| `server/` | Go API、SQLite3、Twikoo 导入、通知与嵌入管理端 | 是 |
| `packages/client/` | 可独立构建和分发的浏览器 SDK | 否，由内容站点自行托管 |
| `packages/admin/` | Vue 管理端源码 | 仅构建后的 `dist` |
| `designs/` | 当前设计基线、测试 fixture 与历史原型 | 否 |
| `examples/` | 无私有数据的最小站点接入示例 | 否 |
| `compose.yaml`、`deploy/` | Forgejo 精确版本镜像、公开配置模板与私有环境变量占位 | Compose 进入源码，私有文件不进入 Git |
| `.woodpecker/` | 测试、amd64/arm64 构建和多架构 manifest 工作流 | 否 |
| `docs/` | 产品约束、运维、集成和历史验收证据 | 否 |
| `scripts/` | 本地/测试环境同步和真实 API 冒烟工具 | 否 |
| `test_site/` | 本机真实 Hugo 集成验收场，可能是独立仓库 | 否，根仓库忽略 |
| `VERSION`、`CHANGELOG.md` | 服务端容器发布版本与候选版本变更记录 | 作为 OCI 构建元数据来源 |
| `LICENSE` | 与容器 OCI `MIT` 标记一致的项目级许可证 | 随源码发布 |

仓库根目录只保留跨包配置、容器入口和项目级说明。依赖缓存、日志、SQLite、构建输出、真实
Twikoo 导出、`node_modules` 与本机测试站点均不得成为提交或 Docker 构建上下文。

历史验收记录保留当时的路径、版本和功能边界；移动后的历史原型位于
`designs/archive/admin-layout/`。当前产品边界以 `docs/product/constraints.md` 和当前源码为准。
