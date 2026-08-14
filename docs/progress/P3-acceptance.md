# Ecoku P3 验收记录

> 日期：2026-08-12
>
> 结论：P3 **通过本地代码、自动化与浏览器验收**。本记录不代表部署、发布、线上、真实用户数据库或生产流量验收。

## 1. 用户确认的 UI 与 SDK 边界

- P3 只完成“批准原型的生产评论 UI + 浏览器 SDK 契约收敛”，不实现完整管理后台、通知、部署、发布或 P4 工作。
- 生产界面采用 `designs/plain-thread-comments` 已批准的纯文本、无头像、无赞踩、线程式方向；不继承 Blog、PaperMod 或 Twikoo 文件映射。
- 嵌入方显式提供容器、`serverURL`、`siteId` 和页面 `pageKey`；SDK 不猜测规范页面 key。
- 公共列表继续按根线程分页，客户端使用“加载更多”，每批包含该批根评论的全部 approved 后代。
- 回复保持无限语义层级；桌面与窄屏的视觉缩进都最多三级，更深节点仍有正确父子关系和 `aria-level`。
- 提交成功后不乐观伪造公开评论；先显示“评论已提交，可能需要审核后显示”，再刷新当前线程。auto 站点刷新后自然显示，pending 站点不会公开显示。
- 正文只按文本显示并保留换行，不解析 HTML、Markdown 或自动链接。作者网站只允许 http/https，并使用 `nofollow ugc noopener noreferrer`。
- 昵称、邮箱和网站只在当前组件实例内存中共享给根评论和回复；不写入 localStorage、cookie 或 URL，刷新后不保留。
- 墓碑只显示固定文案与后代，不显示网站、原作者或回复入口，也不能向墓碑提交回复。
- P3 提供集中管理的完整中文文案；正式多语言系统后置。
- 公共列表新增向后兼容的 `sort=oldest|newest`。API 未传时保持 `newest`，生产 UI 默认显式使用 `oldest`。
- `total` 保持根线程数，新增 `commentTotal` 表示从 approved 根节点可达的全部公开评论数。
- 根评论保留完整身份表单；回复使用共享内存身份和正文-only 内联表单。P3 UI 正文限制为 1000 个 Unicode 字符，服务端仍保留 10000 字符上限。
- 保留默认导出 `Ecoku`、`init()`、`reload()` 与 `isInitialized()`，新增 `setPageKey()` 和 `destroy()`；`apiBaseUrl` 是弃用兼容别名，早期 DOM 扫描协议不再运行。
- 主题通过 `auto`、`light`、`dark` 配置，不提供生产主题切换器或持久化。
- 客户端测试采用 Vitest + happy-dom，不引入 UI 框架；client 与 admin 均没有 lint 脚本，不伪造 lint 通过。

这些长期边界已同步到 `docs/product/constraints.md`。

## 2. 生产 UI 状态与交互契约

生产评论组件覆盖：

- 首次加载、空列表、加载失败、重新加载和加载更多；
- 根评论填写、客户端体验校验、提交中禁用、成功提示和服务器错误映射；
- 根线程、任意深度后代、折叠/展开、永久链接和 inline 回复；
- 回复打开后聚焦正文，取消后恢复到原回复按钮；身份缺失时聚焦顶部昵称并关联错误；
- approved 墓碑固定显示且保留后代；墓碑没有作者网站和回复按钮；
- pending/rejected 防御性过滤，即使异常公共响应带入也不会渲染；
- `400`、`403`、`413`、`429`、`500` 和网络失败的中文反馈；
- 排序切换、根线程分页和每批完整后代；
- `aria-live` 状态、语义表单、可见焦点、键盘操作、窄屏布局和 `prefers-reduced-motion`。

组件对并发和生命周期的处理：

- 提交中禁用相关控件并阻止重复请求；
- 刷新评论使用独立请求，不延迟成功提示；
- 页面 key 或排序变化会中止旧请求并递增请求版本，旧响应不能覆盖新页面；
- `destroy()` 中止请求、撤销事件和容器所有权，销毁后不更新 DOM；
- 同一容器同一时间只允许一个 `Ecoku` 实例。

## 3. SDK 和公共 API 映射

最小嵌入契约：

```ts
import Ecoku from 'ecoku'

const comments = new Ecoku({
  container: document.querySelector('#comments')!,
  serverURL: 'https://comments.example.com/',
  siteId: 'example-site',
  pageKey: 'article/stable-key',
  pageSize: 20,
  theme: 'auto',
})

await comments.init()
await comments.reload()
await comments.setPageKey('article/another-key')
comments.destroy()
```

配置在构造时验证：

