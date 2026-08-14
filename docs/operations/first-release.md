# 首个 RC 推送与 CI/CD 验收

本清单用于第一次把源码推送到私有 Forgejo 仓库，并验证 Woodpecker 测试、原生 AMD64/ARM64
构建、Forgejo Container Registry 和生产 Compose。它不会授权 CI 连接部署服务器或修改数据库。

## 1. 本地发布门槛

在 `D:\Forgejo\Ecoku` 执行：

```powershell
pnpm install --frozen-lockfile
pnpm verify:client
pnpm verify:admin

Push-Location server
go test -count=1 ./...
go vet ./...
go build ./...
Pop-Location
```

然后核对：

- `VERSION`、`package.json` 与计划 tag 都是 `0.1.0-rc.1`；
- `deploy/config.yaml`、`deploy/ecoku.env`、数据库、日志、备份、`node_modules`、构建产物和
  `test_site/` 均不会进入首次提交；
- `compose.yaml` 只有 `image:`，没有 `build:`，并固定 Forgejo RC 镜像；
- `docker compose config --quiet` 能在准备好私有部署文件后通过；
- `CHANGELOG.md` 已记录候选版本边界。

## 2. Forgejo 与 Woodpecker 前置门槛

按 [Woodpecker CI 指南](./woodpecker-ci.md)完成：

1. 激活 `dejavu/Ecoku`，配置路径保持默认；
2. 核对 `netcup-rs1000` 与 `oracle-toronto` 的完整标签；
3. Server 仅允许固定 Buildx 插件获得 privileged；
4. 仓库只启用安全插件和 Docker socket 所需的受信任卷，不启用受信任网络；
5. 创建只选择 `dejavu/Ecoku`、且只有 `package=读写` 的细粒度 PAT；
6. 配置四个只允许 tag 事件的 Woodpecker Secrets。

Forgejo 页面曾明确提示：私有仓库并不保证关联的软件包自动保持私有。首个镜像发布后必须检查包的
可见性与仓库关联，并在未登录窗口尝试访问包页面和拉取镜像。若未登录用户可读取，而项目要求私有，
则停止部署并先调整 Forgejo 所有者/包可见性策略。

## 3. 初始化 Git 与首次 push

仓库已有完整 README，不执行 `touch README.md`。由用户核对并执行：

```powershell
Set-Location D:\Forgejo\Ecoku

git init
git branch -M master
git config --get user.name
git config --get user.email

git add --all
git status --short
git diff --cached --check
git diff --cached --name-only
git commit -m "chore: prepare Ecoku v0.1.0-rc.1"

git remote add origin ssh://git@ssh.via.moe/dejavu/Ecoku.git
git remote -v
git push -u origin master
```

提交前必须人工确认暂存列表中没有 `deploy/config.yaml`、`deploy/ecoku.env`、`.env`、数据库、日志、
备份、Twikoo 导出、`node_modules`、`dist` 或 `test_site`。若 Git 身份为空，先用你自己的真实姓名和
邮箱配置；本文不代填。

## 4. 首次 push 验收

在 Woodpecker 查看这次 `push`：

- 只有 `test` 运行；
- 前端和 Go 步骤全部通过；
- 两个镜像构建和 manifest 工作流未运行；
- 日志无 Secret、私有配置、评论正文或邮箱；
- Forgejo 首次提交和 `master` 分支内容完整。

失败时只修复源码并重新 push；不要提前创建 tag。

## 5. 创建首个 RC tag

首次 push 的测试通过后执行：

```powershell
git status --short
git tag -a v0.1.0-rc.1 -m "Ecoku v0.1.0-rc.1"
git show --no-patch --decorate v0.1.0-rc.1
git push origin v0.1.0-rc.1
```

工作区必须干净，tag 必须指向刚通过 CI 的提交。不要使用 `--force`，不要删除并重建已推送 tag。

## 6. tag pipeline 验收

按依赖顺序确认：

1. `test` 再次通过，版本和 tag 校验通过；
2. AMD64 产物为 `git.via.moe/dejavu/ecoku:v0.1.0-rc.1-amd64`；
3. ARM64 产物为 `git.via.moe/dejavu/ecoku:v0.1.0-rc.1-arm64`；
4. manifest 产物为 `git.via.moe/dejavu/ecoku:v0.1.0-rc.1`；
5. manifest 同时列出 `linux/amd64` 和 `linux/arm64`；
6. Forgejo 包已关联到 `dejavu/Ecoku`，包可见性符合私有项目要求；
7. 镜像 OCI 标签中的 version、revision 和 source 与 tag 提交一致。

## 7. 生产 Compose 候选验收

在隔离部署目录复制 `compose.yaml` 与 `deploy/*.example`，生成独立秘密和测试配置。交互式登录后：

```bash
docker login git.via.moe --username dejavu
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose ps
curl --fail http://127.0.0.1:12123/api/health
docker compose restart ecoku
curl --fail http://127.0.0.1:12123/api/health
docker compose logs --tail=100 ecoku
```

人工检查 `/admin/` 登录、站点创建、公开提交/读取、回复线程、墓碑、通知设置与重启后 SQLite 数据。
随后按[反向代理文档](./reverse-proxy.md)验证 TLS/CORS；如迁移 Twikoo，再按
[自托管指南](./self-hosting.md#6-添加站点后首次导入-twikoo)在空站点上备份、dry-run、导入和核对。

## 8. 完成定义

只有下列证据同时存在，首个 RC 才算通过：

- 本地测试和构建通过；
- push pipeline 通过；
- tag 的四个 workflow 全部通过；
- 双架构 manifest 可拉取；
- 软件包可见性符合私有项目要求；
- AMD64 容器完成独立 SQLite、管理端和重启持久性验收；
- 未把真实秘密、数据库或个人数据提交进 Git。

ARM64 容器若只构建未运行，应单列为“镜像构建通过、运行尚未验证”，不能写成完整 ARM64 运行验收。
