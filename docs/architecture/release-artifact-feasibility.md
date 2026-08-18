# Ecoku 二进制发布与手动部署可行性

本文是可行性研究，不是当前部署契约。正式产物尚未生成前，生产仍以
[`compose.yaml`](../../compose.yaml) 和[自托管文档](../operations/self-hosting.md)为准，不得据此假设
Forgejo Release 中已经存在可安装文件。

## 结论

在不改变运行时的前提下，可以为每个 Linux 架构发布一个自包含目录包，但当前不能只发布裸
`ecoku-server` 文件：服务启动时还需要 Vue 管理端 `admin/` 和评论 SDK `client/` 构建产物，配置中的
`admin.static_dir` / `client.static_dir` 会检查这些文件和目录。

推荐第一阶段为同一个 Forgejo Release 发布：

```text
ecoku_<VERSION>_linux_amd64.tar.gz
ecoku_<VERSION>_linux_arm64.tar.gz
SHA256SUMS
```

每个架构包包含：

```text
ecoku-server
admin/
client/
config.yaml.example
LICENSE
```

服务端当前使用 `CGO_ENABLED=0`，SQLite 驱动为纯 Go `modernc` 实现，因此同一个架构的 Linux 二进制
不依赖 glibc 或 musl，可分别在 Debian 13 与 Alpine Linux 上运行。amd64 和 arm64 仍必须使用不同
二进制，不能用一个可执行文件跨 CPU 架构运行。

如果产品要求真正的“单个可执行文件”，需要把 `admin/dist` 与选定的 `client/dist` 文件改为
`go:embed`，让路由从 `embed.FS` 提供资源，并重新定义 `static_dir` 的覆盖/禁用语义。这会改变运行时与
配置契约，应先独立设计、测试和批准，不能作为 CI 打包的附带改动。

## Forgejo Release 工作流

Woodpecker 官方 `woodpeckerci/plugin-release:0.3.1` 支持 Forgejo/Gitea，可在 tag 对应 Release
不存在时创建 Release，并上传文件、生成校验和。建议未来的 `release-binaries` 工作流依赖
`publish-manifest`，确保双架构容器镜像和 manifest 均成功后才创建 Forgejo Release。

需要新增一个 Woodpecker 仓库 Secret：

```text
forgejo_release_token
```

该 token 应在 Forgejo 中限定为当前仓库，最小 scope 为：

```text
write:repository
read:misc
```

现有 `forgejo_registry_token` 只用于 OCI Registry；除非已核实同时具备上述仓库 scope，否则不要复用。
Forgejo API 默认开启，Release 附件还受实例 `[attachment]` 的 `ALLOWED_TYPES`、`MAX_SIZE`、`MAX_FILES`
与存储配额限制。计划中的两个 tarball 和一个校验和文件通常低于默认最多五个附件，但实施前仍须读取
实例实际配置。

推荐的不可变发布策略：

- 插件镜像固定精确版本，不使用 `latest`；
- `file_exists: fail`，同一 tag 已有同名附件时失败，不静默覆盖；
- Release 标题使用 `CI_COMMIT_TAG`，说明从对应 CHANGELOG 章节生成；
- 生成 SHA-256 校验和；
- 不在 CI 日志输出 token；
- 不由 CI 创建或移动 Git tag，只消费已经推送并通过一致性校验的 tag。

若以后需要对二进制或校验和做 GPG/minisign 签名，还需独立的签名私钥 Secret、离线备份和轮换方案；
首期不应把个人交互式 GPG 私钥直接放入 Woodpecker。

## 手动部署边界

正式实现后，自托管文档可以增加 Docker Compose 之外的手动安装章节，并继续使用现有运行环境变量：

```text
TZ
ECOKU_ADMIN_USERNAME
ECOKU_ADMIN_PASSWORD_HASH
ECOKU_ADMIN_TOKEN_KEY
ECOKU_NOTIFICATION_ENCRYPTION_KEY
```

手动安装仍需要：

- 独立非 root `ecoku` 用户；
- 只读程序和静态资源目录；
- 仅 `ecoku` 可写的 SQLite 数据目录；
- 权限为 `0600` 的环境文件；
- 只监听 `127.0.0.1:12123`，由本机 Caddy 提供 HTTPS；
- 正常 SIGTERM 停服、WAL checkpoint、冷备份和同版本回滚；
- `ca-certificates` 与 `tzdata`。

Debian 13 推荐 systemd 单元和 `EnvironmentFile=`；Alpine Linux 推荐 OpenRC 服务与独立配置文件。
两者都应把工作目录固定到安装目录，使 `config.yaml` 可预测，并在公开配置里使用绝对路径指向
`admin/`、`client/`、SQLite 与日志。不能把 Secret 写入 systemd/OpenRC unit、命令行或 Git。

正式文档还必须分别验证：启动、健康检查、Caddy 反代、管理员登录、评论提交/回复、通知、冷备份、
升级和回滚。上述包和服务脚本完成并经 CI 验收前，不向操作者发布可复制的安装命令。

## Docker 构建缓存现状

两个原生架构工作流已经使用 `plugin-docker-buildx` 的 `cache_images`：

```text
git.via.moe/dejavu/ecoku:buildcache-amd64
git.via.moe/dejavu/ecoku:buildcache-arm64
```

插件会把它们作为 BuildKit registry cache 导入并以 `mode=max` 更新，能复用所有可传输的多阶段构建层。
Dockerfile 又把依赖清单与源码分开复制，因此仅修改 Go 源码不会重做 pnpm 安装，仅修改前端也不会重做
Go module 下载。不同架构使用不同 cache tag，避免并发写入同一个 cache manifest。

当前插件默认在构建后清理本地 Docker 环境，所以跨 tag 的稳定缓存来自 Forgejo Registry。Dockerfile
中的 `RUN --mount=type=cache` 能在同一个持久 builder 内复用包管理器/编译器内部缓存，但 BuildKit 不会
把 cache mount 内容导出到 registry cache；在源码变化导致 `go build` 层失效时，新的临时 builder
不能取回旧 Go build cache。

若测量后仍需进一步加速，可以为每个原生 Agent 配置独立的持久 BuildKit/Docker 数据卷，并设置磁盘
配额、GC 与监控。这需要启用 trusted volumes，并修改 Agent 的 `WOODPECKER_BACKEND_DOCKER_VOLUMES`
或等价宿主卷配置，不应仅靠仓库 YAML 擅自挂载宿主路径。当前 `buildkit_oci_max_parallelism: 1` 也会限制
并行度；提高前必须先核实两个 Agent 的内存、CPU 与历史 OOM 情况。

本次安全优化不新增这些 Agent 配置：tag 不再重复完整测试，保留现有 registry cache、原生双架构并行
构建和 provenance，从而先移除最确定的重复耗时，再根据 Woodpecker 的实际 cache hit 日志决定下一步。
