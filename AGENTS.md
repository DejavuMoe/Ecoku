# Ecoku Agent 工作约定

## 事实来源

- 实现以当前源码为准；产品/安全/隐私以 `docs/internal/constraints.md` 为准；面向操作者的部署与接入以
  VitePress 源文为准（默认简体中文：`docs/guide/`、`docs/self-hosting/`、`docs/integration/`、`docs/reference/`）。
  `docs/progress/` 只是历史验收，不约束当前实现，也不进入文档站点。
- 评论区基线 `designs/plain-thread-comments/index-v17.html`；管理端登录、评论管理、站点管理、
  通知设置与安全以 `designs/admin-moderation/index-v16.html` 为准（评论区 v17 纸墨 token、系统 CJK/英文字体栈），
  服务端通知模板以 `designs/admin-moderation/email-notification-v7.html`、`telegram-notification-v6.html` 为准（`notifications-v7.js`、`notifications-v6.js` 为参考渲染）。生产管理端不得展示通知判定预览或通知模板预览。
- 边界不清时先查源码和上述文档，再集中向用户确认。不要把原型 mock、测试文案或设计标注带进生产。
- 文档站点在 `docs/`（VitePress，pnpm workspace 包 `ecoku-docs`）。本地预览 `pnpm docs:dev`。
  本地开发见 `docs/contribute/local-dev.md`，文档站点自身的发布见 `docs/contribute/docs-deploy.md`。
  `docs/internal/`、`docs/progress/`、`docs/contribute/` 不进入站点。
- 改运行时、部署契约、接入 markup、配置键、环境变量或用户可见行为后，按改动同步文档，不要留到发版才补：
  产品/隐私边界写 `docs/internal/constraints.md`；部署、Compose、备份、升级、通知与人机验证写
  `docs/self-hosting/`（发版时在 `docs/self-hosting/upgrades/` 增加该 tag 页面）；配置键与环境变量写
  `docs/reference/configuration.md`，CLI 子命令写 `docs/reference/cli.md`，HTTP 接口写 `docs/reference/api.md`；
  以上均同步 `docs/en/`、`docs/zh-hant/` 对应路径与 `deploy/` 模板；公开接入片段写根 `README.md`、
  `examples/` 与 `docs/integration/`；未发版行为只追加 `CHANGELOG.md` 的 `[Unreleased]`，不得改写已发布章节。
  本文件只保留约定。面向读者的文档用操作说明，不要把本文件的约束口吻或提示词写进站点文案。

## 文档写作

- 链接、粗体、斜体、删除线及行内代码与相邻正文之间留一个半角空格；行首、行尾和标记内部不额外加空格。
  VitePress 在 Markdown 解析后统一补齐显示空格；不得用全文正则替换破坏代码块、URL、转义或嵌套标记。
- 简体、繁体中文正文中，中英文及数字之间留半角空格，中文双引号使用「」。代码、URL、原始输出不套正文替换。
- `app/config.yaml` 的字段、默认值、可选值、用途与示例集中维护在 `deploy/config.yaml.example` 及对应语言模板中，
  部署页和配置参考直接引用模板，不再分别维护字段表。当前仍生效的参数按默认值、可选值、示例和用途说明；可选覆盖项保持注释，不再标注「旧版兼容」。忽略或废弃的配置项不列为可配置字段。
- 简体中文（`docs/` 根下各目录）是源文；繁中、英文从简中翻译，文件集合、标题顺序、表格与代码块保持一致。
  新增或删除页面时，同步三套 locale，并在 `docs/.vitepress/config/shared.ts` 的 sidebar 与三个 locale 配置的 `copy` 中登记。
- 被链接的标题必须带显式 ASCII 锚点（如 `## 配置 trusted_proxies {#trusted-proxies}`），链接只指向这些锚点；
  翻译时保留 `{#id}` 与链接目标不变，不要依赖中文标题自动生成的 slug。
- 管理端与评论区界面支持简体中文、繁体中文和英语；默认使用简体中文。所有 locale 引用服务端报错或 CLI 输出时保留原文，
  不要把译名写成界面上并不存在的标签。
- 写之前先核对源码：默认值、上限、状态码、字段名、报错文案以代码为准，不从旧文档或原型照搬。
  不确定的行为不写，或写明“取决于…”；不要为显得完整补写未经证实的细节。
