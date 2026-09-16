# Ecoku 全项目审计报告

## 1. 审计结论与边界

- **审计日期**：2026-09-16。
- **源码基线**：`003d840195f04b77aaf314f3464fd2235fe1772f`；容器版本 `0.2.2`，SQLite schema v7，client 包版本 `0.1.0`。
- **工作区**：审计开始时干净；本次仅新增本报告，不修复实现、不修改迁移、不提交或发布。
- **方法**：静态源码审查、跨模块调用链追踪、现有测试审阅、配置/文档交叉核对，以及文档发布脚本的隔离验证。
- **范围**：444 个 Git 跟踪文件的目录与风险面盘点；重点审阅 `server/`、client/admin 运行时、迁移与导入、Docker/Compose、全部 Woodpecker 流程、发布脚本、公开文档与接入示例。历史设计和进度文件仅作索引/基线参考，未逐版逐行审计，也不作为当前实现依据。忽略构建缓存、依赖目录和运行数据。
- **限制**：未执行浏览器、真实 SMTP/Telegram/CAPTCHA、容器部署、生产主机或真实数据库验证；未联网查询漏洞库、核验镜像内容或检查远程 CI 状态。下列“已确认”指源码可直接确定的缺陷，不代表已经实施端到端攻击复现。

**总体判断**：项目没有明显需要推倒重写的架构问题。公共 DTO、站点隔离、SQL 参数化、密钥加密、受限管理凭据、列表资源预算及容器最小权限均有实质实现。但存在博主身份错误回填、SMTP 无限等待、备份操作说明与实际权限冲突等应优先修复的问题；当前不宜仅凭既有测试和 `/api/health` 宣称认证、投递及恢复路径已全面可靠。

### 等级定义

- **P1 / 高**：影响身份可信性、持久数据安全或关键后台服务可用性，应优先修复。
- **P2 / 中**：有明确触发条件的功能、可靠性或数据正确性缺陷。
- **P3 / 低**：生命周期、无障碍、文档或维护质量问题。
- 未发现足够证据支持 P0 结论；这不等于不存在未知漏洞。

### 问题总览

| 编号 | 等级 | 问题 |
| --- | --- | --- |
| A01 | P1 | 普通站点配置保存会把未经口令证明的评论重新标记为博主 |
| A02 | P1 | SMTP 在设置 deadline 前读取欢迎消息/协商 STARTTLS，可无限阻塞 |
| A03 | P1 | 备份/升级 SOP 在推荐权限下失败，且未阻止带着不完整备份继续升级 |
| A04 | P2 | Twikoo 导入在父节点尚未处理时过早回退到根节点，改变层级 |
| A05 | P2 | Telegram 对已转义 HTML 整体截断，可破坏实体、标签和原文链接 |
| A06 | P2 | 评论输入原生 maxlength 按 UTF-16 限制，与 Unicode code point 契约冲突 |
| A07 | P2 | 博主口令宣称支持 12–80 字符，但 bcrypt 实际最多接受 72 字节 |
| A08 | P2 | 管理端把主动取消转换成网络错误，旧请求污染新界面错误状态 |
| A09 | P2 | Outbox 完成状态写回失败后卡在 processing，且 worker 丢弃错误 |
| A10 | P2 | Loader 超时重试继续等待旧 Promise，且允许旧初始化迟到回写 |
| A11 | P2 | Smoji 合法清单 URL/图片 URL 在浏览器和服务端不能一致往返 |
| A12 | P2 | SPA 切换 pageKey 后继续使用旧 pageTitle，通知文章标题错误 |
| A13 | P3 | SDK 销毁与关闭回复未完整处理异步 Smoji/CAPTCHA 生命周期 |
| A14 | P3 | Smoji 选择器声明的 ARIA 模式与键盘交互不完整 |
| A15 | P3 | 当前版本导航、部署监听地址和配置字典存在事实漂移 |

合计：**15 项，P1 3 项、P2 9 项、P3 3 项**。以下复现步骤均为建议补充的隔离用例，除第 7 节明确记录的本地检查外，本次未执行。

## 2. 已确认问题

### A01 — 普通站点配置保存会重新授予博主身份（P1）

**证据**：`server/model/site.go:193–199`；`server/model/blogger.go:55–75`；`server/handle/comment/submit.go:108–119`。

提交时通过口令决定 `is_blogger`，但 `UpdateSite` 只要发现站点仍有博主昵称和口令哈希，就调用 `BackfillHistoricalBloggerComments`，没有要求本次设置口令，也没有历史时间边界。回填只比较昵称和邮箱，将所有匹配且未删除的普通评论置为博主。

**触发**：站点已启用博主口令；访客知道或猜中博主昵称和邮箱，未提供正确口令而以普通访客发表。管理员随后只修改占位文案、排序或 Smoji 设置并保存，即会把该评论改为 `is_blogger=1`。

**影响**：公开徽章错误认证；后续直接回复通知依据存储标记判定，也会受到影响。攻击者仍需提交额度、满足启用的 CAPTCHA，且需要管理员后续保存配置；不是任意远程获取管理员权限。

**最小修复**：普通配置更新不得触发回填。保留已发布迁移不变，将必要的历史回填限制在明确的历史集合/首次启用流程；只增加 `UpdatePassphrase` 条件仍不能消除口令轮换时重认新访客评论的问题，应先确认历史识别边界，再同步产品约束。

**回归**：保留已有 `TestSiteUpdateBackfillsHistoricalBloggerComments`；新增“启用后冒用昵称/邮箱 → 修改非身份配置或轮换口令 → 仍为访客”的反例。

### A02 — SMTP 欢迎消息和 STARTTLS 阶段没有读取超时（P1）

**证据**：`server/notifications/delivery.go:35–63`；`server/notifications/outbox.go:94–115`；`server/main.go:66–69`。

