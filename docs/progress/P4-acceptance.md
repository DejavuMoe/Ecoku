# Ecoku P4 验收记录

> 历史说明：本文记录最初 P4 范围，保留作证据，不再代表当前生产代码。批量审核、三态语义、
> 站点管理、通知与持久开发部署的最终事实见 `P4-final-acceptance.md`。

> 日期：2026-08-13
>
> 当前结论：P4 **通过验收**。管理端、服务端、浏览器 SDK、自托管材料、自动化测试、发布候选打包、本地真实浏览器流程及远端一次性容器门禁全部通过。本记录只证明当前源码在获批测试范围内达到本地 release-ready；不代表生产部署、发布、真实用户数据库迁移、真实反向代理或线上流量验收。

## 1. 用户确认的管理端、交付和发布边界

- P4 只实现实例管理员登录、站点选择、`pending` / `approved` / `rejected` / `deleted` 分页、详情、批准、拒绝和墓碑删除。
- 管理员仍是单实例管理员；不实现普通用户、RBAC、站点运营员、OAuth、通知、订阅、邮件发送、反垃圾平台或批量操作。
- 管理端 Bearer token 只保存在当前页面的内存中。刷新、关闭、显式退出、401 或到期时清除；不写入 localStorage、sessionStorage、cookie、URL 或日志。
- 站点发现接口只接受实例管理员 Bearer token，只公开站点 ID 和默认审核模式。站点 management key 仍只供受信任服务端调用，不进入管理浏览器。
- 管理 DTO 可以包含审核所需的私有邮箱，但不包含 IP、UA、地区、凭据、环境变量名、完整数据库模型或 User 对象。界面仅在评论详情中显示邮箱。
- Go 服务直接承载 `/admin/` 静态管理端；发布候选拓扑为一个非 root 运行容器，SQLite、配置和日志位于容器外持久位置。
- 默认不信任代理；只有 socket 对端精确匹配配置的 IP/CIDR 时才允许使用转发头。示例不允许任意代理网段。
- `users`、`email_verification_codes` 和 `counts` 历史表继续保留，不执行 `DROP TABLE` 或 `DROP COLUMN`。
- 浏览器 SDK 包名保持 `ecoku`，发布候选版本为破坏性版本 `3.0.0`，验证 ESM、UMD、CommonJS 和 TypeScript 声明。旧 DOM 协议的迁移方式写入 README、PUBLISH 和 CHANGELOG。
- P4 只形成本地 release-ready 材料。没有授权 npm 发布、镜像推送、Git tag、Release、服务器部署、真实数据库迁移或破坏性清理。
- 用户批准 `designs/admin-moderation/index.html` 当前原型。生产管理端按该原型的暖纸张、队列与详情分栏方向实现，并参考 `D:\Forgejo\Blog\designs\twikoo-theme-styles` 的视觉效果；没有继承其生产文件映射。
- 本地 Windows 环境没有 Docker。用户随后明确授权使用一次性 Debian 13 测试服务器 `us-slab`，并授权把过滤后的当前源码上传到隔离临时目录、执行容器验收，以及完成后删除对应临时目录、容器、镜像和卷。远端只使用生成的随机测试凭据和非真实个人数据。

上述长期边界已同步到 `docs/product/constraints.md`。`CODEBASE_ANALYSIS.md` 只作为旧快照参考，不是当前实现约束。

## 2. 最终管理 API 契约

所有接口继续使用 P0 的统一 JSON 外层结构和真实 HTTP 状态。

