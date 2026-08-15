# Ecoku Agent 工作约定

## 事实来源

- 实现以当前源码为准；产品/安全/隐私以 `docs/product/constraints.md` 为准；部署以
  `docs/operations/self-hosting.md` 为准。`docs/progress/` 只是历史验收，不约束当前实现。
- 评论区基线 `designs/plain-thread-comments/index-v10.html`；管理端基线
  `designs/admin-moderation/index-v7.html`。生产管理端不得展示通知判定预览或通知模板预览。
- 边界不清时先查源码和上述文档，再集中向用户确认。不要把原型 mock、测试文案或设计标注带进生产。

## 产品边界

- SQLite3-only、多站点、自托管、纯文本评论；提交后直接发布。不要重新引入普通用户、审核队列、
  Count、MySQL、客户端 IP 服务或浏览器 management key。
- 公共 DTO 不得包含邮箱、管理字段、IP、UA、地区、密钥或完整数据库模型。
- 访客身份仅昵称、私有邮箱和可选网站。SDK 可在 IndexedDB 中加密保存 7 天；不得写入
  localStorage、cookie 或 URL，也不提供多余的主动清除界面。
- 回复必须在被回复评论处完成；缺少身份时在该回复框内采集，不能跳回根评论表单后误发为根评论。
- 博主身份由昵称与邮箱共同精确匹配，用于通知去重；该判定不在管理端展示说明表。
- SQLite 迁移原位、顺序、事务化。成功只增加 schema 版本记录，不自动删除数据库、评论、配置、
  WAL 或备份，也无向下迁移。已发布的迁移文件与 `schema_migrations` 记录不得改写或删除。

## 仓库与发布

- 运行时：`server/`、`packages/client/`、`packages/admin/`。`designs/`、`examples/`、
  `docs/progress/` 不进镜像。
- 根 `VERSION` 是容器版本的唯一文本来源（一行、无 `v`）。它不进入 Go / `pnpm` 日常构建，
  也不驱动 client/admin 的 package 版本。
- 发版提交必须同步四项：`VERSION`、根 `package.json` 的 `version`、`compose.yaml` 的
  `image`（`git.via.moe/dejavu/ecoku:v` + `VERSION`，禁止占位符或浮动 tag）、`CHANGELOG.md`
  对应章节与页脚链接。
- Git tag 必须为 `v` + `VERSION`。Woodpecker 只在 `v*` tag 上构建镜像，并用 `CI_COMMIT_TAG`
  作为镜像 tag。tag 流水线会校验 tag 与 `VERSION`、`compose.yaml` 一致。改 `VERSION` 不会出镜像。
  CI 不部署生产、不碰生产库。
- 文档和示例只用占位符。真实域名、密码、token、SMTP、Telegram、数据库和日志不得进 Git。
- 提交、推送、tag、镜像发布、生产部署和真实数据库操作需要当前任务的明确授权。
- 新 tag 若可能影响平滑升级（schema、Compose 挂载、配置键、日志出口、镜像契约），回复中先写：
  停服冷备份 → 改精确镜像 tag → `sudo docker compose pull && sudo docker compose up -d` →
  健康检查与回滚。未经授权不在生产执行。

## UI

用户可见界面：先改已批准原型 → 用户明确批准 → 再改生产代码。不要自行提升未批准的原型版本。

## 验证

按改动范围验证，未改动的包不必本地跑。回复中写明已跑项和未跑项。浏览器、生产主机和真实数据库
不是默认门禁。全量矩阵由 tag 流水线执行，不要为“每次都测”阻塞。

必须本地跑：

| 改动 | 必须 |
| --- | --- |
| `server/` 行为或 schema | 受影响包 `go test -count=1`；改迁移时加 fixture。发版且改了 server 时：`go test -count=1 ./...` 与 `go vet ./...` |
| `packages/client` | `pnpm --dir packages/client test` 与 `type-check`；改构建或接入契约时再 `build` |
| `packages/admin` | `pnpm --dir packages/admin test` 与 `type-check`；改构建时再 `build` |
| 已批准原型 | 对应 `designs/**/*.test.mjs` |
| 发版四项 | 核对 `VERSION`、根 `package.json`、`compose.yaml` image、`CHANGELOG` 一致 |

文档、示例和本文件的纯约定修改不强制本地测试。
