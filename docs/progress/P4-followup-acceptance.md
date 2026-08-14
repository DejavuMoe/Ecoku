# P4 补充验收：批准原型同步、批量审核与真实集成

> 历史说明：本文是中间增量记录。当前最终实现与验收结果见 `P4-final-acceptance.md`。

日期：2026-08-13
结论：**通过**。本记录是 `P4-acceptance.md` 之后的增量事实记录，不改写当时没有批量审核的历史状态。

## 1. 本次批准边界

用户批准以下版本作为新的设计基线：

- 评论区：`designs/plain-thread-comments/index-v3.html`；
- 管理端：`designs/admin-moderation/index-v2.html`；
- 生产评论区继续继承测试 Hugo PaperMod 主题的正文排版、颜色和 CSS 变量，不引入远程头像、遥测或浏览器端管理密钥；
- 管理端加入站点级当前页批量批准、批量拒绝和部分失败处理。

评论区基线在批准前按用户标记完成四项调整：

1. 排序文案为“最新评论 / 最早评论”；
2. 标题只显示“xx 条评论”，移除前置“讨论”；
3. 只有一级根线程显示分隔线，子评论不显示分隔线；
4. 评论上下间距适度收紧，但保留可读性。

`designs/*/ui-contract.json` 的 production 状态已由 `planned` 更新为 `implemented`。旧原型仍只作为历史参考。

## 2. 实际实现

### 2.1 浏览器 SDK

- 使用自定义、键盘可操作的 listbox 排序器，不再暴露浏览器默认 `select` 视觉；
- 标题、排序文案、紧凑间距和根线程分隔线与 v3 基线一致；
- 语义回复层级不设业务上限，视觉缩进最多三级；四级及更深回复显示父级上下文；
- 正文继续只以文本节点渲染，HTML/Markdown 不解析；
- 有合法网站的昵称直接成为安全链接，不再额外显示“链接”文本；链接只接受 http/https，并带 `nofollow ugc noopener noreferrer` 与 `no-referrer`；
- 继承宿主字体和 PaperMod 变量；焦点、按钮、输入框、窄屏和 reduced-motion 样式统一；
- 仍不持久化昵称、邮箱和网站，不发送 IP、UA、地区、用户 ID 或 management key；
- pending 提交不作乐观公开渲染，提示“评论已提交，可能需要审核后显示”后刷新公开线程。

### 2.2 管理端

- 登录页和审核工作区实现 v2 基线，不再放置提示词式大段文案；
- 使用主题化纸张按钮、自定义站点 listbox 和统一表单视觉，不使用原生 `select`；
- 当前页待审核评论支持单选、全选、批量批准、批量拒绝和二次确认；
- 批量部分失败后只保留仍可处理的失败项；单条批准、拒绝和墓碑删除保持原契约；
- Bearer token 仍只保存在当前页面内存，刷新即清除；浏览器不接收站点 management key。

### 2.3 批量审核 API

```text
PATCH /api/admin/sites/:siteId/comments/batch
Authorization: Bearer <admin-token>
或 Authorization: EcokuSite <site-management-key>

{
  "status": "approved | rejected",
  "comment_ids": [1, 2, 3]
}
```

- `comment_ids` 必须包含 1～100 个不重复正整数；
- 每次显式执行现有站点认证、授权与评论归属校验；
- 按请求顺序处理，因此同批父评论排在子评论前时可满足祖先批准规则；
- 不存在和状态冲突作为单项 404/409 结果返回，其他合法项继续处理；
- 非预期数据库错误仍为请求级 HTTP 500，并提示刷新，因为此前单项可能已成功；
- 响应只含 ID、结果码、结果类型和幂等标志，不含邮箱、正文或其他私有字段。

## 3. 修改范围

主要生产文件：

- `server/handle/admin/moderation.go`
- `server/routes/routes.go`
- `server/routes/admin_routes_test.go`
- `scripts/real-api-smoke.ps1`
- `packages/client/src/comment.ts`
- `packages/client/src/messages.ts`
- `packages/client/src/style.css`
- `packages/client/src/ecoku.test.ts`
- `packages/client/src/security-source.test.ts`
- `packages/admin/src/App.vue`
- `packages/admin/src/api.ts`
- `packages/admin/src/stores/admin.ts`
- `packages/admin/src/messages.ts`
- `packages/admin/src/style.css`
- `packages/admin/src/types.ts`
- `packages/admin/src/admin.test.ts`
- 两个设计目录的 `ui-contract.json`

本地 Hugo 集成使用嵌套仓库 `test_site/Blog` 中的配置、PaperMod partial/CSS 和 `static/vendor/ecoku.umd.js`。该嵌套仓库原先已有未提交修改，本次没有代替用户提交或覆盖那些历史改动。

