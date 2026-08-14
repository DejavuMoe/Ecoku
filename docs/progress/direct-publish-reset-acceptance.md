# 直接发布模型与测试环境重置验收记录

日期：2026-08-14（Asia/Singapore）

## 结论

本轮批准范围已经完成并通过本地自动化、真实浏览器、真实 HTTPS API 和测试服务器容器验收。
Ecoku 当前仅支持 SQLite3，评论提交后直接发布；审核、批准、拒绝及其批量操作已经从运行时、API、
管理端和站点配置中移除。当时的旧测试实例已在备份旧数据库后执行破坏性清理并以全新 schema
重建，没有迁移旧数据。

这不是生产发布、正式 release 或线上数据迁移验收。对应测试实例现已退役，访问地址和专用部署
资产已经从仓库移除。

## 用户批准的边界

- 允许不迁移历史数据，执行破坏性 `DROP`，重建数据库和测试服务器环境。
- 评论默认直接发布；移除先审后发、待审核、批准、拒绝及对应批量操作。
- 保留已发布评论的墓碑删除；没有后代的墓碑允许彻底删除。
- 站点仅配置站点 ID、站点 URL、可选站点名称、允许来源、默认排序、字段要求、评论占位文案、
  Unicode 字符数上限和无评论文案。域名由服务端从 URL 解析，不作为表单字段。
- 站点名称留空时回落到 URL 域名；通知标题、模板和管理端均使用相同的站点显示名称。
- 客户端采用批准的纯文本、无头像、无赞踩、线程式界面；无额外提示文案，回复按钮与时间同行，
  无限语义嵌套且视觉缩进封顶。
- Twikoo 首次导入保留时间、昵称、私有邮箱、网站、页面 key、层级和纯文本正文。
- 当时授权将源码部署到远程测试主机、持久保留数据库、生成 Mock 数据，并进行必要 Git 提交；
  该授权不延续到新的远程环境。

## 行为与数据模型变化

### 评论

- 公共提交写入后立即可由公共列表读取，不再产生 `pending` 或 `rejected` 状态。
- 数据库 `comments` 表不再保存审核状态字段；公共 DTO 与数据库模型仍分离，且不公开邮箱。
- 列表继续按根线程分页，每个根线程返回全部后代；父评论仍必须属于同一站点和页面。
- 墓碑删除清空昵称、私有邮箱、网站和正文，保留线程关系和后代。
- 彻底删除仅允许无后代墓碑，避免破坏线程。

### 站点

- 数据库保存 `site_url`、服务端解析的 `domain`、可选 `name`、`default_sort`、字段要求、占位文案、
  Unicode code point 评论长度上限和无评论文案。
- 新评论的浏览器配置由公共站点配置接口读取；浏览器不会收到 management key。
- CJK、拉丁字母、Emoji 与其他 Unicode 字符都按 code point 计数，不按 UTF-8 字节数计数。

### 通知

- 博主邮件标题为“您在 [站点名称] 上有新评论/新回复”；访客邮件标题为
  “你在 [站点名称] 的评论收到了回复”。
- 邮件显示文章标题而不是裸页面路径；页尾统一为
  “此邮件由 [站点名称] 系统发送，请勿直接回复本邮件。”。
- Telegram 使用相同的站点名称、文章标题和原文链接，不包含审核按钮或审核台链接。
- 通知收件人、Telegram ID 的管理端多值输入支持 Enter、半角逗号和换行。
- 通知密钥只返回 `*_set` 状态，不明文回显，不进入默认日志。

### Twikoo 首次导入

- 命令：`ecoku import-twikoo --site <siteId> --file <export.json> [--dry-run]`。
- 只允许目标站点为空时运行，整个导入使用单个事务；`--dry-run` 强制回滚。
- HTML 转为纯文本并保留换行；不导入 IP、UA、地区、头像、赞踩或外部用户 ID。
- 用户提供的真实导出文件只做了私有本地预检，没有写入仓库或测试服务器。预检摘要：467 条评论、
  232 个根评论、235 个回复、56 个页面、354 个邮箱、262 个网站、1 个缺失父记录。

## 数据库重建与备份

- 测试服务器旧 SQLite 完整性检查结果：`ok`。
- 重建前备份：
  `/var/backups/ecoku/ecoku-before-direct-publish-reset-20260813T161755Z.sqlite3`
- 备份大小：114688 字节。
- SHA-256：`78ecc38d4196c1aa8e9e284c93e333e4b7bb4b25ff4742470b99730e0a969559`。
- 旧数据库的 6 个应用表在事务中执行 `DROP`，随后执行 `VACUUM`；没有尝试字段迁移。
- 新数据库从空库创建 schema version 1。启动时只接受当前版本，旧版、未知版或未来版 schema 均失败，
  不静默执行 AutoMigrate。
- 当前数据库文件：`/var/lib/docker/volumes/ecoku-data/_data/ecoku.sqlite3`。
- 最终只读检查：`PRAGMA integrity_check = ok`，评论总数 475，墓碑 1。
- 最终文案修复部署前自动备份：
  `/var/backups/ecoku/ecoku-pre-deploy-20260813T165112Z-683d2705458d1640b6002ab69588d05a6583ac4a.sqlite3`。
- 服务器原有部署脚本仍调用已移除的 `migrate` 子命令，首次切换因此停在临时容器；该临时容器没有执行
  数据迁移或覆盖数据库。已用仓库内无迁移版本替换部署脚本并重新部署，最终确认脚本不存在
  `migrate --backup` 步骤。