| 能力 | 请求 | 认证 | 结果边界 |
| --- | --- | --- | --- |
| 管理员登录 | `POST /api/admin/login` | 无会话；独立登录限流 | 成功返回短期 Bearer token 与明确到期时间；失败统一 401 |
| 站点发现 | `GET /api/admin/sites` | 仅实例管理员 Bearer | 只返回 `id`、`comment_default_status`；`EcokuSite` 返回 403 |
| 状态列表 | `GET /api/admin/sites/:siteId/comments?status=&page=&pageSize=` | Bearer 或本站 `EcokuSite` | 状态仅允许四种；按 `created_at ASC, id ASC` 稳定分页；只查目标站点 |
| 评论详情 | `GET /api/admin/sites/:siteId/comments/:commentId` | Bearer 或本站 `EcokuSite` | 评论必须属于路径站点；跨站点不泄露存在性 |
| 批准或拒绝 | `PATCH /api/admin/sites/:siteId/comments/:commentId` | Bearer 或本站 `EcokuSite` | body 仅接受 `approved` / `rejected`；相同操作幂等，终态反向修改 409 |
| 墓碑删除 | `DELETE /api/admin/sites/:siteId/comments/:commentId` | Bearer 或本站 `EcokuSite`，独立限流 | 重复删除幂等；清理个人数据并保留后代 |

补充约束：

- 每次显式验证站点注册和调用方站点权限；站点 key 不能发现其他站点。
- `page` 为 1～1,000,000，`pageSize` 为 1～100；未知状态、非法 ID 和无效 JSON 返回 400，超大请求返回 413。
- 401、403、404、409、413、429 和 500 均由真实 HTTP 状态表达，不把业务失败伪装为 200。
- 审核更新在站点、评论 ID、当前状态和非删除条件下检查 `RowsAffected`；批准回复继续验证完整祖先链。
- 公共 `includePending` 没有重新开放；公共 DTO 继续只返回 approved 评论与允许公开的 approved 墓碑，不含邮箱或管理字段。

## 3. 管理端认证、状态与隐私模型

管理端是实际 API 驱动的 Vue 应用，不再使用模拟用户、模拟评论、Count 或虚假仪表盘：

- 登录成功后只在 Pinia 当前运行实例内保存 token、类型和到期时间；没有持久化插件或浏览器存储回退。
- 显式退出、到期计时器和任一 401 都会取消请求、清空会话并返回登录界面。
- 站点、状态或分页变化会取消旧请求并递增请求世代，过期响应不能覆盖新选择；审核和删除按钮在请求中禁用，重复点击不会重复发送。
- 站点选择后可切换四种状态；队列、详情、空状态、加载、失败、重试、成功、冲突、限流和会话过期都有明确中文反馈。
- 正文、昵称、邮箱和错误消息按文本渲染。作者网站只接受 http/https，并使用 `nofollow ugc noopener noreferrer`。
- 墓碑只显示固定删除信息；删除后的邮箱、网站、昵称和原正文不会重新出现在管理或公共界面。
- 键盘可完成登录、选择、翻页、详情、审核、取消和确认；焦点在操作后恢复，状态通过 `aria-live` 报告；窄屏使用队列/详情切换。
- 生产 CSP 限制资源、连接和脚本为同源，禁止 frame、object 和 referrer；HTML 入口不缓存，指纹化 assets 使用 immutable 缓存。

## 4. 自托管拓扑与运维 SOP

发布候选拓扑：

1. 同机反向代理负责 TLS、Host 和外部 Origin，只转发到宿主机 loopback `127.0.0.1:12123`。
2. 单个 `ecoku` 容器运行 Go 服务，同时提供公开 API、管理 API、健康检查和 `/admin/` 静态文件。
3. 容器以 UID/GID `10001` 运行，根文件系统只读、移除全部 capabilities、启用 `no-new-privileges`；只有 `/data` 卷和受限 `/tmp` 可写。
4. `/app/config.yaml` 由宿主机只读挂载；SQLite 与应用日志保存到 `/data` 命名卷。镜像固定使用 UID/GID `10001`，因此不含秘密的配置文件必须对该 UID 可读；实际密码哈希和 key 仍只保存于权限为 `0600` 的 env 文件。
5. 默认 `trusted_proxies: []`。部署者必须先确认容器实际看到的 socket 对端，再配置精确代理 IP/CIDR；外部伪造 `X-Forwarded-For` 不能直接取得信任。

交付材料：