- 文风：先说读者要做什么、会看到什么，再讲原理；不用营销形容词、emoji 和“强大、极致、无缝、完美”之类空话；
  同一件事只在一处详写，其他页面链接过去。本地若有 `.agents/skills/chinese-writing/`（已 gitignore），改写中文文档时按它执行。
- 升级说明页统一结构：发布日期 / schema / 镜像 → 变更 → 兼容性 → 升级 → 回滚；通用步骤链接 `upgrade#steps`，
  不在每页重复整段脚本。发版时同时更新 `upgrade.md` 的版本列表，并把 `shared.ts` 中的“最新”标记移到新版本。
- 公开部署从 v0.3.0 开始。v0.2.9 及更早升级页仅归档 tag、变更及升级事项，并标注「内测版本，请勿使用」，不提供旧镜像安装／降级步骤；历史归档集中折叠展示。本次归档整理可改历史升级页，不修改已发布 CHANGELOG 和迁移源码。

## 产品边界

- SQLite3-only、多站点、自托管、纯文本评论；提交后直接发布。不要重新引入普通用户、审核队列、
  Count、MySQL、客户端 IP 服务或浏览器 management key。
- 公共 DTO 不得包含邮箱、管理字段、IP、UA、地区、密钥或完整数据库模型。
- 访客身份仅昵称、私有邮箱和可选网站。SDK 可在 IndexedDB 中加密保存 7 天；不得写入
  localStorage、cookie 或 URL，也不提供多余的主动清除界面。
- 回复必须在被回复评论处完成；缺少身份时在该回复框内采集，不能跳回根评论表单后误发为根评论。
- 博主徽章与通知去重读取已存储的 `comments.is_blogger`；昵称与邮箱匹配仅用于已发布历史迁移及首次导入回填；该判定不在管理端展示说明表。
- SQLite 迁移原位、顺序、事务化。成功只增加 schema 版本记录，不自动删除数据库、评论、配置、
  WAL 或备份，也无向下迁移。已发布的迁移文件与 `schema_migrations` 记录不得改写或删除。

## 仓库与发布

- 运行时：`server/`、`packages/client/`、`packages/admin/`。`designs/`、`examples/`、
  `docs/progress/`、`docs/internal/` 不进镜像。
- 根 `VERSION` 是容器版本的唯一文本来源（一行、无 `v`）。它不进入 Go / `pnpm` 日常构建，
  SDK 的 `packages/client/package.json` 版本须与它一致，admin 的 package 版本保持独立。
- 发版提交必须同步五项：`VERSION`、根 `package.json` 与 `packages/client/package.json` 的 `version`、`compose.yaml` 的
  `image`（`ghcr.io/dejavumoe/ecoku:v` + `VERSION`，禁止占位符或浮动 tag）、`CHANGELOG.md`
  对应章节与页脚链接。同步 `packages/client/README.md` 中的安装版本与包内 `CHANGELOG.md`，由发布脚本校验；npm 包首页使用随包发布的 README。若该 tag 影响部署，同时在 `docs/self-hosting/upgrades/` 增加对应页面（三套 locale）。
- Git tag 必须为 `v` + `VERSION`。GitHub Actions 只在 `v*` tag 上自动发布镜像与 npm SDK，
  发布前校验 tag 与 `VERSION`、包版本、`compose.yaml` 一致。改 `VERSION` 不会出镜像。
  镜像 CI 不部署应用生产、不碰生产库。文档站点仅由 `master` push 的 Woodpecker 流程自动构建并原子发布，
  固定调度到 `role=netcup-nano`、`server=netcup-nano` 的 agent；发布 step 通过 trusted volume
  仅挂载 `/var/www/ecoku.zsh.moe:/deploy`；站点目录内的 `html` 软链接原子切换到 `releases/<发布标识>`，
  `.deploy.lock` 位于站点目录内，成功后仅保留当前版与刚被替换的上一版，清理更早发布目录。Web 服务根目录为 `/var/www/ecoku.zsh.moe/html`。
- GitHub Actions 的 `.github/workflows/ci.yml` 验证 `master` push / PR；`release.yml` 在 `v*` tag 上先校验版本并复用 CI
  验证该 tag，再发布 GHCR 双架构镜像与同版本 npm SDK，最后创建 GitHub Release。文档仅保存构建产物，不部署。
  Woodpecker 仅启用 `docs-deploy.yml`；其余 YAML 保留原步骤与已注释触发条件，用 `when: [{ evaluate: 'false' }]` 禁用，不能只删除 `when`。
  不再向 Forgejo 发布新镜像。发布设置见 `packages/client/PUBLISH.md`。