`SetDeadline` 在 `smtp.NewClient` 和 `client.StartTLS` **之后**才执行。TCP dial 的 10 秒超时不限制已经建立连接后的 SMTP banner 读取。STARTTLS 的 EHLO/响应/握手也发生在 deadline 之前；TLS 分支使用 `tls.DialWithDialer`，未接入调用者 context。建立连接后也没有通过 context 取消关闭 SMTP socket。

**触发**：SMTP 服务器接受 TCP/TLS 连接但不发送 `220`，或在 STARTTLS 协商时停住。

**影响**：单个 worker 被卡住，后续邮件和 Telegram 队列均无法推进；停服时 `worker.Wait()` 无法结束，Compose 可能在 30 秒后强杀进程，无法依赖正常关闭路径完成 checkpoint。不能据此断言 SQLite 必然损坏。

**最小修复**：连接建立后、任何 SMTP 读取之前设置覆盖全部交互的 deadline；使用可取消 TLS dial，并在 context 取消时关闭连接。正常退出、发送测试和后台投递共用同一路径。

**回归**：使用本地假 SMTP 对端分别模拟无 banner、无 STARTTLS 响应、context 取消，断言有限时间返回且 worker 能结束；不使用真实邮件服务。

### A03 — 推荐部署权限与备份/恢复命令不兼容（P1）

**证据**：`docs/self-hosting/docker.md:19,129–130`；`docs/self-hosting/backup.md:15–39,58–68`；`docs/self-hosting/upgrade.md:27–36`，以及三套翻译的对应章节。

部署将 `data` 设为 UID/GID `10001:10001`、权限 `750`，`app/config.yaml` 设为 `640`；备份和在线快照却要求普通部署用户直接运行 `tar`、`sqlite3`。该用户不是 UID 10001、没有对应组权限/ACL 时，会出现 Permission denied。恢复时普通用户还可能无法覆盖已有的只读配置文件。

升级代码块没有失败即停止或备份内容校验，交互式逐行执行时，`tar` 失败后仍可能继续拉取和启动新版本。简体中文备份文档还缺少创建 `~/backups` 的步骤。归档包含 `ecoku.env`：普通冷备份是在生成后才 `chmod 600`；升级归档没有权限收紧；在线数据库快照也未限定权限，常见 umask 下可产生过宽权限的敏感副本。

**影响**：用户误把部分归档当成可回滚备份；本机其他用户可能读取配置秘密或私有评论数据。在线数据库快照本身不包含解密主密钥和部署配置，不能单独构成完整灾备。

**最小修复**：四套语言统一为具备实际读取/恢复权限的命令，创建权限 `700` 的卷外备份目录、从创建时采用 `umask 077`，检查每步退出码并验证归档包含数据库、配置和环境文件，再允许升级。保留整个数据目录中的 WAL/SHM，不因停服命令成功就假定 checkpoint 一定完成；快照恢复需配套保存主密钥。不要降低生产数据目录权限来迁就示例。

**回归**：仅在隔离目录按 UID 10001/普通部署用户的权限模型演练；强制归档失败时后续升级步骤不得执行。真实恢复演练须另行授权。

### A04 — Twikoo 导入结果依赖输入数组顺序（P2）

**证据**：`server/importer/twikoo.go:103–150`；`server/importer/twikoo_test.go:35–72`。

导入只在 `inserted` 中寻找直接父节点，找不到就立即使用已经插入的 `rid`。此时父节点可能存在于导出文件，只是排在后面，并非缺失。

**触发**：数组顺序为 `root, grandchild(pid=child,rid=root), child(pid=root)`。处理 grandchild 时 root 已插入、child 尚未插入，grandchild 被直接挂到 root，随后不会修正。

**影响**：事务成功但层级被静默扁平化，未来回复上下文和直接回复收件人语义改变。现有正常层级测试只使用父节点在前的顺序。另，`Roots/Replies` 在转换前按原始 pid 统计，孤儿提升为根之后统计也未同步。

**最小修复**：先建立完整 source ID 集合；父节点存在但尚未插入时继续等待，仅在确认缺失或最终处理循环时使用 fallback。按最终写入关系统计根/回复。

**回归**：同一三层导出使用不同排列顺序，断言父关系一致；包含缺失父节点和环的脱敏 fixture 也应验证最终统计。

### A05 — Telegram 模板截断破坏 HTML（P2）

**证据**：`server/notifications/templates.go:58–77`；`server/notifications/delivery.go:130–134`。

模板先转义并拼接 `<b>`、`<a href>`，最后对整个 HTML 调用 `truncateRunes(message, 3900)`。转义实体扩张和长站点 URL 都会使截断发生在实体、标签或属性内部。

**触发**：合法的较长正文配合较长 `site_url`，最终截断落在原文链接属性中；大量 `&` 等字符即使正文未超限制，也可造成显著转义扩张。

**影响**：丢失原文链接，或因不完整 HTML 被 Telegram 拒绝；重试相同无效模板不能恢复。本次未调用 Telegram API。

**最小修复**：在转义之前按各纯文本字段和固定结构预算裁剪，保留完整标签/实体和链接；或改为无需 HTML 解析的投递格式。不得直接截断最终标记字符串。

**回归**：长 URL、1000 个 `&`、长回复上下文及多字节字符组合；验证输出结构闭合、链接保留及平台长度边界。

### A06 — 原生 maxlength 提前限制非 BMP 字符（P2）

**证据**：`packages/client/src/comment.ts:334,425,437,768`；`packages/client/src/util.ts:1`；`server/handle/comment/submit.go:121`；`docs/internal/constraints.md` 的正文计数契约。

JS 计数器和 Go 校验按 Unicode code point 计算，但 `<textarea maxlength=N>` 按 UTF-16 code unit 限制真实用户输入。单个常见 emoji 占两个 UTF-16 单元。