## 4. 自动化验证

最终从当前源码重新执行：

| 命令 | 结果 |
| --- | --- |
| `cd server && go test -count=1 ./...` | 通过；config、comment、middleware、model、routes、utils 全部通过 |
| `cd server && go vet ./...` | 通过 |
| `pnpm run verify:client` | 通过；2 个测试文件、21 项测试、type-check、ESM/UMD/CJS/types 构建及包契约通过；未发布 |
| `pnpm run verify:admin` | 通过；1 个测试文件、13 项测试、type-check 与生产构建通过 |
| `node designs/plain-thread-comments/prototype-v3.test.mjs` | 通过；52 条、1～6 级 fixture 和静态契约通过 |
| Hugo 0.164.0 `--enableGitInfo=false` 临时输出构建 | 通过；260 pages、18 paginator pages、822 non-page files、13 static files |
| SDK 构建产物 SHA-256 对比 | 当次验收通过；完成命名统一后的当前产物哈希见 `docs/progress/ecoku-naming-acceptance.md` |
| `git diff --check` | 通过 |

首次 Hugo 构建曾因嵌套仓库 Git ownership 检查失败；使用 Hugo 的 `--enableGitInfo=false` 明确禁用本次无关的 Git 元数据读取后，完整构建通过。没有把首次失败描述为通过。

## 5. 本地真实 SQLite/API 验收

使用临时配置、独立 SQLite 文件、真实 Ecoku 进程和 `scripts/real-api-smoke.ps1` 执行：

- 提交 52 条 pending 评论，其中一条完整线程达到六级；
- pending 管理列表完整包含 52 条；
- 一次批量批准 52/52 成功，再次批准全部返回幂等；
- 子评论先于 pending 父评论批准返回单项 409，随后拒绝父子后均不公开；
- 公开结果为 52 条、47 个根线程、最大深度 6；
- `newest` / `oldest` 根线程顺序互为反向；
- 公共 DTO 不含 email、status、IP、UA、location、User、token 或 management key。

临时本地 API 验收完成后已经停止，临时数据库、二进制和测试密钥已删除。

## 6. 本地浏览器与 Hugo 验收

生产 UMD 通过 `test_site/Blog` 实际加载，而非 mock：

- 初始分页加载 10 个根线程，连续“加载更多”后得到 47 个根线程、52 条评论和六级关系；
- 标题只显示“52 条评论”，排序器只含“最新评论 / 最早评论”；
- 新旧排序真实切换首个根线程；
- 子评论无分隔线、无独立“链接”文本，作者网站链接安全属性正确；
- 390px 视口没有横向溢出，身份字段转为单列，六级父子关系仍可辨认；
- 表单真实提交只产生一个 POST（另一个同 URL 请求是标准 CORS OPTIONS 预检）；
- pending 提交后正文清空、提示审核状态、评论不公开；管理员批准后公开计数更新；
- `<strong>保持纯文本</strong>` 显示为字面文本，DOM 中没有 `strong` 后代；
- 评论页与管理端控制台没有 console error 或未处理异常；
- 评论 SDK 的真实排序请求只访问配置的 Ecoku API，没有第三方 IP、头像、遥测或管理凭据请求。

测试 Hugo 当前仍在本机 `http://127.0.0.1:1313/posts/the-comment-system-of-static-websites/` 运行，并指向远端测试 Ecoku。

## 7. Debian 13 容器验收

### 7.1 环境与源码边界

- 主机：Debian GNU/Linux 13.6、x86_64、1 vCPU、967 MiB RAM、2 GiB swap；
- Docker Engine：26.1.5；服务器当前没有 Docker Compose，因此未额外安装软件；
- 当前 Git 归档包含 157 个条目，明确排除 `.git`、私有配置、数据库、日志、node_modules、缓存、dist 和构建产物；允许保留空 `server/data/.gitkeep`；
- 远端镜像使用生产代码快照 `7b0d926` 构建；随后只新增本验收文档与 README 链接，没有改变镜像内代码；
- 归档 SHA-256：`e6e1757e71b24f3a8e0733cfc2e6800e747735f6b59ca48741fc96f4b2e218c1`；远端复核一致；
- 管理密码、bcrypt 哈希、管理 key 与 token key 全部在远端私有目录内生成。一次本地 env 上传尝试被保护策略阻止，随后没有绕过；改为目标端生成并轮换所有测试凭据；
- 一次只读 `docker inspect` 输出包含旧测试容器的环境变量；这些旧测试值随即按已暴露处理，未被复用。旧实例、旧卷、旧镜像和旧私有目录均已删除，当前实例使用随后生成的全新凭据；
- 下载到本地的手动登录凭据只位于 Git 忽略目录，未进入提交、日志、截图或聊天正文。

