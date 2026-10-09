# SDK 与 GitHub 发布

`.github/workflows/release.yml` 在 GitHub 收到 `v*` tag 后发布 GHCR 镜像、npm 包和 GitHub Release。v0.3.0 是首次 npm 发布版本；实际可下载状态以发布任务结果为准。不要重建或移动已发布 tag。

## 发布顺序

1. 校验 tag、`VERSION`、根与 `packages/client/package.json` 的版本、Compose 镜像和根 `CHANGELOG.md` 的发布章节。
2. 复用 `ci.yml`，验证该 tag 的 SDK、管理端、Go 服务和文档。SDK 完成 ESM、CommonJS、UMD、类型声明检查后打成 tarball。
3. 并行执行 npm 发布和镜像构建。npm 发布同一次运行保存的 tarball，不在有写权限的发布 job 中重新安装依赖或构建。amd64 / arm64 镜像在原生 runner 构建并按 digest 推送；分别拉取同一 digest 完成运行时检查、SBOM 与漏洞扫描后，才导出 digest 并汇总为精确版本 tag。
4. npm 与镜像均成功后，使用根更新日志对应章节创建 GitHub Release，附带 `ecoku-<版本>.tgz` 和 `SHA256SUMS`。

普通 `master` / PR CI 只验证 SDK、检查包内容并生成 tarball，不运行 `npm publish --dry-run`。npm 的发布预演也会查询 registry，并拒绝已发布的同版本；它不适合作为主线构建检查。实际发布仅在 tag 流程或显式触发的恢复流程中执行。

发布 `v0.3.8` 时，SDK 版本为 `0.3.8`，镜像为 `ghcr.io/dejavumoe/ecoku:v0.3.8`。正式 npm 版本使用 `latest`，含预发布后缀的 tag 使用 `next` 并创建 GitHub prerelease；镜像只发布精确版本，不创建 `latest`。

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

## 基础镜像更新与发布门禁

更新 `Dockerfile` 中 Node、Go 或 Alpine 基础镜像时，同时更新精确版本 tag 与多架构 index 的 `sha256` digest，并核对该 index 包含 `linux/amd64`、`linux/arm64`；不要用单一架构的 manifest digest 替代。Dockerfile frontend 也保持 digest 固定。基础镜像固定不等于最终镜像已经通过检查，每次升级仍须通过发布流程中的双架构门禁。

每个架构针对已拉取的最终镜像 digest 运行 `scripts/verify-image.sh`，检查非 root 用户、只读根文件系统、临时数据目录、静态资源、健康检查和 SIGTERM 退出，再运行 `scripts/scan-image.sh`。扫描固定使用 Trivy `0.75.0`，下载对应架构的工具包并在解压执行前校验 SHA-256；升级扫描器时同时更新版本、两个架构的校验和及 `scripts/check-ci.mjs` 中的契约校验。

扫描输出 CycloneDX SBOM 与 JSON 漏洞报告，对 `HIGH,CRITICAL` 使用 `--exit-code 1 --ignorefile /dev/null`。运行时检查失败、下载或校验失败、扫描不可用、命中上述漏洞级别，均阻止该架构导出 digest，进而阻止多架构 tag 与 GitHub Release。失败时仍尝试保存已经生成的 `image-checks-amd64` / `image-checks-arm64` 产物，含镜像 digest、架构和扫描器版本；提前失败可能没有完整报告。npm 发布独立并行，镜像门禁失败不会撤回已发布的 npm 包。

漏洞库下载到本次任务的临时缓存后，使用 [Trivy 版本命令](https://trivy.dev/docs/latest/references/configuration/cli/trivy_version/) 输出 `scanner-version.json`，记录扫描器和漏洞库的版本、更新时间；后续扫描使用同一缓存并跳过再次更新，便于复核扫描依据。漏洞库下载失败同样阻止通过。

## 缓存与失败恢复

- SDK、管理端、文档和 Go 并行验证。pnpm store 由锁文件确定缓存；Go 缓存依据 `server/go.sum`，包含模块与构建缓存。
- Node、pnpm 与 `mise.toml` 的精确版本一致；Go 读取 `server/go.mod`。外部 Actions 固定完整提交 SHA，更新时同时检查运行时要求和跨版本行为。
- 依赖安装使用 `--frozen-lockfile --prefer-offline`，优先复用缓存；Docker 显式指定与缓存挂载一致的 pnpm store 路径。GitHub 文档产物使用较低压缩级别，SDK tarball 不重复压缩。
- Go 测试、vet 和构建统一使用 `CGO_ENABLED=0`，与生产镜像一致。两个架构仍原生并行构建；manifest 合并只使用 Buildx CLI，不启动额外的 BuildKit 容器。
- Docker 使用 GHCR 的 `buildcache-amd64` / `buildcache-arm64`，保存中间构建层，可跨 tag 复用；两个架构不会互相覆盖缓存。
- 验证中的旧分支任务可取消；发布串行且不会主动取消正在发布的任务。不要一次推送多个待发布 tag，等待上一版完成后再推下一版。
- SDK、文档与 digest 的 Actions artifacts 保留 7 天，镜像 SBOM 与扫描结果保留 30 天。超过保留期不能依赖旧产物重跑下游 job，应检查已发布状态后重新安排发布。
- npm 版本不可覆盖。GitHub Release 使用创建操作，已存在时不会覆盖正文或附件。仅失败 job 重跑是首选恢复方式；发布成功的 tag 不移动、不重用。

若 tag 中的发布命令本身有误，重跑旧 job 不会读取主线修复。可从 `master` 手动运行 `recover-npm.yml`，填写原 tag 和原 Release run ID；工作流先解析 tag 指向的不可变提交，并核对原 Release run 的仓库、工作流、触发方式、tag、提交以及全部验证和镜像 manifest 的成功状态，再检出该提交执行版本检查。它只发布原流水线保存的 SDK 包，不重建产物、不移动 tag、不覆盖镜像。使用 OIDC 时须单独授权该工作流；首次发布可使用现有临时 `NPM_TOKEN`。恢复 npm 后，再使用原 tag 的更新日志和 SDK 产物创建 GitHub Release。

## 与 Woodpecker 的分工

Woodpecker 仅启用 `docs-deploy.yml`，负责现有文档站点的构建与部署。其余五个 YAML 保留原步骤，原触发条件以注释保存，并通过 `when: [{ evaluate: 'false' }]` 显式禁用；不能只注释掉 `when`，否则会失去运行限制。

完整验证、GHCR 镜像、npm SDK 和 GitHub Release 均由 GitHub Actions 负责。GitHub 只构建、检查并保存文档产物，不连接文档服务器或应用生产环境。源码仍推送到 Forgejo，再由推送镜像同步到 GitHub；不再向 Forgejo registry 发布新版本。Compose 使用 GHCR 的精确镜像版本，已发布的旧 Forgejo 镜像不删除。

## 本地检查

```bash
node scripts/check-ci.mjs
node scripts/check-release.mjs --self-test
node scripts/check-release.mjs
```

以上命令从仓库根目录运行，检查 CI 的打包／发布边界、Actions 固定方式、工具链版本及发布版本契约。完整验证由 `ci.yml` 执行，不代表实际 npm、GHCR 或 GitHub Release 已发布成功。
