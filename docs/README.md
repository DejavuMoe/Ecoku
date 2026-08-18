# Ecoku 文档

面向运维、开发与产品边界的入口索引。历史验收记录在 `progress/`，只作当时版本证据，不约束当前发布。

## 运维

| 文档 | 内容 |
| --- | --- |
| [Docker Compose 自托管](operations/self-hosting.md) | 首次部署、反代、站点与通知、Twikoo 导入、静态站接入、备份、升级、故障排查 |

## 开发

| 文档 | 内容 |
| --- | --- |
| [本地开发](development/local-setup.md) | Go 服务端、`air` 热重载、client/admin 前端、环境变量与常见工作流 |

根 [README](../README.md) 另有最小 Hugo 接入片段与 CI 验证命令。

## 产品与架构

| 文档 | 内容 |
| --- | --- |
| [产品约束](product/constraints.md) | 评论体验、隐私、通知、迁移与运行边界 |
| [仓库目录约定](architecture/repository-layout.md) | 各目录所有权与是否进入镜像 |
| [二进制发布可行性](architecture/release-artifact-feasibility.md) | Forgejo Release、Linux 产物、手动部署与所需 CI 权限的研究结论 |

## 示例

| 路径 | 内容 |
| --- | --- |
| [`examples/html`](../examples/html) | 通用静态 HTML 接入 |
| [`examples/hugo-papermod`](../examples/hugo-papermod) | Hugo PaperMod 片段 |

## 历史验收

`progress/` 下的 P0～P4 与专项记录描述验收当时的版本与实例，不作为当前部署或开发的默认入口。
