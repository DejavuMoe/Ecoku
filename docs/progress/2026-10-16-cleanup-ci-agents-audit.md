# Ecoku 代码清理、CI 用量与 AGENTS.md 对照审计

审计日期：2026-10-16，Asia/Taipei。源码基线：`2540118ebd8c9637729299d11cfb292fd0a725e4`。本报告属于内部验收记录，不进入公开文档站。

Ecoku 是 SQLite 单库、多站点、自托管纯文本评论系统，包含 Go 服务端、TypeScript SDK、Svelte 管理端和 VitePress 文档。此次核对的是当前仓库及其发布工作流；没有修改线上配置、部署或真实数据库。

## 结论与证据范围

- 当前仓库未发现 Statsig SDK、项目标识、服务端密钥配置、gate、dynamic config、layer 或 experiment 求值入口。不能把这个结果解释成「外部 Statsig 项目没有资产」，也不能据此认定任何线上实验已经全量上线。
- 已删除服务端配置模块中的 9 个无调用函数、1 个只写不读的标记及 3 个仅供测试使用的常量别名。测试直接复用原常量。生产配置文件净减少 101 行，未新增依赖。
- GitHub Actions 最近 30 个完整自然日共有 55 次运行、295 个 job，累计 198.13 runner 分钟，日均 6.60 分钟。节省建议使用当前工作流的时长样本校准，避免把历史上已经解决的重复工作再次计为收益。
- 原始会话中的原型批准要求造成了额外一轮交接。实际重放中，A 停在原型批准，B 交付了生产代码修改；B 的耗时减少 41.0%，API 折算成本减少 50.7%。两组都没有完成浏览器实测，不能把流程收益当成 UI 修复质量已经提高。

没有提供 Statsig 控制台或生产遥测数据源。本次未访问生产数据库或启用 profiler，因此生产分组取值、曝光量、CPU 时间和线上版本对应关系均没有遥测证明。

## 资产枚举与间接引用

枚举基线全部 845 个 Git 跟踪资产；对 836 个可作为普通文本处理的文件检索，对另外 9 个含二进制数据或 NUL 的资产补做 Statsig 字节签名检查。不是仅按 stale 标签筛选。

| 资产归属 | 文件数 | 核对内容与结果 |
| --- | ---: | --- |
| `server/` | 94 | `main`、路由、配置加载、环境变量别名、SQLite 设置、公开 DTO；没有 Statsig 入口 |
| `packages/` | 84 | client/admin 依赖、导出、配置枚举、默认常量、包装组件、响应归一化、动态脚本地址；没有 Statsig 入口 |
| `docs/` | 196 | 三语言接入和配置说明、站点组件、内部历史；没有 Statsig 资产 |
| `designs/` | 167 | 历史与批准原型、mock、脚本、图片；没有 Statsig 资产 |
| `examples/` | 6 | 接入 markup、SDK 参数及脚本地址；没有 Statsig 资产 |
| `.github/`、`.woodpecker/` | 9 | 活跃与停用工作流；没有 Statsig 资产 |
| `deploy/`、`scripts/`、根目录 | 33 | 模板、构建、发布、包与锁文件；没有 Statsig 资产 |
| `.agents/` | 256 | 包括供应商代码和实验设计说明；发现的 experiment 字样属于工具/技能材料，不属于产品实验 |

检索包含 `statsig`、拆分形式、SDK 域名、`checkGate/check_gate`、`getExperiment`、`getDynamicConfig`、`getLayer`、`useGate`、`useExperiment`、feature flag/gate 等；同时检查动态 import/require、反射、环境变量读取和脚本加载路径。普通实验相关词共命中 32 行，全部位于 `.agents/`，不能当作生产实验。供应商名称匹配为 0。

进一步沿实际数据流核对：

