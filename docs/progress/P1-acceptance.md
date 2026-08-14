# Ecoku P1 验收记录

> 日期：2026-08-12
>
> 结论：P1 **通过本地代码级验收**。本记录不代表部署、发布、线上、真实浏览器或生产数据库验收。

## 1. 用户确认的边界

- P1 只实现“独立管理员认证 + 最小站点级评论审核 API”，不实现生产评论 UI、完整管理后台、最终领域模型、部署或发布。
- P1 使用一个实例级管理员，可管理配置注册表中的全部站点；站点运营员和细粒度 RBAC 后置。
- 管理员认证与默认关闭的普通用户认证完全分离。管理员会话使用默认 8 小时有效、可由凭据轮换整体失效的 Bearer token；P1 不提供 refresh token、在线会话黑名单、单会话登出或在线改密。
- 管理员能力默认关闭。启用时，用户名、bcrypt 密码哈希和 token 签名密钥只从三个不同的环境变量读取；仓库不提供默认密码、明文凭据或固定签名密钥。
- 首次凭据通过受保护的本地提示或密码管理工具离线生成 bcrypt 哈希并由服务管理器注入。轮换密码哈希和/或签名密钥后受控重启，旧 token 随即失效。
- 每站点 management key 只供可信服务端自动化使用。浏览器管理端只使用管理员 Bearer token，不接收、显示或持久化 management key。
- 受保护的站点审核 API 接受全局管理员 `Bearer` 或站点限定的 `EcokuSite` 凭据。有效的 site-A key 访问已注册 site-B 返回 403；无效凭据返回 401；认证后访问未知站点返回 404。
- 管理端使用独立、精确的 `admin.allowed_origins`，不能复用任一公开站点来源；无 `Origin` 的 CLI/服务端请求仍必须认证。
- 最小状态转换为 `pending -> approved|rejected`。重复同一终态操作幂等；`approved` 与 `rejected` 之间反向转换返回 409。
- 批准回复前必须验证完整祖先链存在、无循环、属于同一站点和同一页面且全部已批准。拒绝父评论不物理删除或级联修改后代。
- 管理审核 DTO 可以包含私有邮箱，但只包含明确批准的审核字段。公共 DTO 继续只返回已批准评论且永不返回邮箱。
- 仓库仍没有 `.git`；按用户在 P0 已给出的授权继续修改本地文件，但未初始化 Git、提交、推送或创建历史。

长期产品约束同步记录于 `docs/product/constraints.md`。

## 2. API 契约

所有 JSON 响应沿用 P0 统一外层结构：

```json
{
  "code": 200,
  "message": "...",
  "data": {}
}
```

外层 `code` 与真实 HTTP 状态一致。错误响应省略 `data`，不回显认证输入、数据库错误或请求秘密。

| 方法与路径 | 身份 | 行为 |
| --- | --- | --- |
| `POST /api/admin/login` | 无会话；仅独立管理来源或无 Origin 调用 | 以 `username`、`password` 换取 Bearer token；响应包含 `token`、`token_type`、`expires_at`、`expires_in` |
| `GET /api/admin/sites/:siteId/comments?status=pending&page=1&pageSize=20` | `Bearer` 或本站 `EcokuSite` | 只分页列出该站点的 pending 评论；`pageSize` 上限 100 |
| `GET /api/admin/sites/:siteId/comments/:commentId` | `Bearer` 或本站 `EcokuSite` | 查看该站点一条任意审核状态的评论 |
| `PATCH /api/admin/sites/:siteId/comments/:commentId` | `Bearer` 或本站 `EcokuSite` | 请求体只接受 `status: approved` 或 `status: rejected` |

认证头格式：

```text
Authorization: Bearer <admin-token>
Authorization: EcokuSite <site-management-key>
```

管理审核 DTO 只包含：

```text
id, site_id, mark, parent, status, username, email, url,
content, created_at, updated_at
```

主要状态语义：

