# Ecoku P2 验收记录

> 日期：2026-08-12
>
> 结论：P2 **通过本地代码级验收**。本记录不代表真实用户数据库迁移、部署、发布、线上、真实浏览器或生产环境验收。

## 1. 用户确认的数据与产品边界

- P2 只完成“评论领域模型收敛 + 安全数据迁移 + 墓碑删除语义”，不实现生产评论 UI、完整管理后台、通知、部署或发布。
- Comment 最终持久字段只保留：`id`、`site_id`、页面 `mark`、nullable `parent_id`、审核 `status`、访客 `username`、私有 `email`、可选 `url`、纯文本 `content`、`deleted_at`、`created_at`、`updated_at`。
- `UserID`、完整 `User`、IP、UA、Location、Avatar、Up、Down、Featured 不再属于 Comment schema。
- 普通用户注册、登录、找回、验证码、SMTP、普通用户 token 与相关运行时代码在 P2 删除；历史 `users` 和 `email_verification_codes` 表不执行 DROP。
- API 的审核状态继续使用 `pending/approved/rejected`；SQLite 内部保留 `0/1/-1`，不做无收益的状态格式转换。
- 根评论在数据库使用 `parent_id=NULL`；公共 API 为兼容既有客户端继续接受和返回 `parent: 0`。
- 删除使用隐私型墓碑：保留评论 ID、站点、页面、父关系、审核状态和时间；清空昵称、邮箱、网站和原正文。公开 DTO 返回 `deleted: true` 和固定展示值，不保存或返回原正文。
- 管理员 Bearer 与本站服务端 `EcokuSite` management key 可以墓碑删除；重复删除幂等。删除不级联后代，pending/rejected 墓碑不公开、不进入待审核队列，也不能继续审核。
- P2 引入显式、有版本记录、可重复执行的数据库迁移。测试只使用临时数据库和历史 fixture，禁止迁移工作目录或用户实际数据库。
- Count 已不属于产品范围；P2 保留可能存在的历史 `counts` 表，不提供也不默认执行 DROP。
- 用户明确将数据库支持范围收敛为 **仅 SQLite3**；MySQL 配置、驱动、依赖、分支和条件性验证全部移除，不再把 MySQL 列为待支持平台。
- 公共提交/列表与 P1 管理登录/审核路径保持稳定；墓碑只增加向后兼容的 `deleted` 字段。
- 仓库仍没有 `.git`。按用户在 P0 已给出的授权继续修改本地文件，但没有初始化 Git、创建历史、提交或推送。

长期产品约束同步记录于 `docs/product/constraints.md`。

## 2. 最终 Comment schema 与约束

最新 schema 版本为 `1`，迁移名称为 `p2_comment_domain`。`schema_migrations` 逐版本记录：

```text
version, name, checksum, applied_at
```

`comments` 表具有以下数据约束：

- `id` 为 SQLite 自增主键；`site_id` 和 `mark` 非空并有长度约束。
- `parent_id` 可空；复合外键 `(parent_id, site_id, mark)` 指向同表 `(id, site_id, mark)`，数据库层禁止缺失、跨站点和跨页面父关系。
- 服务端仍在提交和审核路径验证父节点存在、站点/页面归属、墓碑状态、祖先状态、深度和循环，不能只依赖数据库外键。
- `status` 只允许 `-1`、`0`、`1`。
- 活跃评论必须有非空昵称和正文；字段长度与 HTTP 输入限制一致。
- 墓碑必须满足 `username='' AND email IS NULL AND url IS NULL AND content=''`。
- 物理删除父评论受外键 `RESTRICT` 保护；产品 API 只做墓碑更新，不物理删除或级联。

索引：

| 索引 | 用途 |
| --- | --- |
| `idx_comments_public_thread(site_id, mark, status, parent_id, created_at, id)` | 公开站点/页面根线程与后代读取 |
| `idx_comments_pending(site_id, status, deleted_at, created_at, id)` | 站点 pending 审核队列 |
| `idx_comments_parent_scope(parent_id, site_id, mark)` | 父关系和后代查询 |