1. `server/main.go` → `config.InitConfigFile/ApplyConfig` → 路由与 SQLite。环境变量别名最终用于运行环境、管理员凭据、通知密钥和时区；可配置的环境变量名称也沿使用者核对。
2. `server/handle/comment/list.go` 从实际站点记录和 `captcha.PublicConfigWithContext` 构建公开配置。没有调用被删除的旧 `GetCommentFormConfig`。
3. `packages/client/src/fetch.ts` 归一化 `formConfig/captcha/smoji`，再交给评论组件和验证包装组件。动态脚本加载服务于 CAPTCHA，不是动态实验名称求值。
4. `packages/admin/src/api.ts` 对接站点、CAPTCHA、邮件与 Telegram 设置；枚举对应明确的业务协议。
5. `Dockerfile` 只复制服务端和已构建前端。技能、原型、示例和内部报告不属于容器运行时。

本次没有逐行证明第三方依赖不存在所有可能的隐藏行为；结论是锁文件、源码、配置及已检查数据流均没有 Statsig 接入证据。忽略目录中的本机依赖缓存、私有配置和真实数据没有作为生产事实来源。

## 已实施清理与保留项

以下归属为建议维护角色；仓库没有 `CODEOWNERS`，不推断具体人员。所有源码行号以审计基线为准，删除后行号会变化。

| 工作组 / 文件 | 对象 | 生产取值或可达性证据 | 处理 | CPU 证据 |
| --- | --- | --- | --- | --- |
| 服务端配置 / `server/config/config.go` | `GetSiteConfig`、`GetAdminConfig`、`GetDatabaseConfig`、`GetSQLiteConfig` | 全仓标识符检索均只有声明；未被任何测试、导出表、函数值或反射路径引用 | 删除 4 个旧 getter | 调用次数按当前源码为 0，不能声称有请求 CPU 节省 |
| 服务端配置 / 同文件 | `GetAllAllowedOrigins`、`IsOriginAllowed` | 均只有声明；实际 CORS 使用 `middleware.Cors`、`model.IsPublicOriginAllowedWithContext` 和 `NormalizeOrigin` | 删除 2 个旧来源辅助函数，保留实际校验 | 原函数无调用；其中的遍历不是线上热点 |
| 服务端配置 / 同文件 | `GetManagementKeyBindings`、`IsAdminEnabled` | 均只有声明；真实管理凭据路径仍使用 `GetRegisteredSites/GetManagementKey`；真实路由无前者依赖 | 删除 2 个旧包装函数 | 无运行时调用收益 |
| 服务端配置 / 同文件 | `GetCommentFormConfig` | 唯一声明中把 CAPTCHA 固定为 off、博主证明固定为 false；生产列表直接从 SQLite 设置构造配置 | 删除旧函数，不把它的常量误当成线上取值 | 无运行时调用收益 |
| 配置解码 / 同文件 | `legacyLogPathSet` 与第二次 YAML 解码中的 `presence.Site.LogPath` | 标记只有声明和写入，没有读取；真实 `Site.LogPath` 首次解码、默认值和日志初始化保留 | 删除冗余标记及对应 presence 字段 | 只减少启动时少量解码和赋值；未测量，不给毫秒收益 |
| 配置测试 / `server/config/config_test.go` | `adminUsernameEnv`、`adminPasswordHashEnv`、`adminTokenKeyEnv` | 仅测试引用，逐个别名与已有 default 常量完全相同 | 删除 3 个别名，测试直接使用原常量 | 编译期常量；不计运行时 CPU 收益 |

上述文件属于一个清理工作组，应一起审查以避免测试引用冲突。CI 设计和 AGENTS.md 实验分别属于独立工作组，可以并行审查。