**触发**：配置正文上限 2，尝试输入两个非 BMP emoji；浏览器可能在计数器显示 `1/2` 时就阻止第二个字符。根评论和回复均受影响。昵称及若干管理端文本字段也有相同计量差异，应一并检查。

**最小修复**：正文使用现有 code point 校验作为真实上限；取消不等价的原生 maxlength，或仅用其作为不会提前阻止合法文本的安全上界。保留服务端校验、输入法组合输入和可访问的长度提示。

**回归**：不要只用 `.value=` 模拟输入，因为这会绕过浏览器原生限制；补包含真实键入/粘贴、组合输入和非 BMP 字符的浏览器验收用例。

### A07 — 博主口令字符上限与 bcrypt 字节上限冲突（P2）

**证据**：`server/model/blogger.go:12–35`；`packages/admin/src/components/SiteManagementView.vue:53–54` 及口令字段说明。

`ValidateBloggerPassphrase` 接受 12–80 个 code point，随后把 UTF-8 原文直接交给 bcrypt。Go bcrypt 的生成函数拒绝超过 72 **字节**的输入。

**触发**：73 个 ASCII 字符，或 25 个普通中文字符（75 字节），均满足界面说明却保存失败，服务端只返回泛化的“博主口令无效”。

**最小修复**：明确同时限制字符数和 UTF-8 字节数，并同步说明及校验；若坚持完整支持 80 字符，需要设计兼容现有哈希的版本化方案。不要静默截断口令，也不要直接改变旧哈希的验证方式。

**回归**：72/73 字节边界、中文和 emoji 的字符/字节边界、已有哈希继续可验证。

### A08 — 管理端主动取消被误报为网络错误（P2）

**证据**：`packages/admin/src/api.ts:48–64`；`packages/admin/src/stores/admin.ts:144–165`。

API 请求层的 `catch` 将所有 fetch 异常包装为 `ApiError(0, 'network')`，包括 AbortError；store 却依赖原始 DOMException 判断主动取消。列表/详情的 generation 仅保护成功写回，错误分支没有相同保护。

**触发**：慢网下快速切换站点、状态、排序或详情。旧请求被主动 abort 后进入 `fail()`，在新请求已开始甚至成功后显示错误。

**最小修复**：共享请求层保留 AbortError；成功与失败回调都校验请求 generation。为缺少超时的管理请求补有限超时，但应区分超时、取消和普通网络失败。

**回归**：A 请求延迟、切换到 B 并成功，随后 A 因 abort 失败；B 的数据和错误提示不得被污染。

### A09 — Outbox 写回失败后事件在本进程内永久搁置（P2）

**证据**：`server/notifications/outbox.go:103,124–169`。

事件先标为 `processing`，投递结束后再更新为 `sent/failed/cancelled`。若完成状态更新失败，返回的错误被 worker 的 `processed, _ := ProcessPendingOnce(ctx)` 丢弃；下一轮只查询 `pending/failed`。`processing` 仅在进程启动时回收。

**触发**：成功领取事件后，数据库短暂写入失败、磁盘不足或锁冲突，恰好影响完成状态写回。

**影响**：事件保持 processing 直到重启；若邮件已经发出，重启恢复后还可能重复发送。普通投递连续失败至 8 次后也没有应用日志提示，操作者只看到服务仍 healthy。

**最小修复**：至少输出脱敏事件 ID/固定错误码；对完成状态写回失败设置有限重试或安全的恢复策略，避免直接重新执行外部发送。文档明确投递是至少一次语义，不能宣称端到端恰好一次；无需为此引入外部队列。

**回归**：领取后注入一次写回失败，数据库恢复后事件能受控处理；正常成功不得额外发送。测试失败日志不含目标地址、正文、凭据或第三方响应。

### A10 — Loader 超时重试不是新的尝试（P2）

**证据**：`packages/client/src/loader-core.ts:25–61,110–158`；`packages/client/src/loader-core.test.ts`。

12 秒计时器只调用 `showFailure`，没有终止旧初始化、移除卡住的 SDK script 或重置 `sdkPromise`。重试会再次等待同一个 pending Promise。若旧脚本之后完成，多次 `initialize()` 会同时创建实例；SDK 的容器占用保护虽能阻止双挂载，但后到的失败又可能覆盖已成功的外壳状态。

**最小修复**：在加载层管理超时失败和可重试 Promise，外壳按尝试编号忽略旧异步结果；同一容器不同时存在两次初始化。不要只重画错误文案。

**回归**：script 永不 load/error、超时后重试、旧 load 迟到以及 `init()` 迟到四种时序；确认可发起真正重试且成功状态不回退。

### A11 — Smoji 清单到评论标记缺少一致的 URL 规范（P2）

**证据**：`packages/client/src/smoji.ts:72–114,122–124`；`packages/client/src/fetch.ts:135–147`；`server/handle/comment/smoji.go:24–45`；`server/config/config.go:623–643`。

存在两个可直接追踪的往返失败：

1. 后台可保存 `https://static.example.com:443/smoji.json`。浏览器 WHATWG URL 会移除默认端口，而 Go 校验使用字面 `Scheme + "://" + Host`，因此同源图片在提交时会被当成不同来源。
2. 清单接受合法图片路径如 `face(1).png`；`smojiMarker` 原样放入标记，但前后端 marker 正则排除 URL 内的括号。访客能选中图片，却无法正常提交该标记。

**最小修复**：两端统一 scheme/hostname/有效端口的 origin 语义；生成标记前编码标记分隔字符，并验证可往返解析。不要放宽同源或凭据/query/fragment 限制。

**回归**：默认端口显式/省略等价、非默认端口隔离、带括号图片路径，以及 `base` 展开和显式 `src` 两种来源。

### A12 — SPA 页面切换保留旧文章标题（P2）

**证据**：`packages/client/src/comment.ts:132–153`；`packages/client/src/fetch.ts:288–293`；`docs/integration/sdk.md` 的 Vue 路由示例。

