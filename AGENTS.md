# Ecoku Agent 工作约定

## 事实来源

- 实现以当前源码为准；产品/安全/隐私以 `docs/internal/constraints.md` 为准；面向操作者的部署与接入以
  VitePress 源文为准（默认简体中文：`docs/guide/`、`docs/self-hosting/`、`docs/integration/`、`docs/reference/`）。
  `docs/progress/` 只是历史验收，不约束当前实现，也不进入文档站点。
- 评论区基线 `designs/plain-thread-comments/index-v17.html`；管理端登录、评论管理、站点管理、
  通知设置与安全以 `designs/admin-moderation/index-v15.html` 为准（评论区 v17 纸墨 token、系统 CJK/英文字体栈），
  服务端通知模板以 `designs/admin-moderation/email-notification-v6.html`、`telegram-notification-v6.html` 为准（`notifications-v6.js` 为参考渲染）。生产管理端不得展示通知判定预览或通知模板预览。
- 边界不清时先查源码和上述文档，再集中向用户确认。不要把原型 mock、测试文案或设计标注带进生产。
- 文档站点在 `docs/`（VitePress，pnpm workspace 包 `ecoku-docs`）。本地预览 `pnpm docs:dev`。
  本地开发见 `docs/contribute/local-dev.md`，文档站点自身的发布见 `docs/contribute/docs-deploy.md`。
  `docs/internal/`、`docs/progress/`、`docs/contribute/` 不进入站点。
- 改运行时、部署契约、接入 markup、配置键、环境变量或用户可见行为后，按改动同步文档，不要留到发版才补：
  产品/隐私边界写 `docs/internal/constraints.md`；部署、Compose、备份、升级、通知与人机验证写
  `docs/self-hosting/`（发版时在 `docs/self-hosting/upgrades/` 增加该 tag 页面）；配置键与环境变量写
  `docs/reference/configuration.md`，CLI 子命令写 `docs/reference/cli.md`，HTTP 接口写 `docs/reference/api.md`；
  以上均同步 `docs/en/`、`docs/zh-hant/`、`docs/ja/` 对应路径与 `deploy/` 模板；公开接入片段写根 `README.md`、
  `examples/` 与 `docs/integration/`；未发版行为只追加 `CHANGELOG.md` 的 `[Unreleased]`，不得改写已发布章节。
  本文件只保留约定。面向读者的文档用操作说明，不要把本文件的约束口吻或提示词写进站点文案。

## 文档写作

- 简体中文（`docs/` 根下各目录）是源文；繁中、英文、日文从简中翻译，文件集合、标题顺序、表格与代码块保持一致。
  新增或删除页面时，同步四套 locale，并在 `docs/.vitepress/config/shared.ts` 的 sidebar 与四个 locale 配置的 `copy` 中登记。
- 被链接的标题必须带显式 ASCII 锚点（如 `## 配置 trusted_proxies {#trusted-proxies}`），链接只指向这些锚点；
  翻译时保留 `{#id}` 与链接目标不变，不要依赖中文标题自动生成的 slug。
- 管理端与评论区界面只有简体中文。所有 locale 引用界面文案、服务端报错或 CLI 输出时保留原文（英、日文附释义），
  不要把译名写成界面上并不存在的标签。
- 写之前先核对源码：默认值、上限、状态码、字段名、报错文案以代码为准，不从旧文档或原型照搬。
  不确定的行为不写，或写明“取决于…”；不要为显得完整补写未经证实的细节。
- 文风：先说读者要做什么、会看到什么，再讲原理；不用营销形容词、emoji 和“强大、极致、无缝、完美”之类空话；
  同一件事只在一处详写，其他页面链接过去。本地若有 `.agents/skills/chinese-writing/`（已 gitignore），改写中文文档时按它执行。
- 升级说明页统一结构：发布日期 / schema / 镜像 → 变更 → 兼容性 → 升级 → 回滚；通用步骤链接 `upgrade#steps`，
  不在每页重复整段脚本。发版时同时更新 `upgrade.md` 的版本列表，并把 `shared.ts` 中的“最新”标记移到新版本。

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
  也不驱动 client/admin 的 package 版本。
- 发版提交必须同步四项：`VERSION`、根 `package.json` 的 `version`、`compose.yaml` 的
  `image`（`git.via.moe/dejavu/ecoku:v` + `VERSION`，禁止占位符或浮动 tag）、`CHANGELOG.md`
  对应章节与页脚链接。若该 tag 影响部署，同时在 `docs/self-hosting/upgrades/` 增加对应页面（四套 locale）。
- Git tag 必须为 `v` + `VERSION`。Woodpecker 只在 `v*` tag 上构建镜像，并用 `CI_COMMIT_TAG`
  作为镜像 tag。tag 流水线会校验 tag 与 `VERSION`、`compose.yaml` 一致。改 `VERSION` 不会出镜像。
  镜像 CI 不部署应用生产、不碰生产库。文档站点仅由 `master` push 的 Woodpecker 流程自动构建并原子发布，
  固定调度到 `role=netcup-nano`、`server=netcup-nano` 的 agent；发布 step 通过 trusted volume
  仅挂载 `/var/www/ecoku.zsh.moe:/deploy`；站点目录内的 `html` 软链接原子切换到 `releases/<发布标识>`，
  `.deploy.lock` 位于站点目录内，成功后仅保留当前版与刚被替换的上一版，清理更早发布目录。Web 服务根目录为 `/var/www/ecoku.zsh.moe/html`。
- 文档与 Compose 模板中的 Docker 镜像统一使用实际注册地址与精确发布版本号（`git.via.moe/dejavu/ecoku:v` + `VERSION`，禁止占位镜像或浮动 tag，当前为 `v0.2.8`）；真实域名、密码、token、SMTP、Telegram、数据库和日志等敏感信息仍使用占位符，不得进 Git。
- 提交、推送、tag、镜像发布、生产部署和真实数据库操作需要当前任务的明确授权。
- 新 tag 若可能影响平滑升级（schema、Compose 挂载、配置键、日志出口、镜像契约），回复中先写：
  停服冷备份 → 改精确镜像 tag → `sudo docker compose pull && sudo docker compose up -d` →
  健康检查与回滚。未经授权不在生产执行。

## UI

用户可见界面：先改已批准原型 → 用户明确批准 → 再改生产代码。不要自行提升未批准的原型版本。

## 验证

Woodpecker 在 `master` push 与目标为 `master` 的 pull request 上运行
`pnpm verify:client`、`pnpm verify:admin`、`pnpm docs:build`、`go test -count=1 ./...`、`go vet ./...` 和 server 构建；
`v*` tag 不重复测试，只做 tag / `VERSION` / `compose.yaml` 一致性校验后直接并行构建 amd64/arm64
镜像并发布 manifest。文档发布流程在 `master` push 时独立运行，不依赖完整测试流程。这些不要在本地重复跑，交给 CI。

本地只做 CI 覆盖不到的：

| 改动 | 本地 |
| --- | --- |
| 已批准原型 | 对应 `designs/**/*.test.mjs` |
| 发版四项 | 核对 `VERSION`、根 `package.json`、`compose.yaml` image、`CHANGELOG` 一致 |
| 改迁移 | 补 fixture（写测试，不是本地跑 `go test`） |
| 文档发布脚本 | shell 语法检查与隔离临时目录发布验证，不触碰 `/var/www` |

浏览器、生产主机和真实数据库不是默认门禁。文档、示例和本文件的纯约定修改不强制本地测试。
回复写明交由 CI 的项、本地已跑项和未跑项。