- `Dockerfile`：Node 管理端构建、Go 静态服务构建和最小 Alpine 运行时的多阶段构建。
- `compose.yaml`：loopback 端口、只读配置、命名数据卷、健康检查和运行时加固。
- `deploy/config.yaml.example`：SQLite、站点注册表、独立管理 Origin、显式静态目录和空可信代理配置。
- `deploy/ecoku.env.example`：故意为空并 fail-closed；私密值使用单引号，避免 bcrypt `$` 被 Compose 插值。
- `docs/operations/self-hosting.md`：首次配置、凭据生成与轮换、Origin/TLS/Host/可信代理边界。
- `docs/operations/backup-and-upgrade.md`：停服备份、SHA-256 校验、显式迁移、失败恢复和临时卷演练。

本地 Go 自动化和远端真实容器分别完成了备份恢复验证。远端测试覆盖空卷初始化、容器重启持久性、停服卷外备份、SHA-256、SQLite integrity、独立新卷恢复、线程/审核/墓碑复核、原卷恢复，以及容器内 `migrate --backup`。没有用本地 fixture 代替容器证据。

## 5. SDK/package 兼容矩阵

| 消费方式 | 元数据/产物 | 已有证据 |
| --- | --- | --- |
| ESM | `exports.import` → `dist/ecoku.es.js` | package 契约测试与临时消费项目导入通过 |
| CommonJS | `main` / `exports.require` → `dist/ecoku.cjs` | package 契约测试与临时消费项目 `require` 通过 |
| 浏览器 script-tag | `dist/ecoku.umd.js`，全局名 `Ecoku` | UMD 契约测试通过 |
| TypeScript | `types` / `exports.types` → `dist/ecoku.d.ts` | 类型检查与声明构建通过 |

- `type: module` 不再把 CommonJS 入口错误指向 `.js`；真实 CommonJS 入口为 `.cjs`。
- `npm pack --dry-run` 得到 `ecoku@3.0.0`、19 个文件、39.4 kB 压缩包，只含允许的 `dist/`、README、CHANGELOG、LICENSE 和 package.json。
- 另一次实际本地 `npm pack` 安装到一次性消费目录后，ESM 与 CommonJS 导入均通过；归档和消费目录已删除，没有发布。
- 根工作区是 `private: true`，没有根级发布命令；自动化只生成 release-candidate 构件。

## 6. 修改和删除文件

仓库没有 Git，以下清单根据 P4 实际操作记录整理，不能由提交差异重建。

### 服务端与管理 API

- `server/config/config.go`
- `server/config.yaml.example`
- `server/go.mod`
- `server/handle/admin/moderation.go`
- `server/handle/admin/sites.go`（新增）
- `server/middleware/admin_auth.go`
- `server/middleware/rate_limit.go`
- `server/routes/routes.go`
- `server/routes/admin_routes_test.go`
- `server/routes/routes_test.go`
- `server/model/migrations_test.go`

### 生产管理端

- `packages/admin/index.html`
- `packages/admin/package.json`
- `packages/admin/README.md`
- `packages/admin/vite.config.ts`
- `packages/admin/src/main.ts`
- `packages/admin/src/App.vue`
- `packages/admin/src/api.ts`（新增）
- `packages/admin/src/messages.ts`（新增）
- `packages/admin/src/types.ts`
- `packages/admin/src/stores/admin.ts`
- `packages/admin/src/style.css`
- `packages/admin/src/admin.test.ts`（新增）
- `packages/admin/dist/**`（生产构建重新生成）

P4 删除了旧 mock 管理端仍存的 router、布局、模拟 dashboard/users/comments views 和通用模拟组件，以及未使用的 public favicon/icons。P0 已删除的 Count 页面没有重新引入。`src/assets` 中未引用的 Vite 模板图片没有进入生产构建。

### SDK、工作区与发布候选

- `packages/client/package.json`
- `packages/client/README.md`
- `packages/client/PUBLISH.md`
- `packages/client/CHANGELOG.md`（新增）
- `packages/client/scripts/sync-cjs.mjs`（新增）
- `packages/client/scripts/test-package-contract.mjs`（新增）
- `packages/client/scripts/pre-publish.cjs`
- `packages/client/dist/**`（生产构建重新生成）
- `package.json`
- `pnpm-lock.yaml`

### 自托管、自动化、原型与文档

