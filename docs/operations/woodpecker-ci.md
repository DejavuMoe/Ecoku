# Forgejo 16.0.2 + Woodpecker 3.17.0 CI 与多架构镜像发布

本仓库使用 `.woodpecker/` 下的四个工作流：

| 工作流 | Agent | 触发条件 | 产物 |
| --- | --- | --- | --- |
| `test` | `netcup-rs1000` / `linux/amd64` | push、PR、tag、手动 | 前后端测试、类型检查、构建和 Go vet |
| `image-amd64` | `netcup-rs1000` / `linux/amd64` | `v*` tag 且测试通过 | `TAG-amd64` 镜像 |
| `image-arm64` | `oracle-toronto` / `linux/arm64` | `v*` tag 且测试通过 | `TAG-arm64` 镜像 |
| `publish-manifest` | `netcup-rs1000` / `linux/amd64` | 两个架构镜像均成功 | 同版本多架构 `TAG` manifest |

多个 workflow 在不同 Agent 上运行且不共享工作目录，因此这里以 Forgejo OCI Registry 作为架构
产物交换层，再合成 manifest。Agent 选择使用已经注册的精确标签；Woodpecker 要求 workflow 的
每个标签都能被同一个 Agent 匹配，参见官方
[workflow syntax](https://woodpecker-ci.org/docs/usage/workflow-syntax)。

## 1. 固定地址与命名

- Git remote：`ssh://git@ssh.via.moe/dejavu/Ecoku.git`；
- Forgejo Web/Registry：`git.via.moe`；
- 镜像：`git.via.moe/dejavu/ecoku`；
- 当前候选版本：`v0.1.0-rc.2`，必须与根 `VERSION` 的 `0.1.0-rc.2` 一致；
- 默认分支：`master`。

Forgejo 容器镜像格式为 `{registry}/{owner}/{image}`。镜像名与仓库名匹配，Dockerfile 还写入
`org.opencontainers.image.source`，发布后应关联到仓库 Packages；若未自动关联，可在包设置中手动
关联。参见 Forgejo 16
[Container Registry 文档](https://forgejo.org/docs/v16.0/user/packages/container/)。

## 2. 激活仓库与核对 Agent

1. 在 Woodpecker 的「仓库」页面激活私有仓库 `dejavu/Ecoku`。
2. 仓库配置路径保持默认，使其发现 `.woodpecker/*.yml`；不要填写单个文件路径。
3. 仓库可见性保持私有；允许 pull request，但不要开启部署权限。
4. 首次测试阶段可把“批准要求”限制为来自 fork 的 PR，并把 `dejavu` 加入允许用户。
5. 仅为此私有仓库启用构建所需的受信任能力：
   - `image-*` 需要安全/privileged 插件；
   - `publish-manifest` 需要挂载 `/var/run/docker.sock`，因此需要受信任卷；
   - 不需要受信任网络。
6. 核对 Agent 标签：
   - `netcup-rs1000`：`platform=linux/amd64`、`backend=docker`、
     `role=forgejo-local`、`server=netcup-rs1000`；
   - `oracle-toronto`：`platform=linux/arm64`、`backend=docker`、
     `role=oracle-toronto`、`server=oracle-toronto`。

两台 Agent 容量为 1 时无需修改 workflow；依赖和并发限制会避免同架构发布任务互相挤占，
BuildKit 内部并行度也限制为 1，以降低低配机器峰值内存。

## 3. 允许固定版本 Buildx 插件

构建使用 `woodpeckerci/plugin-docker-buildx:6.1.0`。Woodpecker 3.x 不再默认授予插件 privileged
权限，Server 环境必须精确加入：

```dotenv
WOODPECKER_PLUGINS_PRIVILEGED=woodpeckerci/plugin-docker-buildx:6.1.0
```

重启 Woodpecker Server 后再运行发布。不要配置无版本插件名，也不要把普通命令容器加入允许列表。
Woodpecker 的 [3.x 迁移说明](https://woodpecker-ci.org/migrations)要求显式配置 privileged 插件。

`publish-manifest` 使用普通 Docker CLI 并挂载 Docker socket。宿主卷只应授权给受信任私有仓库，
参见官方[卷安全说明](https://woodpecker-ci.org/docs/usage/volumes)。能够修改该 workflow 的人等价于
能够控制对应 Agent 的 Docker daemon，因此不要接受未经审查的外部修改。

## 4. 创建单仓库 Forgejo 细粒度令牌

在用于发布包的 Forgejo 用户下打开「用户设置 → 应用 → 生成新令牌」：

1. 仓库和组织访问权限选择「仅限部分仓库」；
2. 只选择 `dejavu/Ecoku`；
3. `package` 选择「读写」；
4. `repository`、`admin`、`issue`、`user` 等其他类别保持「无访问权限」；
5. 生成后只复制一次，保存进密码管理器和 Woodpecker Secret。

这是 Forgejo 16.0.2 当前界面提供的单仓库最小授权方式；范围语义见 Forgejo 16
[访问令牌范围](https://forgejo.org/docs/v16.0/user/authentication/token-scope/)。启用 2FA 或 OAuth 时，
Registry 登录使用 PAT，不使用账户密码。不要把令牌放进仓库、命令参数、截图或日志。

## 5. 配置 Woodpecker 仓库 Secrets

在 Ecoku 仓库「密钥」中添加：

| Secret | 值 |
| --- | --- |
| `forgejo_registry` | `git.via.moe` |
| `forgejo_image` | `git.via.moe/dejavu/ecoku` |
| `forgejo_registry_user` | `dejavu` |
| `forgejo_registry_token` | 上一步生成的 PAT |

四项只允许 `tag` 事件，不允许 `pull_request`。不要设置“仅插件可用”：两个架构 workflow 由 Buildx
插件读取，而 manifest workflow 由普通 Docker CLI 步骤读取。Woodpecker 默认不向 PR 暴露 Secret；
命令中的 `${...}` 必须写成 `$${...}`，参见官方
[Secrets 文档](https://woodpecker-ci.org/docs/usage/secrets)。

## 6. 首次 push 测试

首次 push 只应验证 `test`，不会发布镜像。由用户完成 Git 初始化、提交和推送后，在 Woodpecker
确认：

1. `test` 被 `push` 事件触发并落到 `netcup-rs1000`；
2. `frontend` 完成锁文件安装、client/admin 测试、类型检查和构建；
3. `server` 完成 `go test`、`go vet` 和静态二进制构建；
4. `image-amd64`、`image-arm64`、`publish-manifest` 均未运行；
5. 日志中没有 Registry PAT、管理员凭据或私有配置内容。

推送配置文件会触发首条 pipeline，具体查看方式见 Woodpecker
[First pipeline](https://woodpecker-ci.org/docs/usage/intro)。

## 7. 发布当前 RC

只有普通 push 的 `test` 已通过，才创建带注释 tag `v0.1.0-rc.2`。tag pipeline 会先检查：

- tag 满足 SemVer；
- 去掉前导 `v` 后与根 `VERSION` 完全一致；
- 全部前后端测试和构建仍通过。

成功顺序为：

1. `test`；
2. 原生 Agent 分别推送 `v0.1.0-rc.2-amd64` 和 `v0.1.0-rc.2-arm64`；
3. `publish-manifest` 合成 `v0.1.0-rc.2`；
4. Forgejo Packages 显示 `dejavu/ecoku` 及该版本。

默认不发布 `latest`。两个架构后缀标签是可追溯中间产物；部署只使用
`git.via.moe/dejavu/ecoku:v0.1.0-rc.2`。

## 8. 发布后验收

在有 Registry 读取权限的机器上交互式登录并检查：

```bash
docker login git.via.moe --username dejavu
docker buildx imagetools inspect git.via.moe/dejavu/ecoku:v0.1.0-rc.2
docker pull --platform linux/amd64 git.via.moe/dejavu/ecoku:v0.1.0-rc.2
docker pull --platform linux/arm64 git.via.moe/dejavu/ecoku:v0.1.0-rc.2
```

manifest 必须同时列出 `linux/amd64` 与 `linux/arm64`。再按
[RC 验收](./first-release.md)使用独立临时配置和绑定数据目录运行 AMD64 容器，验证健康、管理端、
SQLite 初始化和重启持久性；不要让两个架构容器共享 SQLite 文件。

## 9. 失败处理与边界

- 任一架构失败时不得认为 RC 已发布；manifest workflow 应保持不运行。
- 未被其他环境使用的首次失败 tag 也优先发布递增 RC，如 `v0.1.0-rc.2`，不要删除后重建同名 tag。
- Registry Secret 轮换后立即撤销旧 PAT，再更新 Woodpecker Secret。
- CI 只测试、构建和发布镜像，不连接部署服务器、不迁移数据库、不创建 Forgejo Release。
- 本地静态检查不能替代首次真实镜像体积、双架构拉取和容器运行验收。
