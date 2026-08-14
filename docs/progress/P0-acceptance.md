# Ecoku P0 验收记录

> 日期：2026-08-12
>
> 结论：P0 **通过本地代码级验收**。本记录不代表部署、发布、线上或真实浏览器验收。

## 1. 已确认的产品边界

- `designs/plain-thread-comments` 被批准为 Ecoku 评论区的方向基线：纯文本、无头像、无赞踩/反应、多层线程式回复。
- 原型不再绑定 `D:\Forgejo\Blog`、PaperMod 或 Twikoo 的生产文件；P0 没有实现生产评论 UI。
- MVP 只保留访客评论：昵称和私有邮箱必填，网站可选。
- 普通用户注册、登录、验证码和找回代码暂时保留，但路由默认不注册；管理员认证留给 P1。
- 每个已注册站点可选 `auto` 或 `pending`；未填写时默认 `pending`。P1 必须提供最小管理员审核 API。
- 一个实例支持多个显式注册站点；每站点具有独立来源、评论配置和从独立环境变量读取的管理凭据。未知 `siteId` 被拒绝。
- 邮箱只私有保存。IP、User-Agent、地理位置不持久化、不公开返回、不写日志；socket IP 只在单进程内存限流器中短暂使用。
- P0 不信任代理头；限流不读取 `X-Forwarded-For`。反向代理支持必须在后续阶段采用明确代理 IP/CIDR。
- Count 模块代码、路由、SDK 和管理端入口被删除。遵守 P0 非破坏性约束，没有主动删除既有数据库中的遗留 Count 表。
- 仓库没有 `.git`。用户授权在没有 Git 提交保护的情况下修改本地文件；未初始化、提交、推送或创建任何 Git 历史。

详细约束见 `docs/product/constraints.md`。

## 2. 实际行为变化

### HTTP 与服务器入口

- 统一 JSON 响应仍使用 `code`、`message`、可选 `data`，HTTP 状态现在与业务结果一致，不再把错误伪装为 200。
- 增加统一 404、405、429、413 和 500 JSON 响应。
- 增加隐私安全的请求日志，只记录方法、URL path、状态和耗时；不记录 IP、查询串、请求体、请求头或错误值。
- 增加 panic 恢复，并返回通用 500，不记录 panic 内容或请求秘密。
- HTTP 服务增加读头、读取、写入、空闲超时和 64 KiB 请求头上限。

### 多站点配置与来源边界

- `server/config.yaml.example` 改为配置文件形式的 `sites` 注册表。
- 每个站点必须声明合法 ID、至少一个精确 `http`/`https` 来源、独立管理密钥环境变量及审核模式。
- 管理密钥必须至少 32 字符；不同站点不能共享环境变量名或实际密钥值。
- 配置文件使用严格 YAML 字段检查；未知字段、非法来源、通配代理、不完整数据库配置或缺失秘密都会阻止配置安装。
- CORS 只允许所有已注册站点来源的精确并集；评论处理器再校验来源确实属于请求中的站点。评论提交缺少 `Origin` 也返回 403。

### 评论正确性与公开数据

- 评论提交只接受访客字段；客户端发送的 IP、UA、地区、头像、token 或 user ID 不会绑定或保存。
- 服务端限制：站点 ID 100 字符、页面 key 512、昵称 80、邮箱 254、网站 2048、正文 10000、分页每页最多 100；JSON 请求体上限 16 KiB。
- 网站 URL 只接受具有 host 的 `http` 或 `https`，并拒绝内嵌用户凭据。
- 回复父评论必须存在，并且属于同一站点和同一页面；无效父评论返回 404，跨站点/跨页面返回 409。
- 公共列表始终只查询已通过评论；旧 `includePending` 输入不再有任何选择未审核数据的代码入口。
- 公共 DTO 与模型分离，只包含公开评论字段，不包含邮箱、IP、UA、地区、UserID、User 对象、状态、头像、赞踩或精选字段。
- 根评论按页查询后，以父 ID 逐层读取并返回所有已通过后代；自动化测试覆盖四层线程。
- `auto` 站点新评论保存为已通过，未显式配置或 `pending` 站点保存为待审核。

### 认证、限流与隐私