- 容器必须是连接到当前文档的 HTMLElement；
- `serverURL` 只接受无用户名、密码、query 或 fragment 的 http/https URL；
- `siteId` 必须符合服务端注册表格式；
- `pageKey` 必填且受长度限制；
- `pageSize` 为正整数且不超过服务端上限；
- `theme` 只接受 `auto`、`light`、`dark`。

公共 API：

| UI 操作 | 请求 | 关键字段 |
| --- | --- | --- |
| 初始读取、排序、加载更多、刷新 | `GET /api/comment/list` | `siteId`、`key`、`page`、`pageSize`、`sort` |
| 根评论 | `POST /api/comment/submit` | `siteId`、`mark`、`username`、`email`、`url`、`content`、`parent: 0` |
| 回复 | `POST /api/comment/submit` | 同上，`parent` 为目标评论 ID |

列表响应继续使用统一 JSON 外层结构。`total` 是 approved 根线程数，`commentTotal` 只统计从 approved 根节点可达的 approved 评论；历史异常的“pending/rejected 祖先下 approved 子评论”既不返回也不计数。`pageCount` 仍按根线程计算。

## 4. 安全渲染与隐私结果

- 昵称、正文、错误和状态都通过 `textContent` 或等价文本节点渲染；运行时代码没有 `innerHTML` 注入路径。
- `<script>`、HTML 标签和 Markdown 标记只显示为普通文本；浏览器验收中未创建评论来源的 script 节点，也未执行测试哨兵。
- 公开列表不会渲染或保存响应中的邮箱、状态、管理字段或完整数据库对象。
- 浏览器请求只发送公开评论契约字段；不发送 management key、Authorization、客户端 IP、UA、地区或用户 ID。
- client 源码和构建产物不请求第三方 IP、头像、字体、分析、遥测或其他第三方运行时资源。
- 作者网站在服务端和客户端双重限制为 http/https；链接使用 `target="_blank"` 与 `rel="nofollow ugc noopener noreferrer"`。
- localStorage、sessionStorage、cookie 和 URL 中都不持久化访客身份。
- 请求错误只显示统一 API 消息或本地固定文案，不直接渲染不可信 HTML。

## 5. 修改文件

仓库没有 Git，以下清单根据 P3 实际操作记录整理，无法用提交差异重建。

### 服务端向后兼容扩展

- `server/handle/comment/list.go`
- `server/handle/comment/comment_test.go`

只新增列表排序、`commentTotal` 以及对应测试；没有修改 Comment schema、迁移版本或墓碑保留语义。

### 浏览器 SDK 与生产 UI

- `packages/client/package.json`
- `packages/client/tsconfig.json`
- `packages/client/vitest.config.ts`（新增）
- `packages/client/index.html`
- `packages/client/README.md`
- `packages/client/PUBLISH.md`
- `packages/client/src/config.ts`
- `packages/client/src/util.ts`
- `packages/client/src/messages.ts`（新增）
- `packages/client/src/fetch.ts`
- `packages/client/src/comment.ts`
- `packages/client/src/style.css`
- `packages/client/src/ecoku.ts`
- `packages/client/src/main.ts`
- `packages/client/src/demo.css`（新增）
- `packages/client/src/ecoku.test.ts`（新增）
- `packages/client/src/security-source.test.ts`（新增）
- `packages/client/dist/**`（生产构建重新生成）
- `pnpm-lock.yaml`

### 原型与持续记录

- `designs/plain-thread-comments/ui-contract.json`
- `docs/product/constraints.md`
- `docs/progress/P3-acceptance.md`（本文件）

### 仅由验收构建生成

- `packages/admin/dist/**`

admin 源码没有在 P3 接入 API，现有管理端仍不能描述为生产管理后台。

## 6. 自动化验证

环境：Go `1.26.5 windows/amd64`、Node.js `24.18.0`、pnpm `11.3.0`。

最终执行：

```text
cd server
go test -count=1 ./...
go vet ./...

cd packages/client
pnpm run test
pnpm run type-check
pnpm run build
pnpm run validate

cd packages/admin
pnpm run build
```

结果：

- `go test -count=1 ./...`：退出码 0；config、comment、middleware、model、routes、utils 全部通过，其余包明确为 `[no test files]`。
- `go vet ./...`：退出码 0，无诊断。
- client test：2 个测试文件、18 项测试全部通过。
- client type-check：退出码 0，`tsc --noEmit` 通过。
- client production build：退出码 0；ES 40.40 kB（gzip 11.56 kB），UMD 35.83 kB（gzip 10.89 kB），声明文件构建通过。
- client `validate`：退出码 0；构建文件、README、LICENSE 和 package 元数据检查通过。脚本自身输出“Ready to publish”只是既有提示，本阶段没有发布。
- admin build：退出码 0；`vue-tsc -b` 和 Vite production build 通过，50 个模块转换成功。