| 保留对象 / 归属 | 已核实值或来源 | 保留原因与 CPU 判断 |
| --- | --- | --- |
| `admin.enabled` / 服务端配置 | 正常 `ApplyConfig` 路径强制 `true`；显式 false 仍产生兼容日志 | 已确认生产启动路径恒定。删除配置字段、兼容日志或 nil/未初始化防护会扩大行为变更；没有昂贵逐请求求值证据 |
| `DEFAULT_CAPTCHA_CONFIG`、`DEFAULT_COMMENT_FORM_CONFIG` / SDK | off、false 等为初始/容错默认值 | 会被列表响应覆盖，也是输入校验回退；不是固定生产实验结果 |
| CAPTCHA provider、Smoji enabled / 服务端与前端 | SQLite 设置或站点记录，未知线上具体值 | 可由管理端改变，影响资源加载及校验边界；缺少生产数据不能常量化 |
| 邮件和 Telegram enabled / 通知 | 实例级 SQLite 配置，未知线上具体值 | 影响实际投递和安全边界，必须保留 |
| `apiBaseUrl`、旧 Turnstile 字段 / SDK 与 API | 兼容公开参数及旧客户端 | 仓库内部引用量不能证明外部用户已迁移；移除会改变兼容契约 |
| `IsBloggerComment` / 模型 | 历史迁移和首次导入回填 | 历史路径仍可到达；运行时直接使用 `comments.is_blogger` 不代表迁移代码无用 |
| 5 个停用 Woodpecker 文件 / CI | `when: [{ evaluate: 'false' }]` | 项目明确要求保留；已经不调度，删除不会节省 CI 分钟 |

未形成「昂贵且无用的线上判断」的可验证发现。不得把缺少 profile 写成 CPU 开销为零，也不得用源码默认值代替生产按用户/站点分组后的取值。需要补充只读 Statsig 资产导出、部署 SHA、曝光/求值统计及相同时间段的 CPU profile，才能完成外部项目和生产热点审计。

## CI 历史与按日节省排序

统计窗口为台北时间 `2026-09-16 00:00 ≤ 创建时间 < 2026-10-16 00:00`。从 GitHub Actions API 获取所有分页运行记录，并获取每次 attempt 的 job/step 数据；这 55 次运行均为单次 attempt。每个 job 按 `completed_at - started_at` 计时，跳过的 job 计 0，平行 job 相加，不把排队时间计入。

窗口内有运行的日期共 8 天，第一条记录为 10 月 2 日；这里仍除以完整 30 天，没有用活跃日放大日均收益。运行结论为 46 次成功、8 次失败、1 次取消；全部实际 job 时间均纳入总量。

| 工作流 | 运行数 | 累计 runner 分钟 | 日均分钟 |
| --- | ---: | ---: | ---: |
| CI | 41 | 119.68 | 3.99 |
| Release | 13 | 78.10 | 2.60 |
| Recover npm publication | 1 | 0.35 | 0.01 |
| 合计 | 55 | 198.13 | 6.60 |