- 删除固定 `ecoku` 签名密钥回退。普通用户认证启用时，缺少至少 32 字符的环境变量密钥会导致配置失败。
- 保留的普通用户 token 有 30 天有效期，并绑定当前密码哈希版本；密码更新后旧 token 不再匹配。
- 评论提交、登录、注册、发验证码、验验证码和找回密码都有独立、可配置的单进程固定窗口限流；超限返回 429 和 `Retry-After`。
- 限流键只使用 `Request.RemoteAddr` 的 socket 对端 IP；改变 `X-Forwarded-For` 无法绕过。
- GORM 默认 SQL 日志关闭，避免错误 SQL 输出绑定的邮箱或评论正文。
- 浏览器 SDK 不再请求 `myip.ipip.net` 或任何第三方 IP 服务，也不再读取或提交浏览器 UA、IP 或地区。

### Count 移除

- 删除服务端 Count handler、模型和路由，并从迁移/清表模型列表移除。
- 删除浏览器 SDK 的 Count API、DOM 属性处理、样式、示例与文档。
- 删除管理端 Count 页面、路由、菜单、store、类型和仪表盘摘要。
- `/api/count/batch` 与 `/api/increment/batch` 的路由测试确认返回 404。
- 没有执行数据库 `DROP TABLE`；既有部署的遗留 Count 表仍保留。

## 3. 修改文件

### 设计与持久记录

- `designs/plain-thread-comments/_d_meta.json`
- `designs/plain-thread-comments/ui-contract.json`
- `designs/plain-thread-comments/README.md`
- `docs/product/constraints.md`
- `docs/progress/P0-acceptance.md`

### 服务端

- `server/config.yaml.example`
- `server/config/config.go`
- `server/config/config_test.go`
- `server/handle/comment/list.go`
- `server/handle/comment/submit.go`
- `server/handle/comment/validation.go`
- `server/handle/comment/comment_test.go`
- `server/handle/user/user.go`
- `server/middleware/body_limit.go`
- `server/middleware/cors.go`
- `server/middleware/rate_limit.go`
- `server/middleware/recovery.go`
- `server/middleware/request_logger.go`
- `server/middleware/middleware_test.go`
- `server/model/database.go`
- `server/model/user.go`
- `server/routes/routes.go`
- `server/routes/routes_test.go`
- `server/utils/auth.go`
- `server/utils/auth_test.go`
- `server/utils/response.go`
- `server/utils/response_test.go`
- `server/main.go`、`server/logs/logs.go`（仅 Go 格式统一）

已删除：

- `server/handle/count/get.go`
- `server/handle/count/inc.go`
- `server/model/count.go`

### 浏览器 SDK 与现有管理端

- `packages/client/package.json`
- `packages/client/README.md`
- `packages/client/src/comment.ts`
- `packages/client/src/fetch.ts`
- `packages/client/src/main.ts`
- `packages/client/src/ecoku.ts`
- `packages/client/src/style.css`
- `packages/client/src/util.ts`
- `packages/admin/src/layouts/DashboardLayout.vue`
- `packages/admin/src/router/index.ts`
- `packages/admin/src/stores/admin.ts`
- `packages/admin/src/types.ts`
- `packages/admin/src/views/DashboardView.vue`

已删除：

- `packages/client/src/counter.ts`
- `packages/admin/src/views/CountersView.vue`
- `packages/admin/src/components/HelloWorld.vue`（未使用的 Vite Count 示例）

## 4. 自动化验证

环境：Go `1.26.5 windows/amd64`、Node.js `24.18.0`、pnpm `11.3.0`。

以下命令均在 2026-08-12 本地执行并通过：

```text
cd server
go test ./...
go vet ./...
go test -v ./config ./handle/comment ./middleware ./routes ./utils

cd packages/client
pnpm run type-check
pnpm run build

cd packages/admin
pnpm run build
```

验证结果：

- `go test ./...`：所有含测试的包通过；无测试包被明确显示为 `[no test files]`。
- `go vet ./...`：退出码 0，无诊断。
- 评论集成测试通过：公开 DTO 脱敏、pending 绕过失败、四层线程可读、父评论缺失/跨页面/跨站点拒绝、客户端网络元数据不落库、auto/pending 状态、字段长度与 URL 限制。
- 中间件测试通过：精确 CORS、预检、socket-IP 限流、伪造 XFF 不绕过、429、声明长度和流式请求体 413、通用 500、访问日志不泄露 IP/邮箱/token。
- 路由测试通过：普通用户路由默认 404、Count 路由 404、评论限流 429；普通用户能力显式启用时五类敏感路由均具有独立限流。
- 认证测试通过：无密钥不能签 token、token 过期拒绝、密码哈希变化使旧 token 失效。
- HTTP 状态表测试覆盖 200、400、401、403、404、409、429、500。
- client `type-check` 通过；client library build 通过，生成 ES/UMD 与类型声明。
- admin build 通过，其中 `vue-tsc -b` 与 Vite production build 均成功。
- 设计元数据两个 JSON 文件通过 PowerShell `ConvertFrom-Json`。