- 当前文档与 Compose 模板中的 Docker 镜像统一使用 GHCR 与精确发布版本号（`ghcr.io/dejavumoe/ecoku:v` + `VERSION`，禁止占位镜像或浮动 tag，当前为 `v0.4.1`）；内测归档不再展示镜像下载地址。真实域名、密码、token、SMTP、Telegram、数据库和日志等敏感信息仍使用占位符，不得进 Git。
- 应用界面支持 `zh-CN`、`zh-Hant`、`en`。后台语言由 `ECOKU_ADMIN_LOCALE` 决定；站点前台语言由站点 `i18n` 默认值决定，SDK 的 `i18n` 参数优先覆盖。缺省均为简体中文。
- 提交、推送、tag、镜像发布、生产部署和真实数据库操作需要当前任务的明确授权。
- 新 tag 若可能影响平滑升级（schema、Compose 挂载、配置键、日志出口、镜像契约），回复中先写：
  停服冷备份 → 改精确镜像 tag → `sudo docker compose pull && sudo docker compose up -d` →
  健康检查与回滚。未经授权不在生产执行。

### Release flow

Run these steps in order. Stop and report at any failure. Never move, recreate or force-push a published tag.

1. **Master first.** Commit the release prep: the five synced items, the SDK README and package changelog, the three-locale upgrade page, `upgrade.md`, and the latest marker in `shared.ts`. The docs demo stays on the previous published SDK, because the new npm version does not exist yet. Run `node scripts/check-release.mjs v<VERSION>`, push `master`, and wait for its CI to pass.
2. **Then the tag.** Once master CI is green and the user approves the release, create the annotated tag `v<VERSION>` (message `Ecoku v<VERSION>`) on that commit. Push it and wait for the Release workflow to pass: check, verify, npm, both images, manifest and release.
3. **Then the SDK pins.** Confirm npm `latest`, the GHCR amd64/arm64 manifest and the GitHub Release. In one commit, move the VitePress docs site to the published SDK: `docs/package.json`, `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`, the lockfile integrity taken from `npm view`, the demo and install lines in the three-locale `sdk.md`, and a `CHANGELOG.md` `[Unreleased]` entry. Check it with `pnpm install --frozen-lockfile --lockfile-only`, push `master`, and wait for CI.
4. **Remind the user.** Tell the user to move each deployed instance to the new exact image tag, including the server behind the docs demo. Do not change any deployed instance yourself.

## UI

- 评论区、管理后台等应用界面：先改已批准原型 → 用户明确批准 → 再改生产代码。不要自行提升未批准的原型版本。
- **项目文档不适用 `prototype-first-ui`**。范围包括 README、`docs/` 文档内容，以及 VitePress 文档站的主题、配色、字体、样式、布局、导航和文档组件。
  直接修改对应源码，通过 `pnpm docs:dev` 提供实际文档站的本地预览，再根据用户意见调整；不要求先制作 HTML 原型、登记原型审批或等待原型批准。
  现有文档原型不构成实施门禁。本条优先于技能中的原型流程；源码核对、多语言同步和发布授权等其他约定仍然适用。

## 验证

GitHub Actions 在 `master` push 与目标为 `master` 的 pull request 上运行
`pnpm verify:client`、`pnpm verify:admin`、`pnpm docs:build`、`go test -count=1 ./...`、`go vet ./...` 和 server 构建；
`v*` tag 校验版本一致性并复用相同验证命令，随后并行构建 amd64/arm64 镜像、发布 npm SDK，最后创建 GitHub Release。
Woodpecker 只在 `master` push 时独立构建并发布文档，不依赖 GitHub 完整测试流程。这些不要在本地重复跑，交给 CI。
修改工作流后本地检查语法、触发条件与发布校验脚本，完整构建交给 CI。

本地只做 CI 覆盖不到的：

| 改动 | 本地 |
| --- | --- |
| 已批准原型 | 对应 `designs/**/*.test.mjs` |
| 发版五项 | 核对 `VERSION`、根与 client `package.json`、`compose.yaml` image、`CHANGELOG` 一致 |
| 改迁移 | 补 fixture（写测试，不是本地跑 `go test`） |
| 文档发布脚本 | shell 语法检查与隔离临时目录发布验证，不触碰 `/var/www` |

浏览器、生产主机和真实数据库不是默认门禁。文档、示例和本文件的纯约定修改不强制本地测试。
回复写明交由 CI 的项、本地已跑项和未跑项。