- `Dockerfile`（新增）
- `compose.yaml`（新增）
- `.dockerignore`（新增）
- `.gitignore`
- `deploy/config.yaml.example`（新增）
- `deploy/ecoku.env.example`（新增）
- `.github/workflows/release-candidate.yml`（新增）
- `README.md`
- `docs/operations/self-hosting.md`（新增）
- `docs/operations/backup-and-upgrade.md`（新增）
- `docs/product/constraints.md`
- `designs/admin-moderation/**`（已批准原型、元数据与 UI 合同）
- `designs/plain-thread-comments/ui-contract.json`
- `docs/progress/P4-acceptance.md`（本文件）

## 7. 自动化验证通过项

最终本地环境：Go `1.26.5 windows/amd64`、Node `24.18.0`、pnpm `11.3.0`、npm `11.16.0`。

### 服务端

```text
cd server
go test -count=1 ./...   -> 0；59 个 Go Test 函数所在包全部通过
go vet ./...             -> 0
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -> 0；一次性产物已删除
```

最终重跑时 Windows 默认 Go 缓存仍被之前并行检查占用，首次和随后默认缓存尝试均因 `Access is denied` 在 setup 阶段失败，未执行测试断言。改用仓库内一次性独立 `GOCACHE` 且顺序执行后，test、vet 和 build 均为 0，缓存与产物随后删除。该失败不计作测试断言通过，也没有被隐去。

自动化覆盖包括：

- 登录成功/失败/独立限流、token 到期、篡改和凭据轮换失效；
- Bearer-only 站点发现及敏感字段排除；
- 四状态筛选、稳定分页、跨站点隔离、管理/公共 DTO 分离；
- 批准、拒绝、祖先链、幂等、并发冲突、墓碑隐私与后代保留；
- 400/401/403/404/409/413/429/500 和统一响应；
- SQLite 空库迁移、历史 fixture、重复迁移、未来版本拒绝、失败不记版本、备份和恢复；
- CORS、请求体限制、socket 限流、精确可信代理与伪造转发头；
- 普通用户和 Count 生产路由缺失、默认日志脱敏、公共 approved-only 和深层线程。

### 浏览器 client

```text
pnpm run test          -> 2 files / 18 tests passed
pnpm run type-check    -> 0
pnpm run build         -> ESM 40.40 kB (gzip 11.56), UMD/CJS 35.83 kB (gzip 10.89)
pnpm run test:package  -> ESM、UMD、CommonJS、声明契约通过
pnpm run validate      -> 发布候选文件与元数据通过
```

P3 的 approved 深层线程、pending/rejected 防御过滤、墓碑后代、XSS 文本渲染、提交参数、错误状态、重复提交、页面切换竞态、安全网站链接和浏览器隐私测试全部继续通过。

### 生产管理端

```text
pnpm run test        -> 1 file / 10 tests passed
pnpm run type-check  -> 0
pnpm run build       -> index 0.46 kB；CSS 15.53 kB；JS 89.77 kB
```

自动化覆盖正确/错误登录、内存 token、401 和自动到期清理、站点字段白名单、四状态与分页调用、异步竞态、重复操作、409/429/500/网络失败、墓碑幂等、邮箱详情边界、安全文本渲染、键盘语义和 mock/Count 生产导航缺失。

### 锁文件、原型与静态检查

- `pnpm install --frozen-lockfile --offline`：三个 workspace 项目均为最新，退出 0。
- 原型批准校验：`APPROVED: Ecoku admin moderation -> index.html`。
- UI 合同校验：两个已批准 surface 均指向存在的生产实现，结果为 `Contract check passed (2 surfaces)`。
- 管理端生产构建不含 mock 用户、Count 或虚假仪表盘字符串。
- 运行时代码/产物检查没有第三方 IP、头像、遥测或 management key 请求路径；测试中的恶意字段 fixture 和拒绝断言不计为生产调用。
- 服务端生产路由没有普通用户或 Count 入口，没有 MySQL 或 `AutoMigrate` 运行代码；历史兼容输入只存在于拒绝/隐私回归测试和注释。
- `server/config.yaml`、`deploy/config.yaml`、`deploy/ecoku.env`、测试 SQLite、日志、临时二进制和 npm tarball 均不存在。`.pnpm-store/v11/index.db` 是被忽略且不进入构建上下文的本地 pnpm 包索引，不是 Ecoku 数据库或发布构件。
- root、client 和 admin 都没有 `lint` 脚本；本记录不伪造 lint 通过。

