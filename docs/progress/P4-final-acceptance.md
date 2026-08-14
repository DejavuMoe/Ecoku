# Ecoku P4 最终验收：生产管理端、站点配置与通知

> 日期：2026-08-13
>
> 结论：**通过验收**。获批后台原型已进入生产代码；运行时站点管理、三态审核、批量操作、
> SMTP/Telegram 通知配置、SQLite outbox、通知模板和持久开发部署均已实现并通过自动化、
> 真实 API、桌面/窄屏浏览器与远端容器门禁。
>
> 本结论记录当时源码和远程持久开发实例的验收，不等于正式发布、生产 SLA、npm 发布、镜像推送
> 或真实第三方通知投递验收。
>
> 退役说明：本文涉及的旧远程测试实例现已退出项目测试范围；其访问地址、凭据指引和专用部署资产
> 已从仓库移除。本文只能作为历史验收证据，不能作为当前运维说明。

## 1. 最终批准边界

- 评论区继续使用已批准的 `designs/plain-thread-comments/index-v4.html`；本次没有重写评论 UI。
- 管理端使用现已归档为 `designs/archive/admin-layout/admin-layout-v2.html` 的原型和对应通知模板作为当时生产结构与视觉基线。
- 管理端主导航为“评论审核 / 站点管理 / 通知设置”；站点选择器显示规范站点域名，
  不再显示“先审后发”等解释文案，也不显示会话倒计时。
- 审核运行状态只有 `pending`、`approved` 和墓碑 `deleted`；不存在持久化 `rejected` 状态。
- 拒绝 pending 评论即永久删除该评论及全部仍未公开的后代；如果子树含 approved、墓碑、
  跨站点/跨页面关系或循环，整个拒绝操作失败，不能误删公开内容。
- approved 评论可以变成隐私墓碑；无后代墓碑可以由实例管理员彻底删除。
- 管理端支持单条操作和当前页批量批准/拒绝，批量请求逐项返回结果并保留失败项。
- 实例管理员可以创建、编辑站点与评论表单配置；站点 ID 创建后不可修改。
- SMTP 与 Telegram 是实例级通知渠道，不随站点选择器变化。访客直接回复通知仅使用 SMTP。
- 密码和 Bot Token 只接受写入或更换；读取只返回 `password_set` / `token_set`，从不明文回显。
- 用户当时授权使用远程测试主机、Caddy 自动 TLS 和持久 SQLite 卷；这些授权不延续到新的测试或
  部署环境。

## 2. 实际实现

### 2.1 评论审核与删除语义

- SQLite migration v3 `remove_rejected_state` 将运行模型收敛为 pending/approved；历史 rejected
  和未公开墓碑按受保护子树规则清理，不会转成可公开内容。
- 单条拒绝使用 `POST /api/admin/sites/:siteId/comments/:commentId/reject`。
- 批量拒绝使用 `POST /api/admin/sites/:siteId/comments/batch/reject`，1～100 个不重复正整数 ID。
- 批量批准继续使用 `PATCH /api/admin/sites/:siteId/comments/batch`，并逐项校验祖先链、站点和页面。
- approved 墓碑使用 `DELETE /api/admin/sites/:siteId/comments/:commentId`；保留线程关系并清除昵称、
  私有邮箱、网站和正文。
- 彻底删除使用 `DELETE /api/admin/sites/:siteId/comments/:commentId/permanent`；仅实例管理员 Bearer
  可调用，且只允许无后代墓碑。
- 公共接口仍只返回 approved 评论和获准公开的 approved 墓碑，不返回邮箱、管理状态或管理字段。

### 2.2 运行时站点注册表

- SQLite `sites` / `site_origins` 是运行时事实来源；YAML 站点只在首次 migration v2 时导入一次。
- 管理 API 支持列出、读取、创建和带 revision 更新站点；冲突更新返回 409。
- 可配置站点 URL、精确允许来源、pending/auto、邮箱是否必填、网站是否必填和最多 80 字的
  评论占位文案。昵称和正文始终必填。
- 公共评论响应通过安全 `formConfig` 投影表单规则；不公开内部 revision、管理密钥环境变量名或凭据。
- CORS 每次从 SQLite 读取当前公开来源，站点修改后无需重启即可生效；管理 API 使用独立精确来源。
- CORS 检查只作用于 `/api/**`。管理端同源模块和 CSS 即使带 `Origin` 也不会被站点白名单误拒绝；
  API 来源边界仍保持允许 204、拒绝 403。

### 2.3 通知与数据保护

- SQLite migration v4 `notifications` 创建两个渠道设置和持久 `notification_outbox`。
- SMTP 支持 SSL/TLS、STARTTLS 和不加密；Telegram 通过 Bot API 投递。
- 新评论通知支持“仅新评论待审核时 / 所有新评论”；approved 直接回复会为父评论邮箱生成访客回复事件。
- 评论写入和 outbox 入队在同一 SQLite 事务中完成；`(event_type, comment_id)` 唯一约束防止重复事件。
- 单进程 worker 恢复超时锁、每次认领一条事件、最多尝试 8 次并使用有界退避。
- SMTP 密码和 Bot Token 使用环境主密钥执行 AES-256-GCM 加密；主密钥不进入 SQLite、仓库、
  日志、命令行或浏览器。