`setPageKey` 只更新 `pageKey`，实例配置中的 `pageTitle` 始终是初始化时的值。文档推荐的 Vue 示例也只在路由变化时调用 `setPageKey`。

**触发**：在文章 A 初始化，SPA 切换至文章 B 后发表评论。请求 `mark` 已是 B，`pageTitle` 仍是 A，服务端持久化并用于通知。

**最小修复**：近期文档可先使用携带新标题的销毁/重建方式；若保留原实例切页，提供显式更新标题的兼容方式。不要从 URL 猜标题或 pageKey。

**回归**：A → B 后提交，mark、pageTitle 和通知标题上下文一致；更改公开 SDK 契约时同步四套文档和包说明。

### A13 — 异步控件没有完整生命周期收尾（P3）

**证据**：`packages/client/src/comment.ts:156–166,462–470,834–841,909–917`。

- `destroy()` 未 abort `smojiManifestController`。清单请求仍可继续至已有的 8 秒上限，并在完成后向已脱离 DOM 的 panel 创建节点。
- `syncReplyCaptcha()` 等待 `mountChallenge` 后直接赋值；若回复已关闭或实例已销毁，迟到的 widget 不会被 `closeReply()` 捕获并 remove。根表单已有 generation 校验，回复路径缺少相同机制。

**最小修复**：销毁时取消清单读取；回复 CAPTCHA 完成后检查当前回复对象和销毁状态，过期对象立即 remove。无需引入通用任务框架。

**回归**：延迟清单或 widget 加载 → 关闭回复/销毁 → 完成加载；断言无活动控件、未完成请求和迟到 DOM 更新。

### A14 — Smoji 弹层的 ARIA 与键盘语义不完整（P3）

**证据**：`packages/client/src/comment.ts:844–932`。

触发器声明 `aria-haspopup="dialog"`，但 panel 没有对应 dialog 角色、可访问名称或焦点策略；包按钮声明 `role="tab"`，却没有 tablist/tabpanel 关系与 tab 键盘行为。弹层只有指针外部点击关闭，未处理 Escape。

**影响**：读屏得到不完整的控件模型，键盘用户关闭和定位弹层内容不便。不是完全不能通过 Tab 操作，也没有做过本次真实读屏验收。

**最小修复**：选择与实际交互一致的简单非模态弹层/普通按钮语义，或完整实现所声明的 dialog/tab 模式；补 Escape 与焦点返回。涉及用户界面变化，应先调整已批准原型并获得批准，再改生产 UI。

**回归**：仅键盘打开、切包、选择、关闭和返回输入框；读屏名称/角色核验。

### A15 — 文档与源码事实漂移（P3）

**证据与影响**：

- `docs/.vitepress/config/shared.ts:152` 将 v0.2.0 标为最新，并未列出已有 v0.2.1 页面；根 VERSION 已是 0.2.2。`AGENTS.md:47` 仍写“当前为 v0.1.9”。这是陈旧说明，不应据此回退实际版本。
- `docs/self-hosting/docker.md:3` 将容器内部描述为监听 `127.0.0.1:12123`；实际 `server/routes/routes.go` 的 Addr 是 `:12123`，只有宿主机发布端口绑定回环。混淆两者会误导网络排障。
- 配置字典把 `client.static_dir=/app/client` 和若干环境变量名称写成默认值；源码没有为 client 路径、admin 环境变量名和加密变量名提供这些默认值，它们是部署模板填写值。
- 文档称 `notifications.instance_public_url` 用于邮件链接；实际链接来自 `site.SiteURL + mark`，该配置目前仅在通知启用校验中作为非空要求。
- SDK/npm 说明展示非空 `cssURL` 用法，但直接 SDK 路径只关闭内联 CSS，只有 loader 调用 `ensureHostStylesheet`。应明确直接 SDK 是否需要宿主手动 `<link>`，避免把两种入口的行为混为一谈。

**最小修复**：按源码校正说明，区分模板值与程序默认值、容器监听与宿主发布；同步四套语言。不要修改已发布 CHANGELOG 的历史叙述来消除现状差异。

## 3. 已核对的防护与设计优点

以下是静态实现和测试设计方面的正面证据，不是本次测试通过声明。

| 领域 | 当前实现与证据 |
| --- | --- |
| 公共隐私投影 | `PublicCommentResponse` 显式列字段，不含邮箱/IP/UA/密钥；墓碑投影替换昵称/正文并隐藏网站。 |
| SQL 注入边界 | 站点、页面、ID 等值使用绑定参数；排序经固定白名单转换，没有把公开输入直接拼成 SQL。 |
| 多站点隔离 | 公共 handler 校验目标站点 Origin；父评论验证同站点/页面；SQLite 复合自引用外键提供第二道约束。 |
| 管理认证 | HMAC 验签、用途/主体/有效期校验，token 绑定当前密码哈希；密码轮换使旧 token 失效。浏览器仅保存内存会话。 |
| 自动化凭据 | `EcokuSite` 不能读取评论或发现实例站点，也不能永久删除；与实例 Bearer 权限分离。 |
| 密钥保护 | 通知/CAPTCHA 使用 AES-GCM 随机 nonce；CAPTCHA provider 的 AAD 分离；管理 DTO 仅返回已设置标志，启动解密失败关闭。 |
| 人机验证 | 服务端最终验证，失败不自动降级；不附加访客 IP。Cap 出站拒绝重定向，并在实际 dial 时过滤解析地址。 |
| 前端内容安全 | 评论通过 textContent/Vue 文本插值渲染；Smoji 用受限图片节点；未发现运行时把评论正文直接写入 innerHTML。 |
| 浏览器存储 | 访客身份使用非导出 AES-GCM key、IndexedDB、站点作用域及 7 天有效期；存储失败回退。未发现把身份或管理 token 写入 localStorage/cookie/URL 的实现。 |
| 列表资源约束 | CORS 前的独立频控/4 并发/2 秒期限；节点、深度、计数、编码后字节预算；同快照读取及显式单层游标模式。 |
| SQLite 生命周期 | 单连接池、WAL、外键、忙等待；DSN 对重建连接重新应用 PRAGMA；关闭时检查 checkpoint 并尝试关闭连接。 |
| 迁移 | 顺序事务迁移、版本连续性/名称/记录校验、未来版本拒绝；无自动向下迁移。未提出改写已发布迁移。 |
| 删除 | 墓碑清空指定身份字段和正文、不级联后代；永久删除仅允许管理员删除无子节点墓碑。 |
| 应用日志 | 正常请求日志不记录 query/header/body；GORM SQL 日志关闭；recovery 不输出 panic 值和请求秘密。原始 path 的残余风险见下节。 |
| 容器 | UID/GID 10001、read_only、cap_drop ALL、no-new-privileges、受限 tmpfs、宿主回环端口及日志轮转。 |
| 构建发布 | frozen pnpm lockfile、Go 校验和、精确镜像 tag、多架构独立缓存；应用镜像流水线不包含生产部署和真实库操作。 |
| 文档发布 | 限定目标 agent、可信卷、候选验证、文件锁、原子 symlink 切换及旧流水线拒绝。正常/拒绝分支已做隔离检查。 |

