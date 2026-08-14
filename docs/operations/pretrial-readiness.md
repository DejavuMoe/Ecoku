# Ecoku 试用前就绪检查

本文记录 2026-08-14 本地源码快照的试用前基线。它是行动清单，不代表 Woodpecker、Forgejo
Registry、双架构容器或线上环境已经验收。

## 当前基线

| 项目 | 本地结果 | 结论 |
| --- | --- | --- |
| 可提交源码（排除缓存、构建物与测试站点） | 约 205 个文件、1.65 MiB | 仓库源码体积不是阻塞项 |
| 浏览器 SDK ES bundle | 49.99 kB；gzip 13.48 kB | 单页评论场景足够小 |
| 同源通用加载器 | 2.29 kB；gzip 1.23 kB | 可直接由 Ecoku 容器复用 |
| 管理端主 JS | 119.34 kB；gzip 42.97 kB | 作为按需访问的管理页可接受 |
| 管理端 CSS | 21.32 kB；gzip 5.00 kB | 可接受 |
| Go 本机 stripped 可执行文件 | 23.84 MiB（Windows/amd64） | 不能替代 Linux 容器体积测量 |
| Node 生产依赖审计 | `pnpm audit --prod --audit-level high` 无已知漏洞 | 本地通过 |
| Go 漏洞分析 | 无可达 symbol/package 漏洞；仅报告未被调用的 `x/crypto/openpgp` 模块告警 | 记录并随依赖更新复核 |

当前运行镜像使用多阶段构建：Node 阶段生成管理端、浏览器 UMD 与通用加载器，Go 阶段生成无 CGO
的 stripped 服务端；最终 Alpine 镜像只保留服务端、管理端、两个浏览器资源、CA 证书和时区数据，
并以 UID/GID 10001 运行。Docker 构建上下文排除了文档、设计、测试站点、缓存、日志和数据库。

## 首次私有试用前必须完成

1. **为当前源码重新跑 tag 工作流**：`v0.1.0-rc.1` 已完成首次 Woodpecker 构建，但不包含
   当前的绑定挂载、同源浏览器资源和密码哈希命令。必须发布递增的 `v0.1.0-rc.2`，重新验证
   `netcup-rs1000` 与 `oracle-toronto` 的标签匹配、Registry Secrets、privileged 插件白名单、宿主
   Docker socket 和跨 workflow 依赖。失败的候选 tag 不复用，修复后继续递增版本。
2. **验证多架构产物**：`docker buildx imagetools inspect` 必须包含 `linux/amd64` 与
   `linux/arm64`；两种架构都要真实 pull、启动并检查 `/api/health`、`/admin/`、首次 SQLite 初始化、
   非 root 写入 `/data` 和优雅停止。记录 Registry 压缩大小与容器常驻内存。
3. **做一次 SQLite 恢复演练**：空库初始化、已有库重启、备份、破坏后恢复和 Twikoo 首次导入都要
   在隔离临时目录验证。任何两个运行实例都不能共享同一个可写 SQLite 文件。
4. **确定严格 CSP 的 SDK 交付方式**：当前 SDK 会为每个实例注入一个 `<style>`，并通过行内
   `style` 属性写入线程深度。内容站点若使用 `style-src 'self'`，这些样式会被浏览器拦截。正式试用前
   推荐把 SDK CSS 输出为独立、带版本指纹、同源托管的 `ecoku.css`，并把深度改成有限的 class 或
   `data-*` 选择器；不要通过全局开放 `unsafe-inline` 来规避。
5. **跑低配压力基线**：在 1 核 1 GB 环境测试公开列表、并发提交、管理分页、通知出队和限流。
   当前 SQLite 为保证外键一致性只开放一个连接，未启用 WAL 或 `busy_timeout`；先测量真实等待时间，
   再决定是否引入 WAL，而不是在没有恢复测试时直接改 PRAGMA。
6. **核对生产安全配置**：管理员凭据、token key、通知主密钥和 Registry PAT 只放受保护的 Secret；
   反向代理只信任精确地址；CORS 只列实际 Origin；日志轮转、磁盘空间和 SQLite 备份需要告警。

## 限量试用后再优化

- 浏览器 SDK 改为 JS/CSS 两个可缓存资源；文件名包含版本或内容 hash，内容站点返回一年
  `immutable`，HTML 仍使用短缓存或不缓存。这样多个页面复用浏览器缓存，也解决严格 CSP 问题。
- 维持 ES、UMD、CJS 三种发布格式只在确有调用方时才有价值；自用 Hugo 站点可只部署一个 UMD
  文件和一个 CSS 文件，npm 包仍保留 ES/CJS 契约。
- 为 client/admin 设置 gzip 后的 bundle budget，CI 超限即失败；管理端按页面拆包只在功能继续增长、
  首屏测量显示收益后再做，当前 42.97 kB gzip 不值得为了拆包增加复杂度。
- 根据压力结果决定 SQLite WAL、`busy_timeout`、连接策略和通知 outbox 批量大小；这些变更必须附带
  并发、停机备份和恢复测试。
- 增加容器镜像漏洞扫描、SBOM、基础镜像更新节奏和保留策略。当前 provenance 不增加运行层体积，
  但 Registry 中的架构中间标签应制定清理周期。

## 已验证与尚未验证的边界

本地已经通过 Go 测试/vet/build、client/admin 测试/type-check/build、Hugo 测试站点构建、YAML/JSON
解析、生产依赖审计和静态工作流契约检查。`v0.1.0-rc.1` 的 Woodpecker 构建与公开容器包由操作者
确认成功；当前机器没有 Docker 与 Woodpecker CLI，因此尚未验证本次 `v0.1.0-rc.2` 的 Dockerfile、
镜像体积、双架构拉取、容器运行或线上环境。对应操作以
[首个 RC 推送与 CI/CD 验收](./first-release.md)、[Woodpecker CI 指南](./woodpecker-ci.md)和
[自托管指南](./self-hosting.md)为准。