- 成功 200；CORS 预检成功 204。
- 参数或 JSON 错误 400；过大请求体 413。
- 缺少、格式错误或错误凭据 401；登录失败统一返回相同 401 文案。
- 有效站点凭据访问其他已注册站点 403；不允许的浏览器来源也返回 403。
- 未知站点或站点内不存在的评论 404。
- 非法终态反向转换、未批准/损坏的祖先链和并发相反审核返回 409。
- 登录限流返回 429 和 `Retry-After`。
- 数据库或其他内部错误返回通用 500。

## 3. 认证、授权与并发实现

### 独立管理员认证

- `admin.enabled` 默认是 `false`，此时管理员路由不注册。启用后，任何缺失、过短、复用或格式错误的管理员凭据都会使配置加载失败。
- 密码只用 bcrypt 校验；配置要求 bcrypt cost 至少为 10。登录无论用户名不存在、密码错误还是输入缺失，都执行密码哈希比较并返回相同 401 响应。
- 管理 token 使用独立 HMAC-SHA256 签名，包含版本、受众、管理员主体、签发/过期时间和凭据版本。普通用户 token 不能作为管理员 token 使用。
- 凭据版本绑定当前管理员用户名和密码哈希；密码哈希轮换使旧 token 失效，签名密钥轮换使旧签名失效。token 解析同时验证格式、签名、受众、主体、签发时间和过期时间。
- 用户名、token、management key 等比较通过固定大小摘要后作恒定时间比较；密码使用 bcrypt。
- 管理路由统一发送 `Cache-Control: no-store` 和 `Pragma: no-cache`。
- 登录有独立的 `rate_limit.admin_login` 单进程 socket-IP 限流，不与普通用户登录桶共享，也不读取转发头。

### 站点授权与审核正确性

- 每次审核请求先验证 `siteId` 格式和站点注册状态，再应用实例管理员或 management key 的站点范围。
- 评论查询和状态更新都带 `site_id` 与评论 ID 条件，跨站点评论表现为 404，不泄露其存在性。
- 状态更新只对 `status = pending` 的目标执行条件更新，并严格检查 `RowsAffected == 1`。
- 并发状态变化后会重新读取实际状态：相同目标作为幂等成功返回，相反目标作为 409 返回，不把丢失或冲突记录伪报为成功。
- 批准回复前逐级读取祖先，设置 1024 层安全上限和已访问 ID 集；缺失、负数、溢出、循环、跨站点、跨页面或未批准祖先都返回 409。
- 审核只更新状态，不清空或重写邮箱、正文、父子关系等评论数据；拒绝父评论不级联修改后代。

### DTO 与日志边界

- 公共评论 API 仍只查询 approved，并使用独立 `PublicCommentResponse`；pending、rejected 和邮箱不会进入公开 JSON。
- 管理接口使用独立 `CommentReviewDTO`，不直接序列化 `Comment` 或 `User` 模型。
- 管理 DTO 不包含 IP、UA、地区、UserID、密码、验证码、token、management key 或完整 User。
- 默认请求日志只记录 method、path、status、duration；测试以真实 token、站点 key、邮箱、正文和密码作为哨兵，确认日志不包含这些值，也不包含 Authorization 头或连接 IP。

## 4. 修改文件

### 产品与验收记录

- `docs/product/constraints.md`
- `docs/progress/P1-acceptance.md`（本文件）

### 服务端配置与模型初始化

- `server/config.yaml.example`
- `server/config/config.go`
- `server/config/config_test.go`
- `server/model/database.go`

### 管理认证、授权与审核

- `server/handle/admin/auth.go`（新增）
- `server/handle/admin/moderation.go`（新增）
- `server/middleware/admin_auth.go`（新增）
- `server/middleware/cors.go`
- `server/middleware/middleware_test.go`
- `server/routes/routes.go`
- `server/routes/routes_test.go`
- `server/routes/admin_routes_test.go`（新增）
- `server/utils/admin_auth.go`（新增）
- `server/utils/auth_test.go`

