# 更新日志

本项目遵循 [Semantic Versioning](https://semver.org/)。正式发布前的候选版本可能继续调整 API、
配置和数据库结构；升级前必须阅读对应版本说明并备份 SQLite 数据库。

## [Unreleased]

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