## 8. 本地浏览器与人工验证通过项

使用一次性 loopback-only Go 启动器、临时 SQLite fixture、真实服务端路由、生产 admin 构建和 client Vite 页面完成联动验收。所有临时配置、数据库、日志、启动器、二进制和进程均已清理。

实际覆盖：

- 错误登录得到统一 401；正确登录后加载站点；刷新清除内存会话；显式登出回到登录。
- pending 根评论由公开页面提交后不公开；管理端能在正确站点/状态查看详情，邮箱只在详情出现，恶意 HTML/script 字符串只显示为文本。
- 批准根评论后公共页面可读；提交并批准子回复后保持线程关系。
- 墓碑化根评论后，管理端 deleted 状态只见固定墓碑，邮箱/网站/正文被清空；公共线程保留固定墓碑及 approved 后代。
- rejected 评论保持不公开；外部同站点服务端调用先改变状态后，管理端旧操作明确显示 409；重复墓碑调用返回成功且 `unchanged: true`。
- 桌面与 390px 窄屏覆盖队列/详情、键盘 Enter、焦点和响应式切换。
- 管理与公开页面控制台均无错误；实际访问日志只含 method/path/status/duration，没有邮箱、正文、token 或凭据。
- 网络只访问 loopback 的 `/admin/assets`、`/api/admin` 和 `/api/comment`；没有第三方 IP、头像、字体、遥测或 management key 请求。
- 最终生产 admin 构建再次由本地静态服务打开，登录页非空、标题正确、视觉符合已批准原型且控制台无警告/错误。

生产 CSP 的 `frame-ancestors 'none'` 正确阻止 iframe。因此 390px 验收使用开发代理和一次性同源外壳完成；这不是绕过生产 CSP，生产构建本身另行完成静态、安全头和登录页检查。

## 9. 打包与容器验证

### 已通过的打包项

- `npm pack --dry-run` 最终退出 0：`ecoku-3.0.0.tgz` 仅列出 19 个允许文件，39.4 kB；dry-run 没有留下 tarball。
- 第一次最终 dry-run 因本机 npm 全局日志目录不可写而退出 1；改用一次性隔离 npm cache 后通过，缓存已删除。这不是包内容或脚本失败。
- 实际本地 pack + 一次性消费项目的 ESM/CJS 验证此前通过，所有临时归档和目录已删除。
- Dockerfile、Compose、部署示例和 release-candidate workflow 已通过 YAML/配置文件静态解析；没有把静态解析描述成容器执行。

### 远端容器环境和源码边界

- 主机：Debian GNU/Linux 13、x86_64、1 vCPU、约 967 MiB RAM、2 GiB swap、验收前约 13 GiB 磁盘可用。
- 运行时：Docker Engine `26.1.5+dfsg1`；服务器最初没有 Compose，验收时安装 Debian `docker-compose 2.26.1-4`。测试结束后已卸载本次新增的 Compose、jq、sqlite3 和 apache2-utils，并删除全部 Ecoku 临时资源。
- 服务器验收前没有容器或卷；既有 `postgres:18.3-alpine` 和 `testcontainers/ryuk:0.14.0` 镜像不属于本任务，未删除或修改。
- 本地归档只含 92 个构建所需条目、448,512 bytes，明确排除 `.git`、私有配置、数据库、日志、node_modules、缓存、dist 和归档产物。上传前后 SHA-256 均为 `1db0de15d14a78a995622527eb2d1f9a0f3d6977e02a64c399237375047f5b2a`；本地归档上传后立即删除。
- 一次性管理员密码、bcrypt 哈希、token key 和 management key 只在远端权限为 `0600` 的私有文件中生成和使用，没有输出到聊天、命令参数、镜像层或仓库。

### Compose、构建和镜像

```text
docker compose config --quiet       -> 0
docker compose build --pull         -> 0；约 84.7 秒
```

