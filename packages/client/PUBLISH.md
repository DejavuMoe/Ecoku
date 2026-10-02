# SDK 与 GitHub 发布

`.github/workflows/release.yml` 在 GitHub 收到 `v*` tag 后发布 GHCR 镜像、npm 包和 GitHub Release。v0.3.0 是首次 npm 发布版本；实际可下载状态以发布任务结果为准。不要重建或移动已发布 tag。

## 发布顺序

1. 校验 tag、`VERSION`、根与 `packages/client/package.json` 的版本、Compose 镜像和根 `CHANGELOG.md` 的发布章节。
2. 复用 `ci.yml`，验证该 tag 的 SDK、管理端、Go 服务和文档。SDK 完成 ESM、CommonJS、UMD、类型声明检查后打成 tarball。
3. 并行执行 npm 发布和镜像构建。npm 发布同一次运行保存的 tarball，不在有写权限的发布 job 中重新安装依赖或构建。amd64 / arm64 镜像在原生 runner 构建，以 digest 汇总为精确版本 tag。
4. npm 与镜像均成功后，使用根更新日志对应章节创建 GitHub Release，附带 `ecoku-<版本>.tgz` 和 `SHA256SUMS`。

发布 `v0.3.0` 时，SDK 版本为 `0.3.0`，镜像为 `ghcr.io/dejavumoe/ecoku:v0.3.0`。正式 npm 版本使用 `latest`，含预发布后缀的 tag 使用 `next` 并创建 GitHub prerelease；镜像只发布精确版本，不创建 `latest`。

SDK 的 `repository.url` 设为 `git+https://github.com/DejavuMoe/Ecoku.git`，`directory` 为 `packages/client`。如果实际 GitHub 仓库名称不同，首次发布前同步修改此字段和 npm Trusted Publisher；流水线会拒绝来源仓库不一致的包。

## 一次性设置

### GitHub 与 GHCR

- 将源码、工作流和将来的 release tag 同步到目标 GitHub 仓库；Forgejo 上的 tag 不会自动触发 GitHub Actions。
- 启用 Actions，并允许工作流使用声明的权限。GHCR 使用自动生成的 `GITHUB_TOKEN` 和 `packages: write`；GitHub Release 使用 `contents: write`，无需另建 PAT。
- 发布来源证明要求公开 GitHub 仓库。原生 arm64 runner 使用 `ubuntu-24.04-arm`；确认目标仓库可以使用该 runner。
- 如果同名 GHCR 包已存在，需要授予仓库写入权限。第一次创建后检查包的可见性，公开拉取需要将包设为 public。
- SDK 与镜像分别发布，无法跨 registry 做事务。某项失败时其他产物可能已存在，但 GitHub Release 尚不会创建；优先重跑失败 job，避免重新发布已存在的 npm 版本。

### npm

优先使用 [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)。在 `ecoku` 包的 Settings → Trusted Publisher 中填写：

| 字段 | 值 |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `DejavuMoe`，须与实际仓库所有者一致 |
| Repository | `Ecoku`，大小写须与实际仓库一致 |
| Workflow filename | `release.yml` |
| Environment | 留空，工作流未声明 environment |
| Allowed actions | 允许 `npm publish` |

正常发布使用 `id-token: write` 换取短期凭据，不需要 `NPM_TOKEN`。工作流使用 Node 24.19.0 随附的 npm，满足 Trusted Publishing 的 npm 11.5.1+ 要求，并启用 provenance。

若包尚未创建、还不能配置 Trusted Publisher，首次发布可以在仓库 Actions Secrets 添加临时 `NPM_TOKEN`：使用对目标包具有写入权限、允许 CI 发布的 granular token，按 npm 的 2FA 设置启用 Bypass 2FA。确认账户有权使用 `ecoku` 包名；registry 返回 404 不保证包名一定可注册。首次成功后配置 Trusted Publisher，再删除 Actions Secret 并撤销临时 token。不要把 token 写进仓库。

## 缓存与失败恢复

- SDK、管理端、文档和 Go 并行验证。pnpm store 由锁文件确定缓存；Go 缓存依据 `server/go.sum`，包含模块与构建缓存。
- Docker 使用 GHCR 的 `buildcache-amd64` / `buildcache-arm64`，保存中间构建层，可跨 tag 复用；两个架构不会互相覆盖缓存。
- 验证中的旧分支任务可取消；发布串行且不会主动取消正在发布的任务。不要一次推送多个待发布 tag，等待上一版完成后再推下一版。
- SDK、文档与 digest 的 Actions artifacts 保留 7 天。超过保留期不能依赖旧产物重跑下游 job，应检查已发布状态后重新安排发布。
- npm 版本不可覆盖。GitHub Release 使用创建操作，已存在时不会覆盖正文或附件。仅失败 job 重跑是首选恢复方式；发布成功的 tag 不移动、不重用。

若 tag 中的发布命令本身有误，重跑旧 job 不会读取主线修复。可手动运行 `recover-npm.yml`，填写原 tag 和原 Release run ID；该流程要求同一 tag 提交的全部验证与镜像 manifest 已成功，只发布原流水线保存的 SDK 包，不重建产物、不移动 tag、不覆盖镜像。使用 OIDC 时须单独授权该工作流；首次发布可使用现有临时 `NPM_TOKEN`。恢复 npm 后，再使用原 tag 的更新日志和 SDK 产物创建 GitHub Release。

## 与 Woodpecker 的分工

`.woodpecker/` 保持原样。现有文档站点仍由 Woodpecker 发布，GitHub 只构建、检查并保存文档产物；GitHub 不访问文档服务器或应用生产环境。保留的 Woodpecker tag 镜像流程仍会向 Forgejo registry 发布，Compose 继续使用已有的 Forgejo 精确镜像地址。

## 本地检查

```bash
node scripts/check-release.mjs --self-test
node scripts/check-release.mjs
```

以上命令从仓库根目录运行，只检查版本契约。完整验证由 `ci.yml` 执行，不代表实际 npm、GHCR 或 GitHub Release 已发布成功。