自动化覆盖并通过：

- approved 根评论和四层以上后代渲染，视觉缩进上限和语义层级分离；
- pending/rejected 防御性不显示，邮箱和管理字段不渲染；
- HTML/script 仅作为文本，墓碑固定显示、保留后代且无回复入口；
- 安全与不安全作者 URL、批准协议和完整 `rel`；
- 根评论与回复的精确提交字段和 parent ID；
- 成功、400、403、413、429、500 与网络失败状态；
- 重复点击不重复提交，提交期间控件禁用，慢刷新不延迟成功反馈；
- 页面 key 变化时旧请求不能覆盖新页面；
- 根线程加载更多与完整后代；
- 身份不写入 localStorage、cookie 或 URL；
- 浏览器运行时代码不存在第三方 IP、management key、Authorization、转发头、头像、遥测或 `innerHTML`。
- API 默认 newest、显式 oldest/newest、非法 sort 400、根线程总数与公开评论总数分离；不可达的异常 approved 子评论不计入 `commentTotal`。
- P0～P2 的 SQLite 迁移、墓碑、公开隐私、父关系、深层回复、Count/普通用户路由 404、CORS、限流、管理员认证、站点隔离和审核测试继续通过。

源码级扫描通过：

- client `src` 运行时与 `dist` 不含第三方 IP、管理凭据、Authorization、X-Forwarded-For、头像、分析或遥测入口；
- 生产服务端仍只支持 SQLite3，不包含 MySQL 驱动或 `AutoMigrate`；
- 普通用户和 Count 生产路由仍不存在；
- `ui-contract.json` 可解析，原型状态为 `approved`，production 状态为 `implemented`；
- `.git` 仍不存在。

### 验证过程中的非产品失败

- 首次定向 Go 命令在 `server` 工作目录中错误地重复写了 `server/` 路径，同时默认 Go cache 被沙箱拒绝；改用正确相对路径和任务专用临时 cache 后通过。
- 首次静态扫描把测试中的“拒绝 MySQL/旧路由”字符串和不存在的根目录 `go.mod` 混入范围；修正为生产文件范围后通过。
- 内置浏览器的自动化 `press(Enter/Tab)` 只改变焦点、不触发 Chromium 原生默认动作。随后使用隔离无头 Chrome 的原生 CDP 键盘事件验收；早期脚本因把文案“重新加载”误写为“重试”而停止，改用实际中文文案后完成相关观察。以上均未发现产品代码失败。

## 7. 本地浏览器与人工验收

### 内置浏览器

使用临时 SQLite、auto 与 pending 测试站点和本地生产构建完成：

- 桌面布局和 360×800 窄屏；窄屏无横向溢出，身份表单转单列，最深视觉缩进为 42px（三层）；
- light、dark 与 auto 配置；dark 的 `color-scheme` 和主题变量生效；
- 空状态、服务失败、重新加载、加载更多、auto 根评论、pending 提交反馈和五层回复；
- approved 墓碑无回复入口、后代继续显示；
- hostile `<script>` 文本不执行，页面 script 节点没有评论注入；
- 作者网站链接的协议、target 和 rel；
- 缺少共享身份时聚焦昵称，回复打开聚焦正文，取消恢复焦点；
- `aria-live` 区域存在，生产静态构建控制台无 error/warning；
- 网络资源只包含本地 JS/CSS 和 Ecoku API，没有第三方 IP、头像、字体、遥测或管理凭据请求。

开发服务器最初出现的 HMR websocket 噪声通过生产静态构建复验排除；生产构建控制台为空。

### 隔离无头 Chrome 键盘补验

通过 Chrome 原生键盘事件验证：

- Tab 顺序可到达排序、昵称、邮箱、网站、正文和发布按钮；Space 在聚焦的原生按钮上提交根评论；
- 页面 `keyboard3` 产生 1 个公开根评论，私有测试邮箱不在公开 JSON；
- 回复按钮可由键盘激活，inline textarea 获得焦点，取消按钮关闭表单并恢复回复按钮焦点；取消内容未持久化；
- 页面 `keyboard2` 最终为 4 个公开根线程、5 条公开评论，包含键盘提交的深层回复；
- “加载更多”可由键盘激活，当前根线程从 3 增至 4；
- 服务错误时“重新加载”按钮获得焦点，键盘激活后进入新的加载状态；
- polite/status live region 在加载和错误状态存在。