P2 不再调用 `AutoMigrate`。空数据库可在首次启动时执行全部已知迁移；任何非空未版本化数据库或落后版本都要求停服、备份后显式迁移。未知未来版本、版本缺口、名称/校验和不匹配或最终 schema 校验失败均拒绝启动。

## 3. 历史数据映射

P2 的版本 1 迁移在单个 SQLite 事务内预检、建新表、复制允许字段、替换旧表、创建索引、检查外键，最后才写入版本记录。

| P0/P1 历史字段或值 | P2 结果 | 处理规则 |
| --- | --- | --- |
| `id` | `id` | 原值保留 |
| `site_id` | `site_id` | 原值保留；空值、非法格式或超长会阻止迁移 |
| `mark` | `mark` | 原值保留；空值或超长会阻止迁移 |
| `parent = 0` | `parent_id = NULL` | 根评论显式转换 |
| `parent > 0` | `parent_id` | 原 ID 保留；父节点必须存在并属于同站点、同页面，且关系不能成环 |
| `status = -1/0/1` | `status = -1/0/1` | 分别保持 rejected/pending/approved 语义；其他值阻止迁移 |
| `username` | `username` | 活跃评论原值保留；历史墓碑清空 |
| `email` | `email` | 活跃评论私有保留并校验；允许历史空值；墓碑设为 NULL |
| `url` | `url` | 活跃评论可选保留，只接受 http/https；墓碑设为 NULL |
| `content` | `content` | 活跃评论纯文本原值保留；历史墓碑清空 |
| `deleted_at` | `deleted_at` | 原值保留；非空记录强制清理个人数据 |
| `created_at`、`updated_at` | 同名字段 | 原值保留；缺失或零值阻止迁移 |
| `featured`、`ip`、`location`、`ua`、`up`、`down`、`user_id`、`avatar` | 不进入新表 | 在显式迁移成功后从 Comment schema 移除，不复制 |
| `users`、`email_verification_codes`、`counts` 表 | 原样保留 | P2 不访问、不创建、不 DROP |

迁移采用严格失败策略：如果历史记录不能无歧义满足最终约束，只报告无效记录数量和最多 20 个 ID，不在错误或日志中输出邮箱、正文或完整 SQL 参数，也不修改数据库。

## 4. 备份、恢复与失败处理

显式迁移入口：

```text
ecoku migrate --backup <全新的备份文件路径>
```

操作约束：

1. 先停止 Ecoku 及所有可能打开数据库的进程。
2. 既有数据库必须指定备份路径；新安装且数据库文件不存在时不要求空备份。
3. 备份路径不能等于源路径，不能已经存在，工具不会覆盖旧备份。
4. 检测到 `-wal`、`-shm` 或 `-journal` 边车文件时拒绝原始文件复制，要求操作者先停服并使用合适的 SQLite 备份方式。
5. 工具以 5 秒超时获取 SQLite 独占锁，复制后执行文件同步并以 SHA-256 比较源和备份；校验通过后才运行迁移。
6. 每个 schema 版本及其版本记录在同一事务内完成；中途错误或注入失败会回滚表替换，不能把失败版本记录为已完成。
7. 迁移成功后没有自动“向下迁移”。如需恢复，必须停服，保存失败现场，移走迁移后的数据库，再从已校验的迁移前备份恢复并使用原版本程序验证。

测试验证了备份必填、备份内容仍为旧 schema、拒绝覆盖、拒绝同路径、拒绝边车文件、重复迁移安全和事务失败回滚。没有对工作目录或任何真实用户数据库执行迁移、删除、覆盖或恢复。

## 5. 墓碑删除 API

```text
DELETE /api/admin/sites/:siteId/comments/:commentId
Authorization: Bearer <admin-token>
```

或仅供可信服务端调用：

```text
Authorization: EcokuSite <该站点的 management-key>
```

成功响应沿用统一 JSON 外层结构，并返回独立管理 DTO：