## 4. 风险、权衡与尚需验证的事项

这些事项**不计入 15 项已确认缺陷**，避免把产品约定或尚未测量的问题误报为漏洞。

1. **读预算与写入容量不对称**：提交允许生成超过 16 层、200 节点或页面 10,000 记录的内容，而官方 SDK 只用完整线程读取；这样的页面可能无法加载。这是当前明确记录的产品边界，不应把 422 防护直接删除。应决定是否在写入/运营指引上提供防止讨论变得不可读的策略，任何新交互须走原型批准。
2. **通知不是已验证邮箱系统**：访客自报邮箱，CORS 也不是服务器调用者认证。验证码、单 IP 限流不能根本阻止分布式垃圾评论/邮件滥用；评估外层流量限制及投递配额，不要为此擅自重新引入普通用户、验证码注册或审核队列。
3. **通知队列保留与容量**：已发送、失败、取消事件没有定期清理策略；每收件目标增加一行。应先测量增长、明确私有目标地址保留周期，清理真实数据需要明确授权，不推荐默默自动删除。
4. **单 SQLite 连接的队头阻塞**：它简化事务和 PRAGMA 一致性，但慢导入/管理查询可能让公共列表超时。列表之外的多条 DB 调用未绑定请求 context；`/admin/` 静态头生成也查询 CAPTCHA 设置。需要受控负载测量后再决定优化，不建议直接增加连接数。
5. **代理信任部署前提**：应用只在直接对端可信时解析转发头；若代理未覆盖 X-Forwarded-For 或 CDN 源站没有防绕过，部署仍可能失去限流可信性。仓库示例不是生产拓扑已经正确的证据。
6. **浏览器加密边界**：非导出 key 与密文同处宿主 Origin 的 IndexedDB，不能抵御同源恶意脚本/XSS。过期只是不再复用，并非 7 天后物理销毁；“保存 7 天”应理解为有效期而非删除保证。
7. **第三方资源信任**：启用 Cap 意味着信任实例提供的 JS；其当前 instrumentation 需要 unsafe-eval，这是已记录的安全权衡。Smoji 同源限制校验的是初始 URL，浏览器图片/清单重定向及远端可变内容仍应由运营者信任；本次未核验实际资源主机。
8. **迁移完整性证明有限**：`schemaChecksum()` 哈希的是固定语义描述字符串，不是迁移 SQL；启动检查也不是完整 schema fingerprint。记录可校验不等于能发现所有 DDL 或约束漂移。建议为新增迁移固定真实旧库 fixture/预期结构，勿重算或改写旧记录。
9. **原始路径日志**：`RequestLogger` 使用解码后的 `URL.Path`，不是 `FullPath()` 路由模板；任意 404 路径也会记录。建议只记录模板或受控 unknown 标记，避免攻击者把敏感样式字符串/控制字符放进 path，污染日志。未验证实际日志消费器的转义行为。
10. **供应链与漏洞状态未知**：已检查依赖声明、lockfile 和镜像引用，但未执行 `govulncheck`、联网依赖审计、镜像扫描、SBOM/license 清单或签名核验。不能从版本新旧断言有/无 CVE。构建基础镜像按版本 tag 而非 digest 固定，仍有可变 tag 风险。
11. **发布门禁的治理前提**：tag 流程按约定不重复测试，目前校验 VERSION 和 Compose，不检查根 package version/CHANGELOG，也不证明该 SHA 的 master CI 已成功。此次四项一致，但发布授权流程仍需核对目标 SHA 的 CI 结果；不建议因此无条件重复整套测试。
12. **文档可信内容边界**：Mermaid 使用 `securityLevel: 'loose'` 和生成 SVG 的 innerHTML，输入来自仓库文档而非访客评论；不能据此认定评论存在 XSS。应限制文档来源与发布权限，若未来引入外部内容则重新审查。
13. **无可用性测量结论**：未实测 384 MiB 下峰值内存、bcrypt 吞吐、导入最坏复杂度、p95/p99、停机恢复和 ARM64 运行。也未进行 WCAG 全量、视觉、移动端或读屏验收。

## 5. 复杂度与可删除代码专项

没有理由为本次问题引入微服务、Redis、新的数据库、通用仓储层或新的前端组件框架。以下为独立的简化候选，均未实施；按预计收益排序。