`server/model/database.go` 只移除了 `drop_table` 后把普通 `User` 记录创建成管理员的旧引导逻辑；没有删除 `User`、`Comment`、`Site` 字段，没有重写最终 schema，也没有销毁 Count 遗留表。

P1 没有修改 `packages/client` 或 `packages/admin` 源码。两个包的 `dist` 只因本地验收构建而重新生成，并受现有 `.gitignore` 覆盖；这不代表生产 UI 已实现。

## 5. 自动化验证

环境：Go `1.26.5 windows/amd64`、Node.js `24.18.0`、pnpm `11.3.0`。

2026-08-12 在本地执行并通过：

```text
cd server
go test ./...
go vet ./...
go test -v ./config ./middleware ./utils ./routes

cd packages/client
pnpm run type-check
pnpm run build

cd packages/admin
pnpm run build
```

结果摘要：

- `go test ./...`：退出码 0，所有含测试的服务端包通过；无测试包明确显示 `[no test files]`。
- `go vet ./...`：退出码 0，无诊断。
- 定向测试：配置、CORS/隐私中间件、普通/管理员 token、统一 HTTP 状态和管理员路由集成测试全部通过。
- client `type-check`：退出码 0。
- client library build：退出码 0，Vite ES/UMD 构建和 TypeScript 声明构建成功。
- admin build：退出码 0，`vue-tsc -b` 与 Vite production build 成功。

自动化用例覆盖并通过：

- 缺失、错误和错误格式管理员凭据返回 401；畸形 JSON 返回 400；过大登录体返回 413。
- 管理员 Bearer token 有效期验证、未来签发保护、密码哈希轮换和签名密钥轮换失效；普通用户 token 不能混用。
- 登录限流独立生效并返回 429；改变 `X-Forwarded-For` 不能绕过 socket-IP 限流。
- 公开来源不能调用管理 API，管理来源及 PATCH 预检通过；未允许来源返回 403。
- site-A management key 管理 site-A 成功，访问已注册 site-B 返回 403；无效 key 返回 401。
- 未知 `siteId` 返回 404，非法 `siteId` 返回 400；跨站点评论不能查看或审核。
- pending 列表只包含目标站点且不混入终态评论；管理 DTO 字段集合与批准清单完全一致。
- 公共 API 继续看不到 pending、rejected 和邮箱；批准后评论可公开读取且仍无邮箱/IP；拒绝后仍不可公开读取。
- 首次批准/拒绝、重复相同操作幂等、相反终态 409、缺失评论 404、非法目标状态 400、数据库失败 500。
- 状态变化不修改正文、邮箱或父评论关系；拒绝父评论不级联后代。
- 未批准祖先、跨页面祖先、损坏链和循环链返回 409；根、子、孙依序批准后公共 API 可重新读取深层线程。
- 并发 `approve/reject` 只产生一个成功和一个冲突；并发相同批准均得到可解释的 200 幂等结果。
- 默认日志不包含密码、token、management key、Authorization、邮箱、评论正文或 IP。
- P0 的统一 HTTP 状态、Count 路由 404、普通用户路由默认 404、CORS、父评论关系、深层回复、公开隐私、第三方 IP 移除与限流测试继续通过。

源码级边界扫描结果：

- client/server 运行时源码不存在 `myip.ipip.net`、ipify、ipinfo 等第三方 IP 端点。
- 生产源码不存在固定 `ecoku` 认证密钥模式。
- 公共 handler 中只保留“旧 `includePending` 输入也不会改变查询”的注释；唯一运行查询始终固定 approved，测试验证旧参数无法绕过。
- 没有 Count 命名源文件或生产 Count handler/model/API；仅保留确认旧 Count 路由返回 404 的测试字符串。
- client/admin 浏览器源码不存在 management key、`EcokuSite` 或 Authorization 集成。
- 未发现把密码、token、Authorization、management key、邮箱或评论正文传给默认日志的生产代码模式。

### 项目不存在的门禁