```json
{
  "code": 200,
  "message": "评论已删除",
  "data": {
    "comment": {
      "id": 1,
      "site_id": "site-a",
      "mark": "article",
      "parent": 0,
      "status": "approved",
      "deleted": true,
      "username": "已删除",
      "content": "[该评论已删除]",
      "created_at": "...",
      "updated_at": "..."
    },
    "unchanged": false
  }
}
```

- 首次删除以站点 ID、评论 ID 和 `deleted_at IS NULL` 条件更新，并要求 `RowsAffected == 1`；重复删除返回 200、`unchanged: true`。
- 跨站点评论对实例管理员表现为 404，不泄露目标是否存在；site-A management key 访问 site-B 返回 403。
- 删除清空数据库中的昵称、邮箱、网址和正文，保留父关系及后代。approved 墓碑与所有 approved 后代继续公开；pending/rejected 墓碑保持私有并退出审核队列。
- 不能向墓碑新增回复，也不能继续审核墓碑；本阶段不提供恢复、批量删除、物理清理或访客自助删除。
- 真实 HTTP 状态包括：参数错误 400、未认证 401、来源或站点权限不足 403、未知站点/评论/跨站点目标 404、并发状态冲突 409、请求体过大 413、限流 429、内部错误 500。
- 删除使用独立可配置 `rate_limit.comment_delete` 单进程 socket-IP 限流；CORS 只允许明确的管理来源和 DELETE 预检。

公共 DTO 增加 `deleted`，但仍不包含邮箱、IP、UA、地区、UserID、密码、验证码、token、management key 或完整 User。管理 DTO 可为活跃评论返回私有邮箱，但墓碑固定投影不返回已清除的个人数据。

## 6. 修改和删除文件

由于仓库没有 Git，以下清单根据本阶段实际文件操作记录整理，无法用提交差异重建。

### 产品、配置、依赖与启动

- `docs/product/constraints.md`
- `docs/progress/P2-acceptance.md`（本文件）
- `server/main.go`
- `server/config.yaml.example`
- `server/config/config.go`
- `server/config/config_test.go`
- `server/go.mod`
- `server/go.sum`

### Comment、迁移与墓碑 API

- `server/model/comment.go`
- `server/model/database.go`
- `server/model/migrations.go`（新增）
- `server/model/migration_backup.go`（新增）
- `server/model/migrations_test.go`（新增）
- `server/handle/comment/submit.go`
- `server/handle/comment/list.go`
- `server/handle/comment/comment_test.go`
- `server/handle/admin/moderation.go`
- `server/handle/admin/deletion.go`（新增）
- `server/middleware/cors.go`
- `server/middleware/middleware_test.go`
- `server/routes/routes.go`
- `server/routes/routes_test.go`
- `server/routes/admin_routes_test.go`
- `server/utils/admin_auth_test.go`（新增，用于保留独立管理员 token 回归覆盖）

### 普通用户运行时代码删除

- `server/handle/user/user.go`
- `server/model/user.go`
- `server/model/email_verification.go`
- `server/utils/auth.go`
- `server/utils/auth_test.go`
- `server/utils/smtp.go`
- `server/utils/utils.go`
- `server/types/global.go`
- `server/types/enum.go`

这些删除不包含数据库 `DROP TABLE`；迁移仍能识别并保留历史普通用户与 Count 表。

### 浏览器包

- `packages/client/src/fetch.ts`：公共响应类型增加可选 `deleted` 字段；没有实现或改写生产 UI。
- `packages/client/dist/**` 与 `packages/admin/dist/**`：因本地验收构建重新生成；admin 源码没有接入 API，也不能据此描述为生产管理后台。

## 7. 自动化验证

环境：Go `1.26.5 windows/amd64`、Node.js `24.18.0`、pnpm `11.3.0`，`CGO_ENABLED=0`。

2026-08-12 最终执行：

```text
cd server
go mod tidy
go test -count=1 ./...
go vet ./...

cd packages/client
pnpm run type-check
pnpm run build

cd packages/admin
pnpm run build
```

结果：