- **delete:** 删除无调用的 `GetAllAllowedOrigins`、`IsOriginAllowed`、`GetManagementKeyBindings`、`ListPublicOrigins`、`InitRouter`。替代：现有实际路由/SQLite 查询路径，无新抽象。见 `server/config/config.go`、`server/model/site.go`、`server/routes/routes.go`。仓库内检索仅发现定义；不代表对仓库外消费者做过兼容承诺审查。
- **shrink:** `getSite` 对临时 `[]Site{site}` 调用 `attachSiteOrigins`，得到的字段修改未返回到原变量，紧接着又查询一次相同来源；删除被丢弃的调用。`requireRegisteredSite` 丢弃完整站点对象后，list/submit 又读取一次，可直接返回已读取站点。替代：复用现有结果，减少公共读写入口重复 SQL。见 `server/model/site.go:100–106`、`server/handle/comment/validation.go:33`。
- **stdlib:** client 唯一的 `rimraf` 用途是 `clean`。替代：Node `fs.rmSync('dist', {recursive: true, force: true})`，可移除一项直接开发依赖。见 `packages/client/package.json`；需刷新 lockfile 并交由 CI 验证发布构件。
- **shrink:** 两个常量时间字符串比较函数实现完全相同。替代：保留一个实现；若要保留语义函数名，可委托调用，避免暗示不存在的“规范化”差异。见 `server/utils/admin_auth.go:143–153`。
- **delete（需先确认配置兼容策略）:** `GetCommentFormConfig` 只被配置测试调用，运行时已从 SQLite 投影。替代：对实际 SQLite 公共 DTO 测试；不要把 YAML 种子投影误认为在线事实来源。见 `server/config/config.go:682`。

保守估计：**net: -100～150 lines, -1 direct dev dependency possible**；这是候选估算，不是已实现收益，也未计算可能同步删除的测试行数。

另有 CAPTCHA client/admin 适配器和 Go AES-GCM 帮助代码重复，但共用模块会触及包构建和旧密文兼容。本次不建议为了减少行数立即重构，更不能合并掉不同 provider 的 AAD。Pinia、Vue、Gin、GORM、日志轮转和显式 DTO 均有当前职责，未列为盲目删除对象。

## 6. 测试覆盖审查与补齐顺序

仓库有 **49 个**命名为 `_test.go`、`.test.ts` 或 `.test.mjs` 的测试文件，包含原型测试；数量不代表覆盖率。本次阅读了主要安全/迁移/通知/导入测试及相关前端测试，没有生成覆盖率报告。

| 领域 | 已有测试设计 | 主要缺口 |
| --- | --- | --- |
| 公共列表 | 深度/节点/字节/计数预算，游标隔离，并发/超时/快照，CORS 前准入 | 保留现有防护回归；新增风险不能靠放宽预算解决 |
| 数据库 | WAL/PRAGMA、取消后换连接、顺序升级/历史数据/外键 | 固定旧版本外部 fixture、完成写回失败恢复、真实备份恢复演练 |
| 身份 | 管理 token、站点权限、博主口令和历史回填正例 | A01 反例、A07 UTF-8 字节边界 |
| 通知 | 入队矩阵、按目标去重、加密/脱敏、模板转义、启动收回 processing | A02 停顿 SMTP、A05 长模板、A09 状态写回故障；当前投递测试多替换 sender |
| 导入 | 父节点在前、dry-run 回滚、非空拒绝、孤儿保留 | A04 乱序层级；最终统计、尾随 JSON/大小边界也值得补测 |
| 管理前端 | API 映射、表单和主要交互 | A08 取消/迟到错误；没有 timeout 的 pending 请求 |
| 评论 SDK | 身份、线程、回复、控件与 package contract | A06 真实输入、A10 Loader 超时竞争、A11 URL 往返、A12 切页标题、A13 销毁竞争 |
| 无障碍 | 部分 label、role、焦点和样式源码断言 | A14 真实键盘/读屏；不能由 DOM 模拟器断言替代 |
| 隐私静态检查 | 检查部分运行时文件的禁用关键字 | `security-source.test.ts` 文件名单未包含全部新增存储/loader/CAPTCHA/Smoji 模块；应覆盖新模块并保留真实行为断言 |
| 发布与部署 | master/PR 的前后端/Go/docs 门禁、tag 校验 | 备份 SOP 权限模型；目标 SHA 门禁证据、镜像漏洞/SBOM/签名状态 |

修复时优先给每个根因留下能失败的最小回归用例，复用现有框架，不新建一套平行测试基础设施。UI 相关调整先走已批准原型 → 明确批准 → 生产实现。

## 7. 本次实际执行的验证

### 已执行

1. **只读源码与元数据检查**：`git status --short`、HEAD、跟踪文件清单、调用方/危险 API/测试用例检索；没有读取真实数据库和部署秘密。首次目录枚举遇到忽略的 `tmp/` 构建缓存权限提示，后续审计基于 Git 跟踪文件，不把缓存副本当作项目源码。
2. **发版一致性**：VERSION 单行、根 package version、Compose 精确镜像、CHANGELOG 章节/页脚/Unreleased 比较链接均与 `0.2.2` 一致。
3. **多语言文件覆盖**：中文 `guide/`、`self-hosting/`、`integration/`、`reference/` 页面在 `en`、`zh-hant`、`ja` 均有对应路径；这只证明文件存在，不证明内容完全一致，A03/A15 已揭示部分差异。
4. **有限秘密模式扫描**：跟踪文件中未命中私钥头、AWS AKIA key、GitHub token 三类模式；未发现跟踪的运行配置/数据库/日志文件。此结果不是完整秘密检测，不覆盖任意供应商 token、Git 历史或忽略文件，也未输出潜在秘密值。
5. **Shell 语法**：`sh -n scripts/publish-docs.sh scripts/verify-docs-output.sh` 通过。
6. **文档发布隔离验证**：在自动清理的 `/tmp/ecoku-audit-docs-*` 中生成 20 个无敏感内容的占位构件，设置独立 `DOCS_DEPLOY_PARENT` 和 `audit.example`，实际验证：首次激活、后续原子替换、旧候选清理、旧流水线跳过、包含 internal 内容时拒绝且 live 不变。全部通过；未触碰 `/var/www` 或实际文档产物。本次未覆盖断电/磁盘满/并发进程崩溃等故障注入。