破坏性重建同时清除了旧通知设置。管理员凭据和私有运行配置仍保存在 `/etc/ecoku` 的受保护文件中，
没有写入源码、Git、测试输出或本记录；SMTP 与 Telegram 渠道需要在管理端重新填写。

## 测试服务器与 Mock 数据

- 旧测试地址和后台入口现已移除；以下内容只记录当时的验收结果。
- 当前发布目录：`/srv/ecoku/releases/683d2705458d1640b6002ab69588d05a6583ac4a`。
- 容器：`ecoku-development`，镜像 `ecoku:development`，状态 healthy。
- Caddy 自动 TLS 保持工作；IPv4 和 IPv6 请求都返回统一健康响应。
- Hugo 构建提取出 122 个唯一评论页面 key，并为每个页面创建 1～6 级嵌套线程，共 423 条 Mock。
- 真实 API smoke 另创建 52 条评论，覆盖直接发布、三级以上线程、排序、墓碑幂等、旧状态路由拒绝、
  非允许来源 CORS 拒绝和公开 DTO 隐私。
- 最终共 475 条评论、123 个页面 key（122 个 Hugo 页面和 1 个 smoke 页面）。
- 每个 Hugo 页面都通过公共 GET 重新读取；公开 JSON 未出现邮箱或其他私有字段。

## 自动化验证

| 命令或检查 | 结果 |
| --- | --- |
| `go test -count=1 ./...` | 通过，包含 schema、评论、删除、管理认证、站点、通知、Twikoo 导入和 P0～P4 安全回归 |
| `go vet ./...` | 通过 |
| `packages/client: npm run test` | 24 项通过 |
| `packages/client: npm run type-check` | 通过 |
| `packages/client: npm run build` | 通过 |
| 客户端包契约与安全来源检查 | 通过 |
| `packages/admin: npm run test` | 9 项通过 |
| `packages/admin: npm run type-check` | 通过 |
| `packages/admin: npm run build` | 通过 |
| Hugo production build | 通过：260 pages、18 paginators、822 non-page、13 static、59 aliases |
| 远端真实 API smoke | 通过：52 条、最大深度 6、直接发布、墓碑幂等、排序、CORS、隐私和旧状态拒绝 |
| SQLite 只读完整性检查 | `ok` |
| IPv4 / IPv6 HTTPS 健康检查 | 均通过 |
| 后台响应头 | CSP、HSTS、`X-Frame-Options: DENY`、`nosniff`、`no-referrer` 均存在 |
| 默认日志敏感模式扫描 | 0 条匹配 |

## 真实浏览器验收

使用隔离 Chrome DevTools 会话加载本地 Hugo 页面和远端 HTTPS API：

- 宽屏渲染 6 级线程，正文中的 `<strong>` 作为普通文本显示。
- 390px 视口的 document width 与 viewport 都为 390px，没有横向溢出。
- 评论区没有“排序”标签、邮箱隐私提示、字段必填提示词或 management key。
- `[-]` 和 `[+]` 折叠按钮实测均为 28×32 px，展开状态可访问属性同步变化。
- 管理端成功登录并显示 474 条已发布、1 条已删除；没有待审核、批准、拒绝或审核方式文案。
- 站点表单没有“站点域名”和“审核方式”，站点选择器显示 `Dejavu's Blog`。
- 登录后的评论、站点、通知页面控制台错误为 0；通知页面没有明文密码或 Bot Token。
- 桌面详情页不再误显移动端返回按钮；800px 视口使用全屏详情覆盖层，返回按钮可见且无横向溢出。
- 三种邮件模板和 Telegram 模板均可从远端打开，标题、文章标题、站点名称回落和统一页尾符合批准文案，
  不含审核操作。

测试 Hugo 以 `127.0.0.1` 打开时，主题自身请求 `localhost` manifest 和 `r2.dejavu.moe` 字体会产生
CORS 控制台消息；Ecoku SDK、旧测试 API 和后台页面没有对应错误。这一主题资源问题未在本轮修改。

## 条件性与尚未验证项

- 数据库重建后通知渠道处于未配置、未启用状态，所以没有使用真实 SMTP 凭据发送邮件，也没有再次向
  Telegram 发送真实消息。模板、配置加密、发送逻辑和失败映射已由自动化测试覆盖；重新录入凭据后仍需
  手工执行“发送测试邮件/消息”。
- 没有导入用户真实 Twikoo 数据；只对真实导出执行 dry-run，并在临时数据库 fixture 中验证正式导入、
  事务回滚、层级、邮箱和纯文本转换。
- 没有生产域名、生产数据库、发布标签、Git push 或线上迁移验收。

## Git 与交付状态

- `bd4572722a4a641cee2e83540dfae476b29e3393` — `feat: switch comments to direct publishing`
- `0469f26840fd87e3042a4d33ecea26035a8367ff` — `fix: hide mobile detail navigation on desktop`
- `f7f6875` — `docs: record direct-publish reset acceptance`
- `683d2705458d1640b6002ab69588d05a6583ac4a` — `fix: align admin copy with direct publishing`
- 本轮没有 push、PR、tag 或 release。
- 根工作区仍有用户原有的 `CODEBASE_ANALYSIS.md` 修改和未纳入根仓库的 `test_site/` 嵌套工作区；
  本轮没有覆盖或回滚这些用户改动。