静态扫描均为 `NO_MATCHES`：

- client 源码及构建产物中的第三方 IP 域名/函数；
- 服务端固定 `ecoku` 密钥、Gin 默认 IP 日志、`ClientIP` 和生产 XFF 使用；
- 公共评论 handler 中的 `includePending` 查询开关；
- 非测试产品代码中的 Count handler/model/API/SDK/管理端标识；
- 通配 CORS；
- client/admin 构建产物中的 Count 或第三方 IP 引用。

### 不存在的脚本

- `packages/client/package.json` 没有 `lint` 或 `test` 脚本；没有伪造这两项通过。现有 `type-check` 与 `build` 已执行。
- `packages/admin/package.json` 没有独立 `lint`、`type-check` 或 `test` 脚本；没有伪造。其 `build` 内部实际执行了 `vue-tsc -b`。

## 5. 本地、条件性与尚未验证项

### 本地验证

- HTTP handler/middleware 通过 `httptest` 与内存 SQLite 进行了真实请求和持久化集成测试。
- client/admin 完成真实依赖安装、类型检查和生产构建。
- 没有启动长期运行的本地服务器，也没有把编译或静态扫描描述为浏览器验收。

### 条件性验证

- 实际启动需要用户从 `server/config.yaml.example` 创建私有 `config.yaml`，并为每站点注入至少 32 字符且互不相同的管理密钥环境变量。
- 普通用户路由只有在 `auth.user_enabled: true` 且注入独立认证密钥后才注册；MVP 示例默认关闭。
- MySQL、SMTP、真实磁盘 SQLite、反向代理与多进程场景未在本阶段运行。

### 尚未验证

- 没有真实浏览器视觉/交互验收；P0 明确没有实现获批原型的生产 UI。
- 没有 Docker、部署、发布、线上流量、性能压测或安全渗透测试。
- 没有 Git commit、push、PR 或 release。

## 6. 未解决风险与 P1 事项

- P1 必须实现独立管理员认证和最小站点级审核 API：列出 pending、查看单条、批准、拒绝，并验证所有跨站点访问都失败。
- 在写 P1 前需确认管理员会话方式、实例管理员与站点权限模型、服务端管理密钥的使用者及轮换方式；浏览器不得接收站点管理密钥。
- `Comment`/`User` 旧 schema 中仍有 IP、UA、Location、Avatar、Up、Down、Featured、UserID 等字段。P0 按要求没有重写或删除字段；当前写入和公开读取路径已封闭，最终迁移留给后续数据模型阶段。
- 管理 DTO 尚未实现。P1 不得复用公共 DTO 暴露邮箱之外的敏感字段，并应只在已认证、站点授权的审核响应中提供审核所需的私有邮箱。
- CORS/Origin 不是不可伪造的服务器身份凭据。公开访客提交当前依赖已注册来源、请求限制和单进程 socket-IP 限流；更强的分布式限流、验证码或反垃圾策略仍未实现。
- 反向代理后的真实客户端 IP 提取尚未实现。P0 始终以 socket 对端限流；启用代理前必须在后续阶段实现并测试精确代理 CIDR 信任链。
- Count 产品代码已删除，但遗留数据库表未销毁。后续数据迁移阶段需在取得明确破坏性授权后决定是否删除。
- 普通用户账户代码仍存在但默认关闭；后续需决定永久删除还是在 MVP 之后恢复，不能无意开放。
- 已获批的评论生产 UI、墓碑删除流程、管理界面、通知、部署和发布均不属于 P0。

## 7. 版本控制与发布声明

- `D:\Forgejo\Ecoku\.git` 不存在，`git rev-parse --is-inside-work-tree` 返回“not a git repository”。
- 所有 P0 源码与文档变化都是未提交的本地文件变化；无法使用 Git status 区分或回滚。
- `pnpm install --frozen-lockfile` 按现有锁文件安装依赖；`node_modules` 和构建 `dist` 位于现有忽略规则覆盖的目录。
- 本阶段没有部署、发布、线上验收、提交、推送或 PR。