7. **报告校验**：问题编号/等级计数、引用文件与起始行存在性、结尾换行和空白检查通过；工作区仅新增 `AUDIT.md`。

### 按仓库约定交由 CI，未在本地运行

- `pnpm verify:client`
- `pnpm verify:admin`
- `pnpm docs:build` 及真实构建产物检查
- `go test -count=1 ./...`
- `go vet ./...`
- server 构建

**未查询当前提交的远程 CI 结果，也未触发新 CI**。本次未修改原型，所以没有运行原型测试；没有执行 npm 发布、镜像构建/推送、tag、生产部署、真实通知或数据库操作。

## 8. 建议实施顺序

1. **优先修复 A01、A02、A03**：先保证博主身份不会被普通保存重认、SMTP 可停止、备份按推荐权限真正可用。
2. **修复数据与投递正确性**：A04、A05、A09；然后处理 A06–A08、A10–A12 的客户端边界，补最小反例测试。
3. **处理 A13–A15 和低风险删减**：生命周期、无障碍、文档事实与重复查询；不做无关架构重写。
4. **经授权再验收外部系统**：查看目标 SHA 的 CI、依赖/镜像漏洞审计、隔离浏览器与 SMTP 故障演练、卷外备份恢复演练。生产操作须另行授权。

任何后续发版若涉及 schema、配置或平滑升级契约，执行顺序仍为：**停服冷备份并验证 → 修改精确镜像 tag → `sudo docker compose pull && sudo docker compose up -d` → 健康与业务检查、准备回滚**。本次报告不授权、也未执行这些生产操作。

## 9. 逐项修复记录（2026-09-16，未发布）

工作分支：`codex/audit-fixes`。以下是本次代码与文档处理结果；第 1–8 节保留原审计时的结论，不代表下面的修复已经通过 CI 或部署到生产。用户已明确批准 Unicode 输入、口令字节限制提示和 Smoji ARIA/键盘的最小界面修订，未升级原型版本。