- `config_json` 不保存密码或 Token；outbox 不保存邮箱、收件人、正文或第三方响应正文，
  失败只保存有限错误码。
- 设置 API 使用 revision 进行乐观并发控制；测试投递有独立限流并返回真实 400/429/502。
- 三份内置模板采用固定 allowlist 路由；模板响应的 CSP 禁止网络连接、frame 和 object，
  未知模板返回 404。

### 2.4 生产管理端

- Vue/Pinia 管理端只使用真实 API；Bearer token 只在当前页面内存，刷新、关闭、退出、401 或到期即清除。
- 1600px 桌面使用 1440px 对齐主体、520px 队列和完整详情/元信息区；小于 1024px 时队列全宽，
  详情为带返回按钮的全屏覆盖层。
- 队列包含紧凑状态 tab、排序、三行列表、吸底分页、批量选择和空状态；没有选中蓝色竖条。
- 长作者、正文、邮箱、URL 和页面路径分别使用两行截断、单行省略或整行 `word-break`，不挤成竖列。
- 危险按钮为可读红色描边，hover 变为深红实心与浅色文字；确认弹窗采用相同规则。
- 通知页复现关闭降透明度、空端口 + `465` 占位、chip 批量粘贴/删除/错误态和密钥更换占位。
  已保存为关闭的渠道只有开关可点；从已启用切换为关闭时保留一次保存机会。
- 登录、审核、站点、通知、模板和弹窗均没有远程字体、头像、遥测或第三方脚本。

## 3. 管理 API 契约

所有接口继续使用统一 JSON 外层结构和真实 HTTP 状态。

| 能力 | 方法与路径 | 认证 |
| --- | --- | --- |
| 管理员登录 | `POST /api/admin/login` | 登录限流，成功返回短期 Bearer |
| 站点列表/创建 | `GET/POST /api/admin/sites` | 实例管理员 Bearer |
| 站点读取/更新 | `GET/PUT /api/admin/sites/:siteId` | 实例管理员 Bearer |
| 通知设置 | `GET /api/admin/notifications` | 实例管理员 Bearer |
| 保存 SMTP | `PUT /api/admin/notifications/email` | 实例管理员 Bearer |
| 测试 SMTP | `POST /api/admin/notifications/email/test` | 实例管理员 Bearer + 独立限流 |
| 保存 Telegram | `PUT /api/admin/notifications/telegram` | 实例管理员 Bearer |
| 测试 Telegram | `POST /api/admin/notifications/telegram/test` | 实例管理员 Bearer + 独立限流 |
| 评论列表/详情 | `GET .../comments`、`GET .../comments/:id` | Bearer 或本站 `EcokuSite` |
| 批量批准 | `PATCH .../comments/batch` | Bearer 或本站 `EcokuSite` |
| 单条/批量拒绝 | `POST .../comments/:id/reject`、`POST .../comments/batch/reject` | Bearer 或本站 `EcokuSite` |
| 墓碑删除 | `DELETE .../comments/:id` | Bearer 或本站 `EcokuSite` |
| 彻底删除 | `DELETE .../comments/:id/permanent` | 仅实例管理员 Bearer |

## 4. 修改文件与提交

生产实现提交：

- `a672f3e feat(server): add runtime sites and durable notifications`
- `6a5d40d feat(admin): implement approved moderation workspace`
- `98e0079 docs: align deployment with approved admin scope`
- `e612bf1 fix(server): keep CORS checks scoped to APIs`
- `05911ee fix(admin): preserve empty notification form states`

主要范围：

- 服务端：`server/config/**`、`server/handle/admin/**`、`server/handle/comment/**`、
  `server/middleware/**`、`server/model/**`、`server/notifications/**`、`server/routes/**`；
- 管理端：`packages/admin/src/**` 与 `packages/admin/public/templates/**`；
- 运维和约束：`deploy/**`、`docs/operations/**`、`docs/product/constraints.md`、两个 UI contract；
- 未修改或提交用户现有的 `CODEBASE_ANALYSIS.md` 和 `test_site/` 工作区内容。

## 5. 自动化验证

最终本地门禁：

| 命令 | 结果 |
| --- | --- |
| `go test -count=1 ./...` | 通过；config/comment/middleware/model/notifications/routes/utils 全部通过 |
| `go vet ./...` | 通过 |
| `packages/admin: pnpm test` | 通过，14/14 |
| `packages/admin: pnpm type-check` | 通过 |
| `packages/admin: pnpm build` | 通过；CSS 21.97 kB，JS 122.99 kB |
| `packages/client: pnpm test` | 通过，24/24 |
| `packages/client: pnpm type-check` | 通过 |
| `packages/client: pnpm build` | 通过；ESM 47.34 kB，UMD 42.22 kB |
| `packages/client: pnpm test:package` | ESM、UMD、CommonJS、类型声明契约通过 |