- Compose 真实模型断言通过：只读根、`cap_drop: ALL`、`no-new-privileges:true`、loopback 端口、只读配置挂载、命名 `/data` 卷、健康检查以及四个非空运行时环境变量。
- 候选镜像 ID 为 `sha256:f95ef75c06a7220f2bde69cd1e57aef58619ac6545848d6c069d022115e712bc`，大小 23,402,461 bytes。
- 实际拉取并构建的基础镜像 manifest：Node `sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43`、Go `sha256:0178a641fbb4858c5f1b48e34bdaabe0350a330a1b1149aabd498d0699ff5fb2`、Alpine `sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b`。
- 镜像默认用户 `10001:10001`、入口 `/app/ecoku-server`。镜像含服务端与 admin 指纹资源，不含 `/src`、配置、数据库、日志或 env；四项一次性秘密在 `docker save` 层扫描中均不存在。

### 运行时、HTTP 和网络边界

- 全新命名卷可初始化到 schema v1，SQLite 文件归 `10001:10001`；健康检查达到 `healthy`。
- 容器 PID 1 的 `CapEff` 为全零、`NoNewPrivs` 为 1；`/app` 不可写，受限 `/tmp` 和 `/data` 可写；配置挂载只读。
- 宿主机只监听 `127.0.0.1:12123`，没有 `0.0.0.0` 或 IPv6 任意地址监听。
- 无任何安全环境变量时，镜像明确非零退出并报告配置初始化失败；仓库不存在可用默认密码或 key。
- `/admin/` 的 CSP、`no-store`、`no-referrer`、`nosniff` 及 assets immutable 缓存通过真实 HTTP 检查。
- 错误/正确登录、Bearer-only 站点发现、站点 DTO 字段白名单、management key 禁止实例发现、公开与管理 Origin 隔离均通过。
- 真实容器流程覆盖 pending 提交不公开、pending 管理详情含私有邮箱、批准、重复批准幂等、终态反向操作 409、子回复批准、rejected 不公开、墓碑重复删除幂等、墓碑清理个人字段以及 approved 后代继续公开。
- 公共 DTO 在容器响应中不含邮箱和管理状态；恶意 `<script>` 哨兵只作为正文数据保存，不进入日志或额外执行路径。
- 容器重启后根评论、子回复、审核状态和墓碑均保留。
- 70 KiB 请求返回 413；评论提交和管理员登录分别使用不同伪造 `X-Forwarded-For` 连续请求仍返回 429，证明默认 socket 限流不会信任任意转发头。
- 容器 stdout 和 `/data/ecoku.log` 的最终扫描均不含密码、token、哈希、management key、Authorization、测试邮箱或评论正文哨兵。

### 备份、恢复与显式迁移

- 服务停止后数据卷没有 `-wal`、`-shm` 或 `-journal`；受限 UID 10001 helper 把 SQLite 复制到卷外，备份 SHA-256 为 `a7d9c07b9138921b84d097bfbdc0f666c01cd95412baf6ede3a7fba493bfd4f2`。
- `PRAGMA integrity_check` 返回 `ok`，schema 版本为 1；备份中三条 fixture 的 approved/rejected、父关系和墓碑隐私字段符合预期。
- 备份恢复到独立全新命名卷和独立 hardened 容器后，公开墓碑/后代及管理 rejected 状态均通过 API 复核；临时恢复容器和卷随后删除。
- 原卷重新启动后数据不变且恢复健康。
- `docker compose run --rm --no-deps ecoku migrate --backup /data/ecoku-pre-migrate.sqlite3` 对停止的测试卷成功执行；生成备份与源库 SHA-256 相同，测试备份随后删除，原服务再次恢复健康。

### 验收中发现并处理的问题

- 首次容器启动发现自托管文档同时要求固定非 root UID 与 `config.yaml` 权限 `0600`，导致 UID 10001 无法读取只读绑定配置。这是实际交付缺陷。已把无秘密配置文件示例改为可由容器读取的 `0644`，保留秘密 env 为 `0600`，并从删除后的全新卷重测通过。
- 远端一次性 env 生成器曾引入多余空格、容器健康测试曾错误预期 `ok`、Alpine BusyBox helper 曾使用不支持的 `find -quit` / `cut` 参数、独立 `docker run --env-file` 与 Compose 对单引号的解析不同。这些均属于验收脚本问题；每次都保留失败现场、定位后修正临时 harness，并从安全检查点重跑，未据此修改产品认证或数据库逻辑。