| 编号 | 核实与修复 | 回归证据入口（未注明执行的均交 CI） |
| --- | --- | --- |
| A01 | 确认。移除 `UpdateSite` 的身份回填，仅保留原 v5 迁移和空站点受信导入内回填。首次设置、普通保存、轮换口令均不重授身份。 | `server/routes/admin_routes_test.go` 的 `TestSiteUpdateDoesNotGrantUnprovenBloggerIdentity`；原 v4→v5 迁移正例保留。原“站点更新回填历史”测试实际在当前 schema 创建新评论，因此改为反例，不能保留错误授权断言。 |
| A02 | 确认。TCP、TLS 握手、banner、STARTTLS、认证和正文共用 20 秒 context；任何 SMTP 读取前设置 deadline，取消时关闭 socket。 | `server/notifications/audit_test.go`：无 banner 的期限、STARTTLS 停顿取消、TLS 握手取消。 |
| A03 | 确认。四语言备份/升级使用 sudo 读取、700 卷外目录、创建即 600 的归档、必需文件检查、失败停止；保留整个 data 中的 WAL/SHM。恢复先保留现状并整体恢复。在线快照同时保存配置，说明主密钥依赖。 | `python3 scripts/test-backup-docs.py` 已通过：真实 tar，模拟 sudo/Docker/editor，覆盖成功与归档失败、权限和 WAL 保留。真实 UID 10001 提权与恢复未演练。 |
| A04 | 确认。先建立完整 ID 集合，存在但尚未插入的父节点继续等待；根/回复数按最终写入关系统计。 | `server/importer/twikoo_test.go`：三层评论全部六种排列、缺失父节点、环及最终统计。 |
| A05 | 确认。在 HTML 转义前按字段裁剪，保留完整标签、实体和 href；文本预算包含非 BMP 字符所需的 UTF-16 空间。 | `server/notifications/audit_test.go`：长 URL、长回复、emoji 的 HTML 结构与 4096 上界；原模板转义测试保留。 |
| A06 | 确认。正文、昵称和管理端相关文本的原生 maxlength 改为 code point 上限的两倍安全上界，实际提交继续按 code point 判断。 | `packages/client/src/ecoku.test.ts`：两个 emoji 可提交、三个超限、原生上界；真实键入/粘贴/输入法验收未执行，不能把 DOM 赋值测试当成浏览器证据。 |
| A07 | 确认。后端与管理端同时限制 UTF-8 最多 72 字节，明确提示，不截断、不更换哈希格式；验证时拒绝超长候选。 | `server/model/blogger_test.go`：72/73 字节、中文、emoji 与既有 bcrypt 验证。官方边界：[Go bcrypt](https://pkg.go.dev/golang.org/x/crypto/bcrypt#GenerateFromPassword)。 |
| A08 | 确认。保留取消异常；30 秒期限覆盖响应正文；列表和详情的成功/失败均受代次保护，切列表与登出使旧详情失效。 | `packages/admin/src/admin.test.ts`：主动取消、A 迟到失败不污染 B、正文读取超时。 |
| A09 | 确认。保存本次外部投递结果，每 3 秒仅重试完成状态写回，直到数据库恢复或进程取消；期间不领取下一条。记录固定错误码、事件 ID、次数，不记录第三方原始错误。 | `server/notifications/audit_test.go`：注入一次完成写回失败，恢复后 sent 且发送一次。仍为至少一次投递，进程崩溃边界见下文。 |
| A10 | 确认。脚本有独立超时与清理，失败清空共享 Promise；初始化超时销毁旧实例，以代次阻止迟到结果覆盖重试成功状态。 | `packages/client/src/loader-core.test.ts`：永不完成脚本→超时重试、旧 load、旧 init 迟到拒绝。 |
| A11 | 确认。Smoji 规范化数值端口（含前导零与默认端口）；生成标记只编码括号；前后端都拒绝空 query/fragment 分隔符，保留同源与非默认端口隔离。 | `server/handle/comment/smoji_test.go`、`packages/client/src/smoji.test.ts`：默认/非默认端口、前导零、括号、base/显式 src、空 ?/#。 |
| A12 | 确认。兼容地增加 `setPageKey(pageKey, pageTitle?)`，省略标题清空旧值；README、SDK 包说明、HTML 示例说明与四语言 SDK 文档同步。 | `packages/client/src/ecoku.test.ts`：A→B 新标题、B→C 省略标题；真实 SPA 宿主需在标题更新完成后调用。 |
| A13 | 确认。destroy 取消清单读取；清单变化、切页和迟到结果按请求身份隔离；回复验证码按回复对象/代次检查，迟到 widget remove。 | `packages/client/src/ecoku.test.ts`：关闭回复后验证码完成、销毁后清单完成。 |
| A14 | 确认。补全 dialog 名称/焦点、tablist/tabpanel 关联、左右/Home/End、Escape 与焦点返回，保留原布局。 | 原型三组检查已通过；`packages/client/src/ecoku.test.ts` 补角色关联和 Escape；真实键盘/读屏未执行。 |
| A15 | 确认。版本导航补 v0.2.2/v0.2.1，补四语言 v0.2.2 说明；区分容器监听/宿主发布、程序默认/模板值、实例 URL 的实际用途、直接 SDK 与 loader 的 CSS 行为。 | 四语言对应路径与发布四项静态核对；`pnpm docs:build` 交 CI。 |

### 生产升级与既有数据边界

- 根 `VERSION`、根包版本、Compose 精确镜像仍为 **0.2.2**；新增内容只写 `[Unreleased]`，未改已发布 CHANGELOG，未创建新 tag 或镜像。
- **schema 仍为 v7**；`server/model/migrations.go` 没有修改。挂载、配置键、环境变量、bcrypt 哈希保持兼容。补 `TestAuditUpgradePreservesV7State` 检查当前 schema 重启前后评论、站点、密钥设置与迁移记录保持不变；这是脱敏构造数据，未替代真实旧库恢复验收。
- 旧版已经误标为博主的记录，与真正口令认证记录没有可区分来源，不自动批量纠正；如需修正必须先核实具体记录并另行授权。
- 通知仍是至少一次语义。数据库短暂故障时不在当前进程重复发送；若外部发送已成功但完成状态尚未落库就崩溃，重启回收 processing 可能重发。持续数据库故障会暂停该单 worker，输出脱敏诊断，取消时退出。
- 发布时执行：**停服冷备份并验证 → 改已发布的精确镜像 tag → `sudo docker compose pull && sudo docker compose up -d` → 健康与业务检查；失败时保留现场并恢复整套冷备份和原镜像**。恢复备份会舍弃备份后的写入，必须先保留现状。当前未操作生产。

### 实际验证与未执行项

已执行：三组原型测试、四语言备份命令 shell 语法与隔离成功/失败验证、Go 格式/语法解析、`git diff --check`、迁移与发版四项未变核对。独立安全边界调查及一次候选复核均完成，复核发现的前导零端口与空分隔符问题已修正并留下回归用例。

按 AGENTS.md 交 CI、未本地运行：`pnpm verify:client`、`pnpm verify:admin`、`pnpm docs:build`、`go test -count=1 ./...`、`go vet ./...` 与 server 构建。新增/修改的运行时回归用例尚无执行通过声明。本次未提交、推送、发 tag、构建/发布镜像、查询/触发远程 CI、连接生产或真实通知服务。

本机 `sudo -n true` 返回需要密码；备份隔离验证因此使用 sudo/Docker stub，不能宣称已验证真实 root/UID 10001 权限模型。无需为源码修复提供密码；部署前由操作者按更新后的流程验证。

浏览器补充验收用例（未执行）：正文上限设为 2，在根评论与回复中实际键入/粘贴两个非 BMP emoji、用输入法完成组合输入；确认显示 2/2 且可提交，三个被 code point 校验拒绝。仅键盘打开 Smoji，切包、选择、Escape 关闭并核对焦点返回与读屏名称。

### 其余审计建议的处理

第 4 节仍为运营/产品边界及尚未测量事项，不将其改写为已修复漏洞。第 5 节只删除了 `getSite` 中结果被丢弃的重复来源查询；无调用函数、rimraf、比较函数合并和 YAML 种子测试接口属于独立清理候选，未为审计修复扩大兼容性变更或刷新依赖。没有引入新依赖、外部队列或额外迁移。


## 10. v0.2.3 发布准备（2026-09-16）

- 用户已授权提交全部改动、合并 master、清理其他分支并推送 master；审计修复提交为 `518c964`，已快进合并 master，审计分支已删除。第 9 节中的“未提交/版本未变”描述保留为上一阶段记录。
- 本阶段把 `VERSION`、根包版本、Compose 镜像与 CHANGELOG 同步为 0.2.3，增加四语言 v0.2.3 升级页，部署示例统一指向精确目标镜像，并明确标为待发布。
- schema v7、迁移源码、挂载及配置契约不变。与 v0.2.2 同 schema，通常可只回退镜像并保留当前数据；整库恢复仅在确需回到备份状态时执行，先保留现场并确认后续写入损失。此说明细化第 9 节的整套备份恢复路径。
- 本地仅核对发布四项、文档路径与 diff；完整前后端、文档构建、Go 测试/vet/构建交 master CI。上一阶段本地原型与隔离备份结果不重复运行。
- 此提交仅准备版本；须由用户确认 master CI 正常并另行授权后，才能创建/推送 v0.2.3 tag 让 CI 构建镜像。生产部署未获本阶段授权。