自动化覆盖包括 migration v3/v4、未来版本失败、重复 migration、动态 CORS、站点并发更新、
三态列表、拒绝子树安全、批量部分失败、墓碑/彻底删除、公共 DTO 隐私、密钥密文、outbox 去重/
重试/恢复、通知设置脱敏、模板 allowlist/CSP、登录/删除/通知限流和默认日志脱敏。

## 6. 真实 API、容器与浏览器证据

### 6.1 远端容器和 SQLite

- 最终运行 release：`05911eec2387742aaf1df39a40e7ecaabb730afb`。
- 镜像：`sha256:40cfe78fd1af64332b29e7a6028edeb43c53e1652db38f0e22bf944c0a7a214b`。
- `ecoku-development`：`healthy`；`http://127.0.0.1:12123/api/health` 返回 200。
- SQLite `PRAGMA integrity_check=ok`，schema versions 为 `1,2,3,4`。
- 最终数据：1 个站点、60 条评论、0 pending、59 approved、1 deleted、2 个通知渠道、0 个待处理 outbox。
- 部署前备份：`ecoku-pre-deploy-20260813T123741Z-05911ee...sqlite3`，114688 bytes。
- 相同 external `ecoku-data` 卷贯穿部署；部署脚本先构建，再备份/迁移/切换，健康失败自动回滚。

### 6.2 真实 API

- 管理登录、站点列表、通知设置脱敏、非法通知测试 400 均通过。
- 专用临时评论完成：提交 201、公开隐藏、批准 200、公共 DTO 不含邮箱/状态、墓碑 200、
  固定墓碑公开、无后代墓碑彻底删除 200、删除后 404。
- CORS 最终复验：带 Origin 的同源管理 JS 为 200；允许公开来源预检 204；恶意来源预检 403。
- 模板为 200，未知模板 404；模板 CSP 包含 `default-src 'none'` 和 `connect-src 'none'`。
- 浏览器批量创建两条临时 pending，选择 2/2 后真实批量拒绝，最终显示 0 pending；临时数据已清理。
- 默认日志未发现密码、token、管理密钥、邮箱或评论正文泄漏。

### 6.3 真实浏览器

- 登录页无旧的大段提示文案和装饰横线；空表单按钮、focus 和 hover 使用统一视觉。
- 1600×900：header `x=80,width=1440,height=60`；审核主体同宽，队列 520px，详情 918px，
  无水平溢出；站点选择器显示 `127.0.0.1`。
- 793×831：队列全宽，点击评论后出现全屏详情和“‹ 返回”；元信息不溢出。
- approved、deleted、空 pending、分页、排序、批量栏、确认弹窗和彻底删除入口均由真实 API 渲染。
- 危险按钮正常态红色描边；hover 的实测颜色为背景/边框 `rgb(111,35,33)`、文字
  `rgb(250,249,245)`，可读。
- 通知空态端口值为空、占位为 465、两个保存按钮禁用；打开开关后输入和保存立即启用。
- 邮箱 chip 连续粘贴两个值、错误值标红、单项删除和表单内联校验通过。
- 三份模板均真实打开且控制台无错误；最终管理 bundle 为 `index-qL-inOmE.js`，控制台无错误。

## 7. 条件性与尚未验证

- **尚未执行真实 SMTP 邮件投递和真实 Telegram Bot 投递。** 测试实例没有用户提供的第三方
  SMTP/Bot 凭据；当前证据为加密保存、API 校验、mock/失败映射、模板和 outbox 自动化。
- 当时的持久开发验收实例现已退役，本记录不代表任何现役服务或生产 SLA。
- 没有执行 npm publish、镜像仓库推送、Git tag、GitHub/Forgejo Release、PR 或远程 Git push。
- 没有把测试实例的本地 Hugo `site_url` 改成正式博客域名；真实通知启用前必须先改为公开规范 URL。
- 单机内存限流和单进程 outbox worker 不提供多副本协调或高可用；这是当前批准的自托管边界。
- 部署前备份持续累积，长期运行需要部署者制定保留与异机备份策略。

## 8. 凭据与交付状态

- 旧测试实例的访问地址、管理员凭据位置和登录命令已删除，不再用于人工验收。
- 当时的浏览器手动验收已经结束；内存 token 不属于可复用交付物。
- 当前源码变化均已分次提交到本地 `main`；没有配置远程或推送。
- `CODEBASE_ANALYSIS.md` 的修改和 `test_site/` 未跟踪目录属于用户现有工作区，本阶段未纳入提交。

## 9. 后续事项

P4 到此结束。下一步只有在用户另行授权后才能进入：真实 SMTP/Telegram 凭据联调、正式域名迁移、
生产备份保留策略、远程 Git/push/release、镜像发布或 npm 发布。任何一项都不能由本记录自动授权。
