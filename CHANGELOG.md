# 更新日志

本项目遵循 [Semantic Versioning](https://semver.org/)。正式发布前的候选版本可能继续调整 API、
配置和数据库结构；升级前必须阅读对应版本说明并备份 SQLite 数据库。

## [Unreleased]

### 变更

- 新增 GitHub Actions 验证与 tag 发布流程：缓存依赖、并行验证前后端与文档，原生构建 GHCR 双架构镜像，以同版本发布 npm SDK，成功后创建附带 SDK 包与校验和的 GitHub Release。Woodpecker 配置和文档部署保持不变。
- 将 YAML 字段、默认值、可选值和示例集中到完整注释模板，部署页与配置参考直接引用四语模板；旧兼容字段保持注释。
- 文档在 Markdown 解析后统一补齐链接、粗体、斜体、删除线和行内代码与相邻正文之间的半角空格，保留代码块和链接地址原样。
- 站点的 Smoji 设置新增选填的图片来源，支持自行托管工作台导出的 JSON、继续从指定 CDN 加载图片；留空保持原来的清单同源规则。清单加载、评论提交、评论显示和邮件通知统一使用管理员配置的来源。
- schema v11 为站点新增 `smoji_image_origin`，旧站点默认留空，保留已有配置和评论。升级前应停服冷备份；回滚到 schema v10 需恢复升级前备份。
- Compose 模板直接设置 `TZ: Asia/Shanghai`；四种语言的部署文档补充公网地址、文件权限、可信代理和时区的用途及操作链接。
- 文档站保留原有布局，统一使用管理后台的纸墨明暗配色、系统字体、代码高亮与 Mermaid 图表颜色，调整正文排版和卡片样式。

### 修复

- 修正文档搜索翻译的初始化顺序与默认语言配置，简中搜索按钮和提示正确显示中文。

## [0.2.9] - 2026-10-02

### 变更

- 新实例不再要求填写管理员密码哈希、会话签名密钥或通知加密主密钥。首次启动自动创建 `admin`、随机临时密码和 `data/ecoku-secrets.json`，首次登录必须设置正式用户名和密码。
- 增加 schema v10 持久管理员账户表、首次改密会话和本机 `admin reset-password` 命令。改密成功后临时会话失效，并直接进入后台的「新增站点」状态。
- v0.2.8 及更早实例继续读取旧的管理员环境变量、通知主密钥、数据库路径、文件日志路径、YAML `sites` 和 `management_key_env`。升级时先导入持久状态；确认运行正常后可停服备份并删除旧环境变量，让程序改用 `/data`。
- 新部署 Compose 删除 `env_file` 和 `app/logs` 挂载，日志写到 stdout；旧 Compose 在兼容期内仍可运行。

### 修复

- 管理后台的标签页图标不再返回 404：服务端提供 `/admin/favicon.svg`；静态目录里没有该文件时服务照常启动。
- Chrome 中保存设置后，可编辑字段不再残留只读字段的虚线下划线。
- 通知收件人与接收目标 ID 的格式错误显示在说明文字下方，不再被挤成一字一行。
- 回复引用中的表情包显示为 `[表情：标签]`，不再显示原始标记。
- 删除评论后，该评论在原位淡出，列表不再闪现加载骨架，滚动位置保持不变；从回复引用跳到父评论时恢复短暂高亮。
- 保存栏打开时，提示消息显示在保存栏上方，不再与之重叠；连续出现相同的提示时会重新显示并重新朗读。
- 会话过期导致页面刷新后，登录页显示“管理会话已过期，请重新登录。”。
- 四种语言的文档首页统一使用已批准的「區」标识，与导航栏及 favicon 一致，移除旧首页图像。

### 文档

- 配置、API、部署、备份与本地开发说明同步精简；部署页改为自动创建管理员与密钥，旧实例迁移步骤独立说明。四种语言新增 v0.2.9 升级说明，包含 schema v10、首次启动、旧配置兼容、持久密钥迁移、日志挂载与回滚。
- 管理后台说明中的站点字段改为「访客邮箱」「访客网站」两行；英文、日文 Smoji 说明恢复与标记示例一致的清单示例和标记格式占位。

## [0.2.8] - 2026-10-01

### 变更

- 管理后台改为按日期分组的评论流与就地删除确认；设置表单采用行式字段，只在有修改时显示保存栏，并在离开前确认；增加键盘快捷键与窄屏底部导航。管理后台与文档站更新为「區」印章标识。
- 官方镜像内置容器路径：`site.log_path`、`client.static_dir`、`admin.static_dir`、`database.sqlite.path` 省略时分别取 `/var/log/ecoku/ecoku.log`、`/app/client`、`/app/admin`、`/data/ecoku.sqlite3`，`admin.enabled` 省略时为 `true`；源码运行的默认值不变，已显式写出的字段仍然优先，旧配置文件无需修改。
- `admin.username_env`、`admin.password_hash_env`、`admin.token_key_env`、`notifications.encryption_key_env` 省略时使用标准变量名 `ECOKU_ADMIN_USERNAME`、`ECOKU_ADMIN_PASSWORD_HASH`、`ECOKU_ADMIN_TOKEN_KEY`、`ECOKU_NOTIFICATION_ENCRYPTION_KEY`。
- `admin.allowed_origins` 省略时取 `notifications.instance_public_url` 的来源。
- 部署模板精简：`app/config.yaml` 只需 `notifications.instance_public_url`；`ecoku.env` 去掉 `GIN_MODE`（镜像已设置）；`compose.yaml` 去掉 `logging` 段，改用 Docker 守护进程的日志设置。

### 修复

- 站点保存失败时保留未保存的名称、博主口令等草稿，不再恢复为旧配置；通知和安全设置加载失败时禁用表单并提供重试。

### 文档

- Docker 部署页改为三个文件的填写说明：给出 `ecoku.env` 的字段与示例，只为密码哈希和两把密钥提供生成命令；配置参考标注容器内默认值。
- 管理后台操作说明同步评论流、设置保存与快捷键；新增四语言 v0.2.8 升级说明，注明 schema v9 不变，以及采用精简配置后的回滚步骤。

## [0.2.7] - 2026-09-29

### 变更

- 通知邮件按已批准的 v6 设计改版：配色、6px 圆角与深色模式改用评论区 v17 / 管理后台 v13「纸与墨」token，正文与标题使用系统自带的中英文无衬线字体栈（Georgia 只用于 `Ecoku` 字标），改为表格布局并兼容 Outlook；新增预览摘要，主按钮改为墨色。
- 邮件主题在原标题后追加“：[文章标题]”，不同文章的通知不再被邮箱合并成同一会话；页面没有标题时不追加。新回复邮件补充文章标题与发布时间，访客回复邮件补充文章标题与回复时间，博主本人的评论显示博主标志。
- 邮件发件人显示为站点名称，并补充 `Date`、`Message-ID`、`Auto-Submitted: auto-generated` 与 `X-Auto-Response-Suppress` 头。
- Telegram 通知增加发布时间，被回复的评论改用引用块并注明作者；正文上限由 1200 调整为 1000 个字符，确保加入新字段后仍不超过 Telegram 长度限制。
- 删除评论时同步处理通知：尚未发出的通知取消；发往被删除评论私有邮箱的访客回复邮件从队列中删除；已发出的 Telegram 消息改写为“这条评论已被删除，通知内容已移除。”。已发出的邮件无法撤回。
- 通知队列：收件邮箱被拒（SMTP 55x）或 Telegram 会话不可用（HTTP 400/403）时不再重复尝试；Telegram 限速（HTTP 429）按 `retry_after` 推迟；用完 8 次尝试的记录标为已放弃，不再被反复扫描；已完成的记录保留 30 天后自动清理。

### 修复

- 邮件中的表情包不再显示为 `![smoji:…](…)` 原始标记：与当前表情包清单同源时显示为图片，否则显示为 `[表情：标签]`；Telegram 与纯文本邮件同样显示为文字标签。
- 邮件时间改为与评论区相同的显示时区并注明 UTC 偏移，不再固定按 UTC 显示且不加说明。
- 在 Windows 等缺少对应字体的邮件客户端中，正文与标题的中文不再回落为宋体。
- 评论已被删除时，不再向博主投递内容为空的通知。

### 数据库

- schema v8 → v9：原位重建 `notification_outbox`，增加 `exhausted` 状态、Telegram 撤回事件、`provider_message_id` 与按评论的索引；保留全部记录、id 与自增序号，已用完 8 次尝试的失败记录改为 `exhausted`。迁移在单个事务中完成，无向下迁移，升级前需停服冷备份。

### 文档

- 「通知」页更新邮件内容、主题格式、时区与表情包显示、Telegram 字段、不可重试的失败与记录保留期，新增「删除评论之后」一节；「管理后台」的墓碑删除说明链接到该节。
- 按源码核对四语言的接口、命令行、配置、Docker 部署、备份恢复、人机验证、Twikoo 迁移与常见问题页面：补充 `405`/`413`/`429`/`503` 等状态码、`afterId` 分页、站点 `revision` 与 `409` 冲突、管理密钥权限范围、`--dry-run` 输出与快照恢复步骤；`ecoku.env.example` 顶部说明改为只列出为空时拒绝启动的变量。
- 新增 v0.2.7 升级说明。

## [0.2.6] - 2026-09-29

### 变更

- 管理后台按已批准的 v13 设计统一视觉：配色、圆角与深色 token 改用评论区 v17「纸与墨」，界面字体改为系统自带的 CJK 与英文字体栈，不加载网络字体；移除原系统衬线栈与蓝灰强调色。功能、接口与数据不变。
- 站点切换从顶栏移至「评论管理」列表左上角，窄屏同样可用；只有一个站点时显示为静态名称。「通知设置」「安全」不再显示站点选择器。
- 「评论管理」：详情操作移至顶部工具栏；仍有回复的墓碑显示“仍有回复，不能彻底删除”；删除确认框列出目标评论并以操作名作为按钮；列表增加加载骨架、失败重试与上下方向键切换；分页改为图标按钮与合计条数。
- 「站点管理」：表单分为基本信息、评论区、表情包、博主身份四组，保存栏固定在底部，校验失败时提示需要修改的数量并聚焦第一处错误。
- 「通知设置」：SMTP 服务器与端口同行，加密方式改为 SSL/TLS / STARTTLS 分段选择，端口占位随加密方式变化；渠道关闭时收起字段并提示需保存；移除固定勾选的「访客收到回复时」复选框，改为说明文字。
- 「安全」与登录页按新视觉重排；Cap 组件保留官方 260×58px 几何，外框圆角跟随后台 token。

### 文档

- 管理后台文档同步站点切换位置、表情包开关与“仍有回复，不能彻底删除”提示；通知文档移除固定勾选选项的说明。
- 按源码重写四语言文档站点：导航调整为指南、部署、接入、参考四组；新增「通知」「人机验证」「命令行」页面，配置参考移至 `reference/configuration`；被链接的标题统一使用跨语言共享的 ASCII 锚点。
- 修正与实现不符的说明：npm 包 `ecoku` 尚未发布，SDK 改为从实例加载 UMD；Cap 实例必须是公网 HTTPS 地址；`admin.allowed_origins` 不能与站点来源重复；删除与测试通知的限流分别计数；通知重试间隔与次数；深层回复 `@被回复者` 的显示层级；加载器缺少属性时静默跳过。
- 各版本升级说明统一为发布信息、变更、兼容性、升级、回滚五部分；文档站点自身的发布说明移至 `docs/contribute/docs-deploy.md`。

## [0.2.5] - 2026-09-26

### 变更

- 评论区默认样式改为已批准的 v17「纸与墨」：身份字段为横线填写栏，正文直接写在发表卡片上；唯一的实心墨色主按钮，表情、预览、取消与排序为文字按钮；悬停只改变文字颜色；6px / 3px 圆角，时间、折叠、字数与页码使用等宽字体；博主标志、链接悬停与表单错误使用朱砂强调色；Cap 保留官方 260×58px 几何，外框圆角改为跟随 Ecoku token。评论行为、文案与 DOM 类名不变。
- 默认 `--ecoku-*` 变量改为零优先级声明，宿主在 `.ecoku-comments` 上写同名变量即可覆盖，不再需要提高选择器优先级。新增 `--ecoku-accent`、`--ecoku-danger`、`--ecoku-radius`、`--ecoku-radius-sm`、`--ecoku-shadow`、`--ecoku-font-mono`、`--ecoku-font-size`、`--ecoku-font-size-small`、`--ecoku-font-size-title`；`--ecoku-focus` 现用于键盘焦点框。已有宿主覆盖样式可能与新默认值叠加，升级后请检查自定义 CSS。
- 触屏设备上的评论输入框不小于 16px，避免 iOS 聚焦时放大页面。

### 修复

- `data-theme="auto"` 不再固定 `color-scheme`，改为继承宿主页面；站点手动切换明暗且与系统设置不一致时，使用 `light-dark()` 定义颜色的宿主不再出现评论区反色。博主标志颜色随之跟随宿主明暗。
- Turnstile 服务端验证禁止跟随 HTTP 重定向；收到重定向时按验证服务不可用处理，保留现有超时和失败关闭行为。
- 修正四语言升级导航的最新版本标记，从 v0.2.2 移至已发布的 v0.2.4，与升级正文一致。
- 核对 v0.2.3 / v0.2.4 tag 与当前源码，同步四语言 VitePress 发布状态、配置默认值、API 响应示例与 SDK 接入片段；修正 SMTP 端口、环境变量重建、加密存储和 Twikoo 预检/导入说明，清除过时 Smoji 示例描述。v0.2.4 已发布，历史章节中的发布准备提示不再代表当前状态。
- 文档站点 Nginx 模板补充 `.html` 路径匹配，适配 VitePress `cleanUrls`，修复文档内页直接访问或刷新时返回 404。

### 部署

- 文档 CI 改为仅挂载单站点目录，使用 `html → releases/<发布标识>` 与站点内 `.deploy.lock`；保留原子切换，成功后仅保留当前版与刚被替换的上一版，清理更早发布目录；失败或过期发布不触发清理。首次发布前需将旧站点软链接改为实体目录，并调整 Web 服务根目录至 `html`。

## [0.2.4] - 2026-09-16

发布准备：等待 master CI 验收与 tag 发布；镜像尚未发布。

### 修复

- 验证码先于博主口令比较与身份校验，阻止缺少或无效 CAPTCHA 时探测口令是否命中。
- 访问日志仅记录路由模板，未知路由使用固定值，阻止路径控制字符注入及动态路径内容写入日志。
- 新回复最多 16 层后代，拒绝第 17 层并提示回复较上层评论；保留历史数据和既有读取预算。

### 管理会话

- 管理后台改为 HttpOnly Cookie 与 SQLite 可撤销会话，登录后固定 8 小时，刷新和关闭重开可恢复且不续期；退出撤销当前会话，失败保留界面并提示重试。
- 登录响应不再返回 token；新增会话恢复和退出接口。Cookie 写操作与登录校验管理端 Origin；旧版未登记 Bearer 失效。

### 升级

- schema v7 → v8，仅新增管理员会话表及索引，原位事务迁移，保留业务数据和历史迁移记录。回滚旧镜像必须恢复升级前整库冷备份。
- `admin.token_ttl_minutes` 固定为 480（可省略）；旧自定义值需调整。同步四语言会话、API、配置及 v0.2.4 升级指南，纠正历史回填与验证码 IP 文档。

### 文档


- 文档首页插图悬停时保持居中，修复向右下方偏移的问题；简繁中文标题按语义分行，避免单字落行。

## [0.2.3] - 2026-09-16

发布准备：等待 master CI 验收与 tag 发布；镜像尚未发布。

### 修复

- 停止站点设置保存时重授博主身份；口令显式校验 UTF-8 72 字节上限，保留已有 bcrypt 哈希。
- SMTP 全流程可取消并受 20 秒期限约束；通知完成写回失败时保留结果重试，输出脱敏诊断；Telegram 在转义前裁剪文本，保留完整链接。
- Twikoo 导入保持乱序父子关系，按最终关系统计根评论与回复。
- 评论和管理文本输入允许完整 Unicode 字符；管理请求取消、超时与迟到结果分离；Loader 超时可真正重试并销毁旧实例。
- Smoji 默认端口与括号路径正常往返；补齐选择器键盘与 ARIA 关联，清理迟到清单和回复验证码。
- SDK `setPageKey(pageKey, pageTitle?)` 同步标题，省略时清空；四语言同步权限安全的备份/升级流程、配置默认值、监听地址与版本导航。

### 升级

- 保持 schema v7、已有迁移、环境变量、挂载和已保存配置兼容，不清理或批量改写历史数据。旧版本已误标的博主记录无法自动识别，需另行核实处理；通知仍为至少一次投递语义。


## [0.2.2] - 2026-09-13

### 修复

- Smoji 选择器改为对齐评论或回复表单底栏右侧，宽度不超过底栏，修复窄屏下弹层左侧超出页面的问题；默认样式与无主题样式同步调整。

## [0.2.1] - 2026-09-12

### 修复

- Smoji 容量与当前素材库对齐：64 包、每包 600 项、总计 6000 项、1 MiB UTF-8；流式限制正文大小，8 秒超时覆盖完整下载，补齐 JSON 类型、标签控制字符和图片 URL 校验。

### 新增

- Smoji v1 支持可选 `base` URL 模板，条目可省略重复 `src`；保留旧格式和显式地址覆盖，展开后维持同源限制。无 UI 布局、数据库或配置键变化。

## [0.2.0] - 2026-09-12

### 文档与接入

- 全面审查并校正文档中的 API、配置、部署、备份恢复、反向代理与 Twikoo 导入说明，统一四套语言文档的运行时契约。
- 补充评论列表预算、游标分页、读取限流、状态码和管理端接口参考；完善 HTML、Hugo、SDK、Smoji 接入示例。
- 修正 `import-twikoo` CLI 语法与参数名称（`--site`），修正评论提交请求体字段（`mark`/`content`）与状态码（201 Created），补全管理端端点与配置字典种子说明。
- 重构 VitePress 文档导航、搜索、Mermaid 图表与响应式样式，并新增根 README 的快速开始和文档索引；`master` push 自动发布文档。

### 升级边界

- 本版本不改变 SQLite schema、运行时镜像构建契约、环境变量或 Compose 挂载；升级仍使用精确镜像 tag。
- 从 v0.1.9 升级：停服冷备份 → 修改精确镜像 tag → `sudo docker compose pull && sudo docker compose up -d` → 健康与业务检查。详见四套文档的 `self-hosting/upgrades/v0.2.0`。

## [0.1.9] - 2026-08-31

### 修复

- 修复公开评论列表 CWE-400：完整线程读取限制为 16 层后代、200 个节点及 1 MiB JSON；统计最多检查同站点/页面的 10,000 条 ID/父关系，查询共享只读快照与 2 秒超时，并限制最多 4 个列表处理并发。超预算返回 422，不静默截断；新增 `parentId` / `afterId` 单层游标分页，大页面可按需读取。现有 SDK 继续使用完整线程模式，超预算显示既有加载失败状态，不自动抓取分页。
- 新增 `rate_limit.comment_list`，默认每 IP 每 60 秒 60 次，复用可信代理与 429 / `Retry-After` 行为；各限流器最多保留 10,000 个活跃地址桶，容量用尽拒绝新地址而不淘汰活跃桶。未配置新键时使用默认值；无 schema、环境变量或 Compose 挂载变化。
- 列表限流、并发预算和超时在 CORS 查询前生效（包含预检和非法来源），来源查询改为单条存在性检查；SQLite 连接重建时重新应用外键、同步级别和忙等待设置，避免取消事务导致后续连接失去外键约束。

### 升级边界

- 从 v0.1.8 升级保持 schema v7，不新增迁移、环境变量、挂载或容器权限要求；旧配置省略 `rate_limit.comment_list` 时使用默认值。预算内的 SDK 响应不变，超大线程/页面可能返回 422；未配置可信代理时代理后的访客可能共享读取额度。详见四套文档的 `self-hosting/upgrades/v0.1.9`。
- 升级顺序：停服冷备份 → 修改精确镜像 tag → `sudo docker compose pull && sudo docker compose up -d` → 健康与业务检查。需等待目标镜像发布完成；CI 不部署生产、不操作生产库。
- 回滚到 v0.1.8 前删除新增的 `rate_limit.comment_list` 或恢复旧配置，否则旧版会因未知字段拒绝启动。两版都是 schema v7，通常可保留当前数据库回滚镜像；只有确认数据异常并接受丢失备份后新增数据时，才显式恢复冷备份。回滚会重新暴露 CWE-400。

## [0.1.8] - 2026-08-27

### 新增

- 站点管理新增可选 Smoji 开关与单一远程清单 URL；评论区只在首次打开选择器时动态加载 v1 清单，不在 Ecoku 镜像中打包表情资源；
- 表情选择结果以包含完整直链的 `![smoji:标签](URL)` 标记保存，公开渲染使用安全 DOM 图片节点，功能关闭时按纯文本显示历史标记；评论预览与管理端评论查看也遵循同一安全渲染边界。

### 升级边界

- SQLite schema 从 v6 原位、事务性升级至 v7，为 `sites` 增加 Smoji 启用状态与清单 URL。无新增环境变量、配置键、Compose 挂载或容器权限要求。升级前须停服冷备份；写入 v7 后若回滚旧镜像，必须恢复停服前的整库备份。

## [0.1.7] - 2026-08-26

### 变更

- 本地开发、CI 与容器构建工具链固定为 Node.js 24.19.0、Go 1.27.0、pnpm 11.24.0；移除 Corepack 依赖并统一使用 pnpm。运行时镜像仍为 Alpine 3.24.1；
- Woodpecker 完整前后端/服务端门禁改为只在 `master` push 与目标为 `master` 的 pull request 运行；`v*` tag 只做版本/Compose 一致性校验，随后直接并行构建 amd64/arm64 镜像并发布 manifest，不再重复同一提交的完整测试；
- 保留并说明每架构独立的 BuildKit registry cache（`mode=max`），避免多架构 cache manifest 相互覆盖；
- 文档改为 `docs/` 下的 VitePress 站点（pnpm workspace）：简体中文为默认语言，另有繁体中文、英语、日语；覆盖介绍、特性、Docker 自托管、反向代理、后台配置、备份、Twikoo 导入、按 tag 升级说明与常见问题。产品约束移至 `docs/internal/`，不进入站点导航。CI 增加 `pnpm docs:build` 与输出边界检查；
- 新增仅限 `master` manual 的文档构建/发布流程，固定调度到文档服务器 agent；候选完整验证后通过 trusted volume 原子替换 `/var/www/docs.via.moe` symlink，并立即尝试删除旧候选。该流程不依赖完整测试流程；
- 本地构建产物、运行数据与一次性发布验证统一放在根目录 `tmp/`，并从 Git 与 Docker 构建上下文排除。

### 升级边界

- 本版本不改变 SQLite schema，仍为 v6；不新增环境变量、Compose 挂载或配置键；
- 容器仍以 UID/GID `10001:10001` 运行，`/data`、配置与日志挂载路径不变；从 `v0.1.6` 升级不需要调整容器权限；
- 从 `v0.1.6` 升级仍须先停服冷备份，再把 `compose.yaml` 的精确镜像 tag 改为 `v0.1.7`，然后执行 `sudo docker compose pull && sudo docker compose up -d`；
- 回滚时改回 `v0.1.6`。两版均使用 schema v6，一般不必替换数据库；若启动或验证异常，仍使用停服前备份恢复。

## [0.1.6] - 2026-08-18

### 修复

- 修复启用 Cap instrumentation 后管理员登录持续 `instr_timeout`：当前 Cap 3.x 生成的 sandboxed instrumentation 脚本会调用 `eval` / `new Function`，管理端仅在 Cap 为当前启用方式时为其精确 Origin、WASM、Blob Worker 和 nonce 额外开放 `script-src 'unsafe-eval'`；关闭或切回 Turnstile 后即使保留 Cap 配置也不会继续放宽 CSP；
- 补充三态 CSP 回归测试，并修正严格 CSP 文档：`'wasm-unsafe-eval'` 只允许 WebAssembly，不能代替 instrumentation 所需的 JavaScript `'unsafe-eval'`。拒绝这一安全权衡的宿主必须关闭该 Cap Key 的 instrumentation 或改用 Turnstile，不能用 `*`、`unsafe-inline` 或自动降级绕过。

### 升级边界

- 本版本不改变 SQLite schema，仍为 v6；不新增环境变量、Compose 挂载或配置键；
- 从 `v0.1.5` 升级仍须先停服冷备份，再把 `compose.yaml` 的精确镜像 tag 改为 `v0.1.6`，然后执行 `sudo docker compose pull && sudo docker compose up -d`；
- 若曾为恢复管理员登录而暂时关闭 Cap instrumentation，升级后先确认管理端响应 CSP 只在 Cap 模式包含 `'unsafe-eval'`，再重新开启 instrumentation，并分别验证管理员登录与评论提交；
- 回滚时改回 `v0.1.5`。两版均使用 schema v6，一般不必替换数据库；若启动或验证异常，仍使用停服前备份恢复。

## [0.1.5] - 2026-08-17

### 变更

- 实例级机器人验证改为关闭 / Cloudflare Turnstile / 自托管 Cap 三态选择，同时保护访客评论与管理员登录；Turnstile 兼容保留，Cap 从配置实例加载 Widget/WASM 并使用 JSON Siteverify，浏览器统一提交单次 `captchaToken`。
- 管理端和评论区采用已批准的安全 v12 / 评论 v16：Cap 保留官方 260×58px 几何、SVG 状态与署名，只映射 Ecoku 颜色和字体 token；两套 Secret 分别加密且只回显「已设置」。
- 增加停服运维命令 `captcha status` / `captcha disable`；故障恢复显式关闭当前验证但保留两套配置，不提供自动降级或环境变量绕过。
- 管理端 CSP 为 Cap 实例 Origin、WASM、Blob Worker 和 instrumentation 生成精确 nonce；Cap HTTPS 出站 Siteverify 拒绝重定向、localhost、私网和非公网解析结果。

### 升级边界

- SQLite schema 从 v5 升到 v6：事务性把 `turnstile_settings` 重命名为 `captcha_settings`，保留现有开关、Sitekey、加密 Secret 与 revision，默认 provider 为 Turnstile，再增加 Cap 实例、Site key 与加密 Secret 字段；
- 升级前必须停服冷备份。已写入 v6 的数据库不能只换回旧镜像；回滚必须恢复停服前的整库备份；
- 升级后若选择 Cap，需在 Cap Key 中允许管理端与全部评论站点 Origin，并验证严格 CSP、Widget/WASM、管理员登录和评论提交。

## [0.1.4] - 2026-08-15

### 变更

- 文档：新增 `docs/README.md` 索引与 `docs/development/local-setup.md` 本地开发指南；自托管指南补充目录、限流拓扑表、Cloudflare CDN 示例、`caddy fmt --overwrite`、定时冷备份与故障排查表。
- 测试：管理端站点更新保存博主口令时回填历史 `is_blogger` 评论。

### 升级边界

- 本版本不改变 SQLite schema，仍为 v5；
- 从 `v0.1.3` 升级必须先停服做冷备份，再把 `compose.yaml` 的精确镜像 tag 改为
  `v0.1.4`，然后 `sudo docker compose pull && sudo docker compose up -d`；
- 回滚时改回 `v0.1.3`。本次未写入新 schema，一般不必替换数据库；若启动失败，仍用停服前备份恢复。

## [0.1.3] - 2026-08-15

### 变更

- 博主身份改为口令证明：管理端配置昵称、邮箱和口令；公开评论区只在昵称栏填口令，服务端改写为配置昵称、私有邮箱和站点 URL。评论展示徽章、昵称与站点链接，无头像。`isBlogger` 读取存储字段；升级到 schema v5 以及保存口令时按昵称+邮箱回填历史博主评论。
- 通知按入队时的每个收件人/目标拆成 outbox 行，投递时不再重判渠道或是否博主；worker 启动收回全部 `processing` 行。SMTP 只允许 TLS/STARTTLS，邮件改用随机 MIME boundary 与 quoted-printable。
- management key 对评论 GET 列表/详情返回 403，只保留所属站点墓碑删除。评论提交请求体上限约 80KiB。禁止 `trusted_proxies` 为 `0.0.0.0/0` 或 `::/0`。
- 补记：Git 上存在 `v0.1.0-rc.4` 标签，当时未留下对应 CHANGELOG 章节。

### 升级边界

- 本版本把 SQLite schema 从 v4 升到 v5（博主口令哈希、`comments.is_blogger`、outbox `target`）；
- 从 `v0.1.2` 升级必须先停服做冷备份（主库 + 确认无 WAL/SHM），再把 `compose.yaml` 的精确镜像 tag 改为
  `v0.1.3`，然后 `sudo docker compose pull && sudo docker compose up -d`；
- 启动后在管理端为站点设置口令，历史博主评论会被回填；
- 回滚必须换回 `v0.1.2` **并** 用停服前备份整库恢复。已写入 v5 的库不能跑在 `v0.1.2` 上。

## [0.1.2] - 2026-08-15

### 修复

- 评论昵称与时间按基线对齐，字号改为 14px，略大于时间与折叠/回复。

### 升级边界

- 本版本不改变 SQLite schema，仍为 v4；
- 从 `v0.1.1` 升级必须先停服做冷备份，再把 `compose.yaml` 的精确镜像 tag 改为
  `v0.1.2`，然后 `sudo docker compose pull && sudo docker compose up -d`；
- 回滚时改回 `v0.1.1`。本次未写入新 schema，一般不必替换数据库；若启动失败，仍用停服前备份恢复。

## [0.1.1] - 2026-08-15

### 修复

- 折叠按钮 `[+]` / `[-]` 按三字符等宽完整显示，不再被 16px 裁成竖条。

### 升级边界

- 本版本不改变 SQLite schema，仍为 v4；
- 从 `v0.1.0` 升级必须先停服做冷备份，再把 `compose.yaml` 的精确镜像 tag 改为
  `v0.1.1`，然后 `sudo docker compose pull && sudo docker compose up -d`；
- 回滚时改回 `v0.1.0`。本次未写入新 schema，一般不必替换数据库；若启动失败，仍用停服前备份恢复。

## [0.1.0] - 2026-08-15

### 修复

- 评论提交的页面 key 只接受站内相对路径；通知「查看原文」链接解析后必须仍落在站点 host 上。

### 变更

- 评论区采用已批准的 v15：发表框/回复框与已发布正文同字号、同颜色、同行高；接入外壳不再显示
  「正在加载评论…」，保留加载失败重试与「评论服务尚未配置」。
- `[+]` / `[-]` 折叠控件提高选择器优先级，固定 16px 等宽，避免被宿主 `font: inherit` 撑成不等宽。
- 管理端采用已批准的 v11 系统衬线栈：`Noto Serif SC`、`Noto Serif CJK SC`、`Songti SC`、`STSong`，
  不加载网络字体。
- 接入可指定 JS/CSS URL。默认仍注入样式；设置 `data-css-url` / `cssURL` 后不再注入。容器提供
  `/client/ecoku.css` 与结构用 `/client/ecoku.unstyled.css`。Hugo 示例增加可选 `js_url` / `css_url`，
  并补充通用 HTML 示例。
- 浏览器 SDK npm 包版本改为 `0.1.0`。

### 升级边界

- 本版本不改变 SQLite schema，仍为 v4；
- 从 `v0.1.0-rc.10` 升级必须先停服做冷备份，再把 `compose.yaml` 的精确镜像 tag 改为
  `v0.1.0`，然后 `sudo docker compose pull && sudo docker compose up -d`；
- 回滚时改回 `v0.1.0-rc.10`。本次未写入新 schema，一般不必替换数据库；若启动失败，仍用停服前备份恢复。

## [0.1.0-rc.10] - 2026-08-15

### 变更

- 评论区采用已批准的 v14：身份输入与标签同为 12px、正文色；Turnstile 宿主槽不超过 300px；
  已有身份时回复框不再显示「以某某身份回复 / 更换」。

### 升级边界

- 本版本不改变 SQLite schema，仍为 v4；
- 从 `v0.1.0-rc.9` 升级必须先停服做冷备份，再把 `compose.yaml` 的精确镜像 tag 改为
  `v0.1.0-rc.10`，然后 `sudo docker compose pull && sudo docker compose up -d`；
- 回滚时改回 `v0.1.0-rc.9`。本次未写入新 schema，一般不必替换数据库；若启动失败，仍用停服前备份恢复。

## [0.1.0-rc.9] - 2026-08-15

### 修复

- 管理端登录和评论区加载 Cloudflare Turnstile 时不再对带 `async` 的 `api.js` 调用
  `turnstile.ready()`。先前该调用会抛错且 Promise 挂起，登录页验证槽不出现，提交后提示
  「请完成验证后再登录」。

### 升级边界

- 本版本不改变 SQLite schema，仍为 v4；
- 从 `v0.1.0-rc.8` 升级必须先停服做冷备份，再把 `compose.yaml` 的精确镜像 tag 改为
  `v0.1.0-rc.9`，然后 `sudo docker compose pull && sudo docker compose up -d`；
- 回滚时改回 `v0.1.0-rc.8`。本次未写入新 schema，一般不必替换数据库；若启动失败，仍用停服前备份恢复。

## [0.1.0-rc.8] - 2026-08-15

### 变更

- 评论区采用已批准的 v13：根评论与回复发表框在正文下方挂载自适应 Cloudflare Turnstile；
  未启用时不显示验证槽。公共列表增加 `formConfig.turnstileSitekey`（空字符串表示关闭），不含 Secret key。
- 管理端增加已批准的「安全」页：实例级 Sitekey / Secret key，同时用于访客评论和管理员登录。
  Secret key 加密存储，界面只显示「已设置」。管理员静态页 CSP 允许 `challenges.cloudflare.com`。
- 评论区采用已批准的 v11：内联回复框与根评论发表框共用卡片与 32px 按钮；`[+]`/`[-]` 等宽；
  匹配博主身份的评论在昵称后显示可配置标志（默认 `[博主]`）。公共列表增加 `isBlogger` 与
  `formConfig.bloggerBadge`，不含邮箱。
- 评论区采用已批准的 v10 元信息行：时间戳、`[+]`/`[-]` 折叠与「回复」同列展示；时间格式为
  `YYYY-MM-DD HH:mm`，悬停提示为英文 IANA 时区与偏移。公共列表响应增加 `timeZone`，读取容器
  `TZ`（IANA）；未设置时回退 `Asia/Shanghai`。`TZ` 只写入 `ecoku.env`，不进入 `config.yaml`。
- 评论加载器在页面就绪后立即初始化，不再等待滚动到附近；宿主占位文案改为「正在加载评论…」。
- 自托管文档与仓库根 `compose.yaml`、`deploy/config.yaml.example` 对齐：推荐拓扑为宿主机
  `127.0.0.1:12123` 加本机反代；默认 `trusted_proxies` 保持空列表，不再要求填写 `127.0.0.1/32`。

### 升级边界

- 从 `v0.1.0-rc.7`（schema v2）升级会在原 SQLite 文件内依次事务性写入 v3 与 v4：v3 增加站点
  `blogger_badge`（默认 `[博主]`，可改成 `[OP]` 等或留空关闭），v4 增加实例级 `turnstile_settings`
  （默认关闭，不挑战访客或管理员登录）。启用 Turnstile 前必须先在 Cloudflare 把管理端与全部评论
  站点主机名加入小组件；
- 已有实例在 `ecoku.env` 增加 `TZ='<IANA>'` 后，用当前 `compose.yaml` 的 `env_file` 重建容器即可，
  不必改 `app/config.yaml`；
- 从 `v0.1.0-rc.7` 升级必须先停服做冷备份，再把 `compose.yaml` 的精确镜像 tag 改为
  `v0.1.0-rc.8`，然后 `sudo docker compose pull && sudo docker compose up -d`；
- 回滚时改回 `v0.1.0-rc.7`，并用停服前备份替换已升级的数据库。已写入 v3/v4 的库不能只换回旧镜像。

## [0.1.0-rc.7] - 2026-08-15

### 变更

- 宿主接入改为 `data-ecoku-*` 选择器，外壳与挂载点 id 为 `ecoku-comments` / `ecoku-mount`，
  去掉 Twikoo 遗留的 `tcomment`。加载器暂时仍识别旧的 `#tcomment` 与 `.comment-*` 类名。
- 宿主 `ecoku.css` 仅用于滚动加载前的外壳，评论区样式仍由 SDK 注入。

### 升级边界

- 本版本不改变 SQLite schema，仍为 v2；
- 从 `v0.1.0-rc.6` 升级必须先停服做冷备份，再把 `compose.yaml` 的精确镜像 tag 改为
  `v0.1.0-rc.7`；
- 使用新 markup 的站点需要本版本加载器；旧接入方式仍可用。博客评论 partial 应在本镜像上线后再部署；
- 回滚时改回 `v0.1.0-rc.6`。本次未写入新 schema，一般不必替换数据库；若启动失败，仍用停服前备份恢复。

## [0.1.0-rc.6] - 2026-08-15

### 变更

- 评论区采用已批准的紧凑发表框与列表标题布局，提交按钮文案为「发布」；
- 管理端默认 `auto` 配色，跟随系统浅色/深色，深色 token 与评论区对齐，不提供主题开关；
- 应用日志始终写入容器 stdout，因此 `docker compose logs -f` 可以跟随请求日志；`site.log_path`
  指向普通文件时仍额外保留进程内轮转副本。Compose 模板中的 `logging` 段只限制 Docker 日志体积，
  不是查看日志的前提。

### 升级边界

- 本版本不改变 SQLite schema，仍为 v2；
- 从 `v0.1.0-rc.5` 升级必须先停服做冷备份，再把 `compose.yaml` 的精确镜像 tag 改为
  `v0.1.0-rc.6`。`app/config.yaml` 的 `log_path` 可保持不变；
- 回滚时改回 `v0.1.0-rc.5`。本次未写入新 schema，一般不必替换数据库；若启动失败，仍用停服前备份恢复。

## [0.1.0-rc.5] - 2026-08-15

### 新增

- 站点注册表增加一组可选博主昵称与私有邮箱，用于服务端识别博主本人并按固定矩阵执行通知去重；
- 浏览器 SDK 支持在被回复评论下方直接填写身份与正文，并把共享身份使用非导出 AES-GCM 密钥加密后
  保存到 IndexedDB，保存后 7 天失效。

### 变更

- SQLite schema 从 v1 原文件内事务性升级到 v2；迁移只增加站点博主身份字段和版本记录，不自动删除
  数据库、WAL、业务数据或操作者备份；
- 管理端不展示通知判定预览，文档收敛为一份 Docker Compose 自托管指南。

## [0.1.0-rc.3] - 2026-08-14

### 变更

- 生产 Compose 固定使用 `v0.1.0-rc.3`，宿主目录收敛为 `app/config.yaml`、`app/logs/` 与
  `data/`，不再通过额外 `.env` 重复维护镜像版本；
- 容器默认使用 release 模式，运行环境文件只保留首次初始化所需的管理员与通知密钥；
- SQLite 启动时启用并验证 WAL、5 秒忙等待、`synchronous=NORMAL` 与外键约束；连接池仍保持
  单连接，避免在候选版本中未经压测扩大进程内并发边界；
- 服务收到 SIGTERM 后会先停止 HTTP 与通知 worker，再 checkpoint WAL 并关闭 SQLite，保证正常
  停服后的单文件冷备份边界；
- 管理端不再展示通知模板预览，也不再公开 `/admin/templates/*` 静态页面；实际 SMTP 与
  Telegram 通知模板及投递逻辑保持不变。

### 升级边界

- 本版本不改变 SQLite schema；首次启动会把现有数据库的持久化日志模式切换为 WAL。升级时必须
  原样保留 `data/ecoku.sqlite3`，并按停服备份流程处理运行期的 `-wal` / `-shm` 边车文件；
- 从 `v0.1.0-rc.2` 升级需要停服后把 `config.yaml` 移到 `app/config.yaml`，并把旧
  `data/ecoku.log`（若存在）移到 `app/logs/ecoku.log`。完整步骤和回滚方式见部署文档。

## [0.1.0-rc.2] - 2026-08-14

### 新增

- 容器内置并直接提供 `/client/ecoku-loader.js` 与 `/client/ecoku.umd.js`，静态站点无需复制 SDK；
- 增加从标准输入读取密码的 `hash-password` 命令，用于首次生成管理员 bcrypt 哈希。

### 变更

- 生产 Compose 改用当前目录下的 `config.yaml`、`ecoku.env` 和 `data/` 绑定挂载，不再声明命名卷；
- Hugo PaperMod 示例默认从 Ecoku 服务端延迟加载浏览器资源。

## [0.1.0-rc.1] - 2026-08-14

首个用于私有 Forgejo/Woodpecker 验证的候选版本。

### 新增

- 多站点纯文本评论、线程回复、墓碑删除和 SQLite3 持久化；
- 独立实例管理员、站点管理、SMTP/Telegram 通知与 Twikoo 首次导入；
- 可嵌入浏览器 SDK、同源管理端和 Hugo/通用静态站点示例；
- `linux/amd64`、`linux/arm64` 原生构建与 Forgejo 多架构容器镜像工作流。

### 安全边界

- 公共 DTO 不返回邮箱、管理字段、IP、UA 或地区；
- 生产 Compose 使用精确 RC 镜像标签、只读根文件系统、非 root 用户和持久化命名卷；
- CI 仅构建、测试并发布镜像，不连接部署服务器、不迁移数据库。

[0.1.0-rc.1]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.0-rc.1
[0.1.0-rc.2]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.0-rc.2
[0.1.0-rc.3]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.0-rc.3
[0.1.0-rc.4]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.0-rc.4
[0.1.0-rc.5]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.0-rc.5
[0.1.0-rc.6]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.0-rc.6
[0.1.0-rc.7]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.0-rc.7
[0.1.0-rc.8]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.0-rc.8
[0.1.0-rc.9]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.0-rc.9
[0.1.0-rc.10]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.0-rc.10
[0.1.0]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.0
[0.1.1]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.1
[0.1.2]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.2
[0.1.3]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.3
[0.1.4]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.4
[0.1.5]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.5
[0.1.6]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.6
[0.1.7]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.7
[0.1.8]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.8
[0.1.9]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.9
[0.2.0]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.2.0
[0.2.1]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.2.1
[0.2.2]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.2.2
[0.2.3]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.2.3
[0.2.4]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.2.4
[0.2.5]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.2.5
[0.2.6]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.2.6
[0.2.7]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.2.7
[0.2.8]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.2.8
[0.2.9]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.2.9
[Unreleased]: https://git.via.moe/dejavu/Ecoku/compare/v0.2.9...master