## 10. 条件性验证项

- `.github/workflows/release-candidate.yml` 使用只读权限，执行锁文件安装、Go/client/admin 门禁、Compose 配置检查、镜像构建和候选 artifact 上传，不包含 tag、release、publish 或 push。它尚未在任何 CI runner 真实执行；Forgejo Actions 对 GitHub artifact action 的兼容性尤其需要目标 runner 验证。
- Dockerfile 的三个基础镜像已在 linux/amd64 远端实际拉取并记录 manifest，候选镜像已构建；供应链漏洞扫描、SBOM、签名和其他架构构建仍不属于已通过证据。
- 真实反向代理直接对端、TLS、Host 和 Origin 组合只能在明确部署环境中验证；P4 没有部署授权。
- 浏览器验收使用一次性非真实个人数据 fixture；真实流量、可用性、长时间运行和性能没有验收。

## 11. 备份、恢复和失败处理

- 空库由显式版本迁移初始化；非空无版本库、版本缺口、未来版本、校验和变化和非法历史关系都会失败关闭。
- 真实升级前必须停服，确认 SQLite 没有 `-wal` / `-shm` / `-journal` 边车，创建数据卷外的新备份并记录 SHA-256。
- 既有数据库只允许通过 `ecoku migrate --backup <新文件>` 显式迁移；退出码非 0 时不得启动新版本或手工篡改迁移记录。
- 恢复会覆盖数据，必须另存失败现场、先在独立临时卷验证备份，并由独立检查复核卷名、目标路径和哈希。
- 本地 fixture 与远端一次性容器备份/恢复均通过。远端只包含本阶段生成的三条虚拟评论；没有对用户实际数据库执行备份、迁移、恢复或删除。

## 12. 未解决风险与下一步

P4 没有未通过的强制门禁。仍需保留以下发布和运行风险：

- token 撤销依赖凭据轮换并重启；没有在线黑名单或 refresh token。
- 限流仍是单进程内存固定窗口，重启后清空。
- 历史表默认保留；物理删除需要独立破坏性授权。
- CI 目标 runner 兼容性仍为条件性验证；当前没有 Forgejo 或 GitHub runner 的实际执行证据。
- 已记录 linux/amd64 基础镜像 manifest，但没有漏洞扫描、SBOM、签名或 digest-pinned Dockerfile；发布时仍需根据供应链政策单独决定。
- 通知、订阅、普通用户、RBAC、OAuth、站点运营员和反垃圾平台仍不在产品范围。

## 13. 版本控制、迁移与发布声明

- P4 通过验收时，`D:\Forgejo\Ecoku\.git` 不存在，P0～P4 文件没有提交级回滚保护。
- 2026-08-13，用户在 P4 验收完成后另行授权初始化本地 Git，并允许按必要边界分次提交；仓库随后以 `main` 为初始分支，按获批原型、服务端、生产 Web 界面、自托管交付和验收文档拆分历史。
- 该后续版本控制操作不属于 P4 容器验收，也不改变本记录中各项验证发生时的证据边界；没有配置远程仓库、推送、创建 PR、tag、Release 或发布制品。
- 只对一次性测试 SQLite fixture 执行了初始化、备份、显式迁移和恢复；没有对真实数据库执行迁移、备份、恢复或破坏性操作。
- 只在用户明确授权的一次性 Debian 13 测试服务器启动候选容器完成验收；这不构成生产或持久部署。没有发布 npm、推送镜像、创建 tag、PR、Release 或进行线上验收。
- 远端验收结束后已删除 Ecoku 容器、网络、数据卷、候选镜像、测试 Alpine 镜像、源码/凭据临时目录，并卸载本次新增的验收工具；验收前已存在的 PostgreSQL 与 Ryuk 镜像保持不变。