仓库公开，工作流使用标准 GitHub 托管 runner；这里衡量资源时间，不是账单节省。公开仓库的这类运行不产生可计费分钟。[GitHub 计时说明](https://docs.github.com/en/actions/how-tos/monitor-workflows/view-job-execution-time)

为排除旧工作流影响，仅取 `.github/workflows/ci.yml` blob 与当前一致的 5 次验证：`38102714384`、`38102846420`、`38103310885`、`38109051554`、`38330928222`。client/admin/docs/server 的 job 中位数分别为 65/31/41/40 秒。以下使用这些样本的 step 中位数乘以 30 天内对应触发频次，是工程估计，未实施 A/B CI 验证。

| 排序 | 建议 / 归属及文件工作流 | 预估节省分钟/日 | 计算与约束 |
| --- | --- | ---: | --- |
| 1 | 合并前端重复环境准备；CI 维护：`.github/workflows/ci.yml`、`scripts/check-ci.mjs` | **0.75 毛节省** | 两套多余 checkout、pnpm/Node setup 等中位数合计 25 秒 × 54 次验证 ÷ 60 ÷ 30。合并后的依赖安装成本未知，净值须扣除新增成本；串行执行会增加等待时间，需保留各目标失败可见性 |
| 2 | 按组件变化跳过无关测试/构建步骤；CI 维护：上述两文件 | **0.48 毛节省** | client 10 次 × 43 秒、admin 6 次 × 11 秒、server 23 次 × 16 秒，共 864 秒/30 天。仍运行必需 job、依赖安全检查及发布元数据检查；tag 全量验证。需扣除变更检测成本 |
| 3 | 仅纯文档改动跳过应用测试/构建，保留审计；CI 维护 | **0.19 毛节省** | 5 次严格纯文档/约定改动 × 70 秒 ÷ 1800。这是第 2 项的较小替代方案，不可相加 |
| 4 | 安装 Chromium 时加 `--only-shell`；SDK/CI：`ci.yml`、`scripts/check-ci.mjs` | **0.14** | 5 次日志中完整 Chromium 下载为 3.13～5.26 秒，中位数 4.62 秒 × 54 ÷ 1800。当前测试配置 `headless: true` 且没有 channel；保留 headless shell 和系统依赖，仍需 CI 验证 |
| 5 | master 省略 docs artifact 上传，保留构建和校验；CI/文档发布维护 | **0.046** | 未发现自动消费者；2 秒 × 41 次 ÷ 1800。只在确定人工排错也不需要下载时采用，tag 产物策略另行保留 |
| 6 | 删除已经停用的 Woodpecker 验证/发布 YAML | **0** | 已经禁用；而且违反当前保留约定，不建议实施 |
| 未排序 | 缓存 Chromium 二进制 | **净值未知** | 整个安装步骤折算上界为 0.63 分钟/日，但缓存恢复与系统依赖安装会抵消收益，可能为负。没有净收益证据，不建议优先增加缓存 |
| 未排序 | 复用 GitHub docs 产物、减少 Woodpecker 重复构建 | **不可估算** | Forgejo 状态可读，Woodpecker pipeline API 返回 401，缺少 job 时间。会改变独立文档发布契约，不能拿 GitHub 的 21 秒 docs step 冒充 Woodpecker 时长 |

上表不能直接求和：合并前端、组件筛选与浏览器下载优化涉及重叠步骤；前两项为未扣新增成本的毛节省。以当前日均用量看，不宜为了不到一分钟的收益引入复杂构建服务。

`--only-shell` 的适用条件已与当前 Playwright 配置核对；官方也明确区分了完整 Chromium 与 headless shell，并说明浏览器缓存恢复可能与下载同样耗时。[Playwright 浏览器安装](https://playwright.dev/docs/browsers#chromium-headless-shell)、[Playwright CI 缓存说明](https://playwright.dev/docs/ci#caching-browsers)

组件筛选使用相邻 master CI 提交之间全部提交的文件并集，验证祖先关系；第一条缺少窗口内基线，保守不计。`server/`、工作流、部署脚本和共享构建文件按影响范围处理；Node 锁文件或 workspace 改动视为前端受影响，不把 SDK 升版一概当作纯文档。无法恢复确切 push.before 时，跨越取消或未运行提交的文件并集可能高估影响范围，从而低估可跳过次数。

保留安全审计有直接历史依据：[运行 37867107279](https://github.com/DejavuMoe/Ecoku/actions/runs/37867107279) 的变化范围是文档，但 server 在 Go 漏洞检查失败。依赖或源码没有变化不代表漏洞库没有变化。

现有 `scripts/check-ci.mjs` 明确禁止整个必需 job 加条件，且逐段校验脚本。实施第 1～4 项必须同步修改这些契约测试，保留失败阻断语义；不能只在 YAML 上加一个 paths 过滤后宣称完成。初次审计没有修改工作流，后续授权实施记录见文末。

## AGENTS.md 对照实验

选中会话：**「排查管理后台菜单切换抖动」**，会话 ID `01a10c01-e5e5-7673-8a4a-67ad75402295`，2026-10-05。已检查近期 7 个 Ecoku 顶层会话的用户提示词及相关输出，选择该会话是因为批准等待与指令有直接的文字对应。

原始任务提示词为：

> 管理后台目前在切换这几个菜单的时候，页面会产生严重的抖动，请你看看

原会话先报告滚动条引起 7.5 像素横移，并完成原型验证，随后明确因 AGENTS.md 要求而等待批准；用户回复「批准该原型，可以实施」后才修改生产 CSS。这里的问题是指令范围过宽，使恢复既有布局稳定性的修复也进入批准流程。原 agent 按当时指令办事，不能称其违反要求；原会话的 7.5 像素数字也不作为本次重放的实测结果。

**A 组原指令**，历史快照 `AGENTS.md:93`：

> 评论区、管理后台等应用界面：先改已批准原型 → 用户明确批准 → 再改生产代码。不要自行提升未批准的原型版本。

**B 组仅在这条指令末尾追加**：

> 仅恢复既有已批准设计、且不改变布局意图、功能或交互流程的缺陷修复，可直接修改生产代码并同步已批准原型；新设计或交互变化仍须先批准原型。

这只是隔离实验中的候选修订，没有修改当前仓库的 AGENTS.md。不得从该例外推导新设计、交互改变或发布的授权。

控制条件如下：

- 两组从提交 `7ec46b69fe315fdf05fed5cdc57993224fa06fa7` 创建 Windows 隔离 worktree；逐文件 SHA-256 对比确认除 AGENTS.md 外的 800 个跟踪文件输入相同。AGENTS.md 规范化换行后，仅候选修订句不同；A 为 LF，B 写回时为 CRLF，这项格式差异也保存在证据中。
- 相同原始提示词和截图；截图从会话中的原始 PNG 数据恢复，不依赖已失效的临时文件路径。提示词 SHA-256 为 `f9c54bae7a65388766652bfc09f00c39fa0a47f4bc8ddaae56eb5e198e41dbe2`，图片为 `5c0eaaac1a43305429e6ccdeaf428da315f53478e90f9d589b31086dcfecdb9e`。
- 两组均明确指定 `gpt-6-astra`、推理级别 `max`，使用 Codex CLI `0.160.1`、同一 Windows `workspace-write` 原生沙盒，顺序运行 A 后运行 B，不更换模型或 provider。
- 两组使用相同公共实验约束：只处理该提示词、不读其他会话或报告、不操作原始仓库、不提交/推送/发布、不访问真实数据库；需要批准时结束单回合。不向其中一组透露历史根因或预期答案。
- 原历史会话的 CLI 为 `0.160.0`；此次重建的是历史提交和任务输入，并非重建当日全部桌面工具、未跟踪缓存或模型内部权重版本。模型名称相同不能证明后台权重快照永远不变。

先前两次环境预检没有启用本机已经配置的 Windows 原生沙盒，源码读取被策略拒绝。两次预检均保留，排除于正式 A/B 比较。补齐相同的 `windows.sandbox="elevated"` 后重新执行两组，没有扩大到无沙盒模式。正式实验仍受浏览器/WSL 环境限制，因此不能据此证明 UI 修复已经通过实际交互验收。

正式结果如下。时间是单次 agent 回合从 CLI 启动到完成的墙钟时间；A 等待人类批准之后可能发生的工作没有计入。

| 指标 | A：原指令 | B：只修订该指令 |
| --- | ---: | ---: |
| 回合结果 | 原型完成，要求用户批准，生产代码未改 | 生产 CSS 和导航代码已改，原型及 CHANGELOG 同步 |
| 耗时 | 662.68 秒（11 分 3 秒） | 390.92 秒（6 分 31 秒） |
| 可见命令执行项 | 45 | 21 |
| 可见文件修改项 | 3 | 1 |
| 命令非零退出 / 策略拒绝 | 6 / 1 | 3 / 1 |
| 累计输入 token | 2,192,065 | 809,105 |
| 其中缓存输入 token | 2,069,120 | 728,448 |
| 输出 token | 18,228 | 10,851 |
| 其中推理输出 token | 9,406 | 6,299 |
| Standard API 等价值 | 4.2100 美元 | 2.0776 美元 |
| 实际源码及记录改动，不含实验指令 | 7 个跟踪文件，+66/−13 行；另新增 58 行原型说明 | 5 个跟踪文件，+17/−4 行 |

可见操作按 JSON 事件的 item ID 去重，文件修改项是工具批次，不能当作文件数；命令中也可能包含写文件。策略拒绝另取 stderr 计数，不混入成功执行项。非零退出包括搜索无结果，不能一律视为任务错误。A 有一个本地预览服务在记录结束时仍显示运行中，后续检查 `4311` 端口已无监听。

质量复核基于实际 diff 和检查输出：

| 复核维度 | A | B | 结论 |
| --- | --- | --- | --- |
| 根因调查 | 找到滚动条占位缺失与标题 focus 可能触发滚动 | 找到同样的两个源码疑点 | 两组都未测得实际位移；属于有源码支撑的解释，不能称为本次运行已复现 |
| 交付到达程度 | 原型和审批记录，没有生产修复 | 修改历史 Vue 管理端的 `style.css`、`App.vue`，同步 v16 和 CHANGELOG | 候选例外消除了这一回合的批准交接，B 更接近原任务完成 |
| 改动范围 | 还加入当前菜单重复点击保护、标题焦点及旧浏览器滚动条 fallback，更新多份设计记录 | 增加 `scrollbar-gutter: stable`、显式回到页首及 `focus({ preventScroll: true })` | 两组都超出了单行 CSS 修复；滚动与焦点调整有原型对照依据，但缺少实际交互验证 |
| 局部验证 | 原型检查、JS 语法、设计记录校验通过 | 原型检查与 JS 语法通过 | 原型结构检查不能证明生产 UI 无回归；B 没有为生产导航补充行为回归证明 |
| 浏览器与完整验证 | 浏览器/WSL 启动受限，完整验证交 CI | 同样受限，完整验证交 CI | 没有哪组获得完整 UI 验收；实验没有触发 CI |
| 报告证据边界 | 最终明确称源码疑点，声明未确认效果 | 最终声明浏览器未完成，但以「已修复」开头 | B 的措辞略强于现有证据，不能仅凭更快交付认定整体质量更好 |

在这一对样本中，B 耗时减少 **41.0%**，累计输入减少 **63.1%**，输出减少 **40.5%**，API 折算成本减少 **50.7%**。候选修订对减少批准等待和原型记录工作有效；它对最终修复质量的改善尚未证明。建议将例外限定为「有既有批准设计依据的恢复性修复」，并保留对应交互验证要求，不扩大为一般 UI 改动豁免。本次没有将候选句应用到当前仓库。

这是每组一次、顺序执行的探索性实验，没有固定随机种子，没有重置全局工具缓存，且存在上述换行格式差异。时间、token 与工具数还受模型采样、缓存和环境失败路径影响；这些比例不能推广为该规则在所有任务中的平均收益，也不能据此声称已建立严格的成本因果估计。

成本以 CLI `turn.completed.usage` 为原始计数。输入为多次模型调用累计值，缓存输入是其中的子集，推理输出也已经包含在输出 token 中，不重复收费。按当前 GPT-6 Astra 短上下文 Standard API 单价计算等价值：`((输入 - 缓存输入) × 10 + 缓存输入 × 1 + 输出 × 50) / 1,000,000` 美元。它是比较用的 API 折算值，不是本次 ChatGPT 账户实际扣费；长上下文、服务层级和工具费用也不能从这个累计字段完整还原。[官方模型及价格](https://developers.openai.com/api/docs/models/gpt-6-astra)

环境预检额外消耗：A 为 108,069 输入 / 88,192 缓存输入 / 1,861 输出 token，B 为 100,415 / 70,016 / 1,487；标准 API 等价约 0.3800 / 0.4484 美元。它们属于环境失败成本，不计为修订效果。

原始记录保存在 `replay-manifest.json`、`original-prompt.txt`、`original-image.png`、`replay-*-input-hashes.json`、`replay-*-events.jsonl`、`replay-*-stderr.txt`、`replay-*-process.json`、`replay-*.patch` 与 `replay-metrics.json`。`replay-evidence-verification.json` 核对输入哈希、实验指令和最终 patch；A 新增说明单独保存为 `replay-a-navigation-v16.md`。`pilot-replay-*` 是失败预检，不能与正式两组混用。

两份隔离 worktree 保留供复核：`C:/Users/ice/.codex/worktrees/ecoku-agents-replay-a/Ecoku` 和 `C:/Users/ice/.codex/worktrees/ecoku-agents-replay-b/Ecoku`。自动审批拒绝删除 A 的临时浏览器目录及 B 的临时 `node_modules`，原因仅返回 `blocked by policy`；没有改用其他方式删除，相关目录仍保留。实验修改未复制到当前仓库。

## 本地验证、未执行项与复核入口

本地执行：完整资产枚举与引用追踪、`gofmt`、`git diff --check`，以及外部审计脚本 `verify_cleanup.py`。后者确认删除集合恰好为上述 9 个函数，其余 36 个函数中只有 `LoadConfigFile` 去掉未消费的 presence 字段；其他函数体逐字不变。初次清理的测试文件只替换等价常量别名，已删除标识符在运行源码、脚本及测试中没有遗留引用。后续复核补充的日志路径断言见下文。

未在本地重复执行 `pnpm verify:client`、`pnpm verify:admin`、`pnpm docs:build`、Go 全量测试/vet/build；按项目约定交由获准提交后的 CI。初次审计没有提交或触发 CI，历史 CI 成功不能替代这次清理的验证。

原始证据与可重算脚本保存在本机 [审计证据目录](C:/Users/ice/Documents/Codex/Ecoku-audit-20261016)。其中 `asset-inventory.json` 和 `source-hashes-before.json` 固定源码枚举，`runs-pages.json`、`jobs-*.json`、`ci-job-ledger.json` 保存 API 数据，`ci-path-classification.json` 保存逐次变更范围，`ci-summary.json` 保存计算结果。`collect_ci.py`、`analyze_ci.py` 和 `verify_cleanup.py` 可复核本次计算，不属于产品运行代码。

## 后续授权实施与复核

2026-10-16，用户授权只实施 `--only-shell` 优化，将清理和本报告一并提交推送，CI 正常后按既有流程发布 v0.5.1。

- `.github/workflows/ci.yml` 的浏览器安装命令增加 `--only-shell`，保留 `--with-deps` 和原浏览器测试步骤。未实施其余 CI 优化。
- `scripts/check-ci.mjs` 同步精确命令校验，并以两个变异样例分别确认移除系统依赖安装或移除 `--only-shell` 都会被拒绝。
- 重新核对真实 CORS、管理凭据与评论表单配置调用路径，确认均不依赖删除的函数。第一次 YAML 解码仍启用 `KnownFields(true)`，保留 `Site.LogPath` 的类型及未知字段校验。
- 在现有 `TestLegacyDeploymentFieldsRemainReadable` 中补充 `LogFilePath` 保留原值的断言。测试其余修改仍只是等价常量替换；完整 Go 测试由 CI 执行。
- 本地 `node scripts/check-ci.mjs`、`node scripts/check-release.mjs --self-test`、当前版本元数据检查及 `git diff --check` 均通过。正式 CI 与发布状态以随后对应提交的运行结果为准。