- `go mod tidy`：退出码 0；`go.mod`/`go.sum` 中没有 MySQL 驱动或传递依赖。
- `go test -count=1 ./...`：退出码 0；config、comment、middleware、model、routes、utils 全部通过，其余包明确为 `[no test files]`。
- `go vet ./...`：退出码 0，无诊断。
- client `type-check`：退出码 0，`tsc --noEmit` 通过。
- client build：退出码 0，Vite ES/UMD 与 TypeScript 声明构建通过。
- admin build：退出码 0，`vue-tsc -b` 和 Vite production build 通过。

自动化测试覆盖并通过：

- 空 SQLite 数据库完整迁移到版本 1，启动校验通过，重复运行迁移安全。
- 非空未版本化数据库拒绝普通启动，必须走显式迁移。
- 历史 schema fixture 迁移后保留 ID、站点、页面、审核状态、允许的访客字段和时间；移除 Comment 排除字段；历史普通用户、验证码和 Count 表仍存在。
- `parent=0` 转为 NULL；根、子、孙深层关系迁移后完整。
- rejected/pending/approved 的 `-1/0/1` 映射不变。
- 迁移中途在表替换后注入失败会回滚旧 schema、旧数据和版本记录。
- 缺失、跨站点、跨页面或循环父关系会阻止迁移且不修改数据库。
- 未来版本、迁移历史缺口和校验和篡改导致启动失败。
- 复合 SQLite 外键拒绝缺失/跨站点/跨页面父评论；状态与墓碑 CHECK 约束生效。
- 迁移错误不包含测试哨兵邮箱或正文。
- 显式迁移要求并校验备份，拒绝同路径、覆盖旧文件和 SQLite 边车文件。
- 公共 DTO 字段集合不包含邮箱或已移除字段；pending/rejected 仍不能由公开 API 读取。
- 墓碑删除清除数据库中的昵称、邮箱、网站和正文；公开与管理响应使用固定墓碑投影。
- 删除根评论和中间回复后，approved 后代仍能完整读取；不能回复墓碑。
- 删除 pending 后不再进入 pending 队列且不能审核；rejected 墓碑仍不公开。
- Bearer 和本站 `EcokuSite` 都能删除；跨站点删除不泄露存在性；重复删除幂等。
- 删除参数、认证、权限、缺失、并发冲突、限流和数据库失败分别返回真实 400/401/403/404/409/429/500。
- P1 管理员凭据失败、站点 key 隔离、token 到期/篡改/密码哈希或签名密钥轮换、审核状态/祖先链、独立 CORS 与敏感日志测试继续通过。
- P0 普通用户及 Count 路由 404、统一 HTTP 状态、第三方 IP 禁止、socket-IP 限流、父关系、深层回复、公开隐私、请求体限制和 CORS 测试继续通过。

源码级扫描：

- 生产服务端源码与 `go.mod`/`go.sum` 不包含 MySQL 驱动、MySQL 配置、`AutoMigrate` 或 `drop_table`。
- Comment/handler 生产字段声明不包含 UserID、完整 User、IP、UA、Location、Avatar、Up、Down 或 Featured。
- 普通用户和 Count 生产路由、handler、模型与 SMTP 入口不存在；测试仅保留确认旧路由 404 的字符串。
- client 源码与构建产物不包含第三方 IP 服务、`EcokuSite`、management key、Authorization 或转发头逻辑。
- 未发现固定 `ecoku` 密钥回退；默认 SQL 日志关闭，API 错误不回显数据库错误。
- 工作目录中未发现 `.db`、`.db3`、`.sqlite`、`.sqlite3` 或 `.bin` 数据库文件，因此本阶段没有误迁移工作区真实数据库。

### 项目不存在的门禁

- `packages/client/package.json` 没有 `lint` 或 `test` 脚本；没有把这两项描述成通过。
- `packages/admin/package.json` 没有独立 `lint`、`type-check` 或 `test` 脚本；没有伪造这些门禁。现有 `build` 脚本内部运行 `vue-tsc -b`。

## 8. 本地、条件性与尚未验证项