### 7.2 构建与运行

- 镜像构建真实退出 0，耗时约 76.8 秒；admin 构建输出 CSS 20.91 kB、JS 95.32 kB；
- 当前镜像：`ecoku:integration-20260813-114933`，ID `a691185bfd7f`，23.4 MB；
- 当前容器：`ecoku-integration-20260813-114933`，健康状态 `healthy`；
- 当前卷：`ecoku-integration-data-20260813-114933`；
- 监听：当时的测试主机公网 IPv4 `0.0.0.0:12123`；对应入口现已退役并从仓库移除；
- 运行用户为 `10001:10001`，只读根文件系统，`cap_drop=ALL`，`no-new-privileges:true`；只有受限 `/tmp` 和持久化 `/data` 可写；
- `/app/config.yaml` 来自最终正常限流配置的只读绑定挂载。

### 7.3 真实公网 API 与持久化

在种子配置下从本机经公网 HTTP 再次执行完整 smoke：

- 52 条 approved、47 个根线程、六级嵌套；
- 52/52 批量批准、重复批量幂等；
- 子先父后冲突单项 409；
- rejected 不公开、公共 DTO 无私有字段、新旧排序正确。

随后使用同一 SQLite 卷把容器重建到最终正常限流配置：

- 健康检查恢复为 healthy；
- 52 条 approved 和最大六级关系完整保留；
- 管理员登录为 HTTP 200；
- 允许来源为 HTTP 200 且返回正确 `Access-Control-Allow-Origin`；未允许来源为 HTTP 403；
- 20 次不落库的无效提交为 HTTP 400，第 21 次为 HTTP 429；
- 容器 stdout 与 `/data/ecoku.log` 二次扫描均不含密码、哈希、key、token、Authorization、测试邮箱或评论正文。

最终另留 8 条 pending 手动审核样本，其中包含三级回复链。远端管理端显示“待审核 8”，当前页 9 个 checkbox（1 个全选 + 8 条评论），批量批准/拒绝按钮与“8 条”确认对话框均可用；验收时取消操作，因此样本仍在队列中。

### 7.4 资源清理

- 旧容器 `ecoku-integration-20260813-094534`、旧卷、旧镜像和旧 `/tmp` 目录已按授权删除；旧测试数据不可恢复；
- 四个不被容器引用的多阶段构建中间镜像已删除，保留当前运行镜像和基础镜像；
- 当前新容器、卷、私有目录与凭据保留，供用户继续手动测试。

## 8. Git 状态与提交

本次相关提交：

- `8543bb4 design: approve comment and moderation revisions`
- `203ccfb feat(server): add site-scoped batch moderation`
- `7b0d926 feat(ui): implement approved comment and moderation baselines`

根仓库没有 push、PR、tag、GitHub Release 或软件包发布。本记录提交后，根仓库只会继续把嵌套的 `test_site/` 显示为未跟踪目录；嵌套 Blog 仓库本身已有多项未提交历史改动，本次未擅自提交。

## 9. 验收分层

### 自动化验证通过

- Go 全量测试与 vet；
- client 21 项、admin 13 项测试；
- 两端 type-check 和生产构建；
- SDK 包契约、预发布校验（未发布）；
- v3 原型 52 条/六级 fixture 契约；
- Hugo 完整构建与 UMD 哈希一致性；
- 可复跑的本地/公网真实 API smoke。

### 本地浏览器或人工验证通过

- Hugo + 生产 UMD 的桌面、390px、加载更多、排序、纯文本、pending 反馈和六级线程；
- 本地与远端生产管理端的登录、站点选择、队列、单条批准、批量选择、确认与取消；
- 控制台、焦点、ARIA 标签和无横向溢出检查。

### 条件性验证

- 当前实例只通过明文 HTTP IP:port 提供短期测试；TLS、域名、反向代理与精确可信代理 CIDR 必须在正式部署阶段单独配置和复验；
- 公网 IPv4 已验证；未配置 Docker IPv6 端口发布，因此不声称 IPv6 HTTP 验收通过。

### 尚未验证

- 真实生产域名、TLS、备份计划、监控、告警、长期并发与容量压测；
- 用户对当前远端管理端和 Hugo 页面进行的最终主观视觉确认。

## 10. 发布边界

本次只完成本地与一次性 Debian 测试实例验收。没有迁移真实生产数据库，没有推送远端 Git，没有创建 PR、tag、release，没有发布 npm 包，也没有声明线上生产发布完成。