- `packages/client/package.json` 没有 `lint` 或 `test` 脚本；没有把这两项描述成通过。
- `packages/admin/package.json` 没有独立 `lint`、`type-check` 或 `test` 脚本；没有伪造这些门禁。其现有 `build` 脚本内部确实运行 `vue-tsc -b`。

## 6. 本地、条件性与尚未验证项

### 本地或人工验证

- 服务端测试通过 Gin `httptest` 与内存 SQLite 执行真实路由、中间件、事务和持久化路径，而非仅编译 handler。
- 静态检查人工核对了公开/管理 DTO 字段、管理员配置示例、无 Git 状态、Count/第三方 IP/固定密钥/敏感日志入口和浏览器凭据边界。
- client/admin 完成真实依赖环境下的类型检查或生产构建；没有启动或改造现有 mock 管理界面。

### 条件性验证

- 真正启用管理员能力需要在私有 `config.yaml` 设置 `admin.enabled: true`，配置独立管理来源，并通过服务管理器注入用户名、cost >= 10 的 bcrypt 哈希、至少 32 字符的独立签名密钥以及各站点 management key。
- token 的 8 小时等待没有按真实时钟等待；自动化测试通过可控时钟覆盖到期边界，并通过当前环境值变化覆盖凭据轮换失效。
- 实际环境变量轮换需要服务管理器更新进程环境并受控重启；测试在隔离进程环境中验证了新旧凭据绑定逻辑。

### 尚未验证

- `go test -race ./routes` 已尝试，但当前 Windows Go 环境为 `CGO_ENABLED=0`，命令以 `go: -race requires cgo; enable cgo by setting CGO_ENABLED=1` 退出；并发 HTTP 集成用例通过，但 race detector 没有运行。
- 没有真实 MySQL、磁盘 SQLite、长期运行服务、反向代理、多个进程或分布式限流验证。
- 没有真实浏览器 CORS/管理端交互、视觉验收、性能压测、渗透测试或线上流量验收。
- 没有 Docker、部署、发布、提交、推送、PR 或 release。

## 7. 未解决风险与明确留给 P2 的事项

- 管理 token 是无服务端会话表的短期 token；P1 只能通过管理员密码哈希或签名密钥整体轮换撤销全部会话，不能撤销单个 token。
- management key 是长期服务端凭据；P1 没有独立 key ID、重叠轮换窗口、审计记录或更细的自动化权限。
- 管理员登录限流仍是 P0 约束下的单进程内存实现，进程重启会清空，多实例之间不共享。
- 管理 API 具备生产安全基线，但 `packages/admin` 仍是 mock 管理端；P1 没有把它描述为已接入或可生产使用。
- 旧 `Comment`/`User` schema 仍包含 MVP 不使用的 IP、UA、Location、Avatar、Up、Down、Featured、UserID 等字段。当前写入和 DTO 边界已封闭，但最终字段收敛和数据迁移尚未进行。
- 普通用户账户代码和表仍存在但路由默认关闭；需要在后续数据模型阶段决定永久移除还是明确后置，不能无意启用。
- 产品已确认删除评论使用墓碑并保留后代，但删除 API、墓碑字段/迁移和公开/审核显示语义尚未实现。
- Count 产品代码已删除，但既有数据库可能仍有遗留表。任何实际 `DROP TABLE` 都必须在 P2 的迁移方案中单独列明并取得破坏性授权。
- P2 建议聚焦“评论领域模型收敛 + 可回滚迁移 + 墓碑删除语义”，继续不实现生产 UI、完整管理后台、部署或发布；在修改 schema 前必须再次集中确认迁移与兼容策略。

## 8. 版本控制与发布声明

- `D:\Forgejo\Ecoku\.git` 不存在；`git rev-parse --is-inside-work-tree` 返回退出码 128 和 `not a git repository`。
- 因此无法用 `git status` 精确区分 P0、P1 与更早的本地差异，也没有提交级回滚保护。
- 所有 P1 代码和文档变化均为未提交的本地文件变化；没有执行 `git init`。
- 本阶段没有部署、发布、线上验收、提交、推送、PR 或 release。