### 本地或人工验证

- Go 集成测试使用 `t.TempDir()` 中的磁盘 SQLite 文件、真实迁移事务、Gin 路由、中间件和 GORM 持久化路径，不是只生成 SQL或只编译。
- 人工核对了 Comment schema、DTO 白名单、配置示例、迁移命令、备份错误边界、MySQL/普通用户/Count/第三方 IP/管理凭据扫描和无 Git 状态。
- client/admin 完成真实依赖环境下的类型检查或生产构建；没有启动、接入或视觉验收现有 mock 管理端。

### 条件性验证

- 实际迁移必须由操作者停服后，在受控副本上先执行并检查，再对真实数据库使用全新备份路径。工具的独占锁和边车拒绝是附加保护，不替代停服与外部备份策略。
- Windows 上创建备份时请求了仅所有者读写的文件模式，但最终访问控制仍取决于父目录 ACL；生产操作者必须把数据库与备份放入私有目录。
- 管理员与 management key 的真实调用仍要求私有环境变量；自动化测试只使用隔离哨兵值。
- 迁移性能、磁盘空间和锁持有时间取决于真实评论规模；当前测试覆盖正确性与失败原子性，不代表大库性能验收。

### 尚未验证

- 没有真实用户 SQLite 数据库、历史生产快照、损坏数据库、超大数据库或手工恢复演练。
- 没有迁移任何工作目录数据库，也没有执行真实 `ecoku migrate --backup ...` 运维操作。
- MySQL 不是“尚未验证”；它已按用户决定明确移除并不再受支持。
- 当前 `CGO_ENABLED=0`，本阶段没有运行 Go race detector；并发审核/删除路径由事务、条件更新和 HTTP 集成测试覆盖，但不等同于 race detector 结果。
- 没有真实浏览器评论交互、管理端交互、视觉/无障碍、性能压测、渗透测试、反向代理、多实例或分布式限流验收。
- 没有 Docker、部署、发布、线上验收、提交、推送、PR 或 release。

## 9. 未解决风险与明确留给 P3 的事项

- 迁移版本 1 会有意移除 Comment 排除字段；事务可以处理执行中失败，但成功后的唯一回退方式是恢复迁移前备份。真实迁移前仍需独立备份和恢复演练。
- 严格迁移预检会阻止含非法历史邮箱、网址、时间、状态或关系的数据，不会自行“修复”或丢弃；真实历史异常需要先在数据库副本上形成经用户批准的数据修复方案。
- 单 SQLite 连接确保连接级外键设置一致，但也限制服务端数据库并发；大规模真实负载下的吞吐和 busy/timeout 策略尚未验收。
- 管理 token 仍只能通过密码哈希或签名密钥整体轮换撤销；management key 仍没有 key ID、重叠轮换或审计记录。
- 评论提交、审核和删除限流仍是单进程内存实现，重启清空，多实例不共享。
- `packages/client` 仍是旧生产界面实现，只获得 `deleted` 类型字段；尚未按照已批准的纯文本、无头像、无赞踩、线程式原型实现生产评论体验。
- `packages/admin` 仍是 mock 管理端，没有接入 P1/P2 API；不能用于生产审核或删除。
- P3 建议只聚焦“批准原型的生产评论 UI + 浏览器 SDK 契约收敛”，实现安全纯文本渲染、提交/pending 反馈、线程与墓碑显示、分页和可访问/响应式交互；继续不扩展完整管理后台、通知、部署或发布。

## 10. 版本控制与发布声明

- `D:\Forgejo\Ecoku\.git` 不存在；`git rev-parse --is-inside-work-tree` 返回退出码 128 和 `not a git repository`。
- 因此无法用 `git status` 精确区分 P0、P1、P2 与更早的本地差异，也没有提交级回滚保护。
- 所有 P2 代码、依赖、构建产物和文档变化均为未经提交的本地文件变化；没有执行 `git init`。
- 本阶段没有迁移真实数据库，没有部署、发布、线上验收、提交、推送、PR 或 release。
