# 更新日志

本项目遵循 [Semantic Versioning](https://semver.org/)。正式发布前的候选版本可能继续调整 API、
配置和数据库结构；升级前必须阅读对应版本说明并备份 SQLite 数据库。

## [Unreleased]

### 变更

- 评论区采用已批准的 v14：身份输入与标签同为 12px、正文色；Turnstile 宿主槽不超过 300px；
  已有身份时回复框不再显示「以某某身份回复 / 更换」。

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
[0.1.0-rc.5]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.0-rc.5
[0.1.0-rc.6]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.0-rc.6
[0.1.0-rc.7]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.0-rc.7
[0.1.0-rc.8]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.0-rc.8
[0.1.0-rc.9]: https://git.via.moe/dejavu/Ecoku/src/tag/v0.1.0-rc.9