Chrome、Vite、临时 Ecoku 服务、临时 SQLite、测试二进制、测试日志、临时 `config.yaml` 和隔离 Chrome profile 在验收后全部停止并删除；端口 5174、12124、9223 不再监听。

## 8. 与批准原型的差异

- 原型页面包含文章上下文、主题演示和服务状态切换按钮；生产 SDK 只拥有嵌入容器内的评论区，文章与站点导航由宿主页面负责。
- 原型使用演示数据；生产实现只读取真实 API，不保留 mock 评论或乐观伪造。
- 原型可演示持久身份；P3 按隐私确认不持久化身份，刷新后表单为空。
- 生产回复框只输入正文，身份由当前实例顶部表单共享；这比原型的重复身份字段更紧凑。
- 生产 UI 使用 1000 字符体验限制，服务端仍以 10000 字符作为安全上限。
- 生产主题由构造配置决定，不包含原型的可见切换器或主题存储。

这些差异均来自用户在 P3 集中确认的边界，不是未实现缺口。

## 9. 条件性验证与尚未验证

### 条件性验证

- 真实站点嵌入必须把宿主 Origin 精确加入对应站点 `allowed_origins`；本地测试只验证了隔离 localhost 来源。
- 页面 key 必须由宿主应用提供稳定且规范化的值；SDK 有意不替宿主决定 URL、语言、预览或 canonical 规则。
- 大线程性能取决于每个根线程的后代规模；分页限制根线程数，但不会截断单个线程。
- npm 当前版本仍为 `2.1.1`。旧 DOM 协议移除属于破坏性变化，后续发布必须在 P4 单独确认版本与迁移说明。

### 尚未验证

- 没有 NVDA、JAWS、VoiceOver 等真实辅助技术审读；语义、焦点和 aria-live 已由 DOM 测试与 Chrome 验收覆盖，但不等同于屏幕阅读器认证。
- 没有 Firefox、Safari、iOS/Android 实机或低性能设备验收。
- 没有从 npm registry 发布后安装到第三方宿主，也没有验证现有 package 元数据声明的 CommonJS `require` 消费路径。
- 没有真实用户 SQLite、生产站点 CORS、反向代理、TLS、CSP、缓存、负载或多实例验收。
- 没有接入、重写或视觉验收 `packages/admin`；其源码仍为 mock 管理端。
- 没有 Docker、部署、发布、线上验收、真实数据库迁移、提交、推送、PR 或 release。

### 项目不存在的门禁

- client 现在有 `test` 和 `type-check`，但没有 `lint` 脚本。
- admin 只有 `build`；没有独立 `lint`、`test` 或 `type-check` 脚本。build 内部运行 `vue-tsc -b`。

## 10. 未解决风险与明确留给 P4 的事项

- `packages/admin` 仍是 mock 数据界面。P4 应在重新确认管理员会话存储、站点选择与审核范围后，接入 P1/P2 API，至少完成登录、pending 列表/详情、批准、拒绝和墓碑删除的生产闭环。
- 当前 npm 包的 `type: module`、UMD `main/require` 声明需要在发布前做真实 ESM、script-tag 和 CommonJS 消费矩阵验证，并结合破坏性 DOM 协议移除决定主版本号。
- 自托管交付尚缺最终运行方式、静态资源承载、反向代理可信边界、SQLite 卷/备份/恢复、健康检查和升级 SOP 的批准与端到端验收。
- 历史 `users`、`email_verification_codes` 和 `counts` 表仍被保留；任何 DROP 都必须在 P4 单独获得破坏性授权并提供备份/恢复证据。
- 管理 token 仍通过整体凭据轮换撤销；management key 没有 key ID、重叠轮换或审计记录。
- 限流仍是单进程内存实现；多实例、共享限流和反垃圾平台不属于当前 MVP。
- 通知、订阅、普通用户、RBAC、OAuth 和站点运营员不应因 P4 收尾而默认进入范围。

建议 P4 聚焦“最小生产管理端 + 自托管交付与发布就绪验收”，并继续把实际部署、真实迁移、发布、Git 初始化/提交/推送作为需单独授权的外部动作。

## 11. 版本控制与发布声明

- `D:\Forgejo\Ecoku\.git` 不存在；没有执行 `git init`，也没有创建、删除或修改 Git 历史。
- 无法用 `git status` 精确区分 P0～P3 与更早的本地差异，也没有提交级回滚保护。
- 所有 P3 源码、依赖、构建产物和文档变化均为未经提交的本地文件变化。
- 本阶段没有迁移真实数据库，没有部署、发布、线上验收、提交、推送、PR 或 release。
