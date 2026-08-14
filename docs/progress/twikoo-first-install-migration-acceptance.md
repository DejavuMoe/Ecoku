# 测试服务器首次安装与 Twikoo 全量导入验收记录

日期：2026-08-14（Asia/Singapore）

## 结论

当时的远程测试服务器已按首次安装流程重新初始化，活跃 SQLite 数据库从空库建立；随后通过真实
管理 API 创建 `blog.dejavu.moe` 站点，并把用户提供的 Twikoo JSON 全量导入。离线数据库检查、
重复导入保护、真实管理 API、公共 API、CORS、隐私、IPv4/IPv6 HTTPS 和默认日志脱敏均通过。

本文只保留当时的持久化开发测试证据；对应实例现已退役，不是当前测试入口，也不是生产发布、
正式 release 或生产数据库迁移验收。

## 首次安装状态

- 远端：当时使用的 Debian 13 测试主机，现已退出本项目测试范围。
- 公网入口和管理端地址已从仓库移除。
- 容器：`ecoku-development`，镜像 `ecoku:development`，重启策略 `unless-stopped`，最终状态
  `running / healthy`。
- 镜像 ID：`sha256:279065d6da049f577715592217981c45deaee0d9772b7c781598a1e243e95b86`。
- 活跃数据库：`/var/lib/docker/volumes/ecoku-data/_data/ecoku.sqlite3`。
- 初次启动后：schema version 为当前版本、站点 0、评论 0、通知渠道关闭。
- 新管理员凭据及 token key 均已轮换；旧管理员凭据实测返回 HTTP 401。
- 私有运行配置和管理员凭据文件均为 `0600 root:root`，没有写入源码、Git、日志、测试输出或本文。

重置时先创建了只供 root 读取的恢复快照：

- 目录：`/var/backups/ecoku/first-install-20260813T214222Z`
- 重置前 SQLite SHA-256：`50a88979c7c495590ba76e21ecfc9b8d7620523e3d1601c8e5a2136acd0b95ad`

该快照不参与当前运行，活跃数据库确实由空库初始化。为避免误删唯一恢复证据，验收后保留了受保护快照；
本次上传的 Twikoo 原始文件、验证脚本和临时导入容器均已删除。

## 站点注册结果

站点通过新管理员会话调用真实 `POST /api/admin/sites` 创建，没有直接向数据库插入配置：

| 字段 | 值 |
| --- | --- |
| 站点 ID | `blog` |
| 站点 URL | `https://blog.dejavu.moe` |
| 站点名称 | `Dejavu's Blog` |
| 服务端解析域名 | `blog.dejavu.moe` |
| 允许来源 | `https://blog.dejavu.moe` |
| 默认排序 | 最新评论 |
| 邮箱 | 必填、私有保存 |
| 网站 | 可选 |
| 正文上限 | 1000 个 Unicode code point |

站点建立前，管理员站点列表为空；建立后只存在上述一个注册站点。

## Twikoo 导入

源文件未写入仓库。上传后的 SHA-256 为：
`d0cde0ce290d34776e5da4c8341b7b123aacd566a304bd34a401f3df0eb019a6`。

先执行 `--dry-run`，确认事务回滚且目标站点评论仍为 0；再执行正式导入。两次使用同一份真实导出和
同一套生产 importer：

| 指标 | 结果 |
| --- | ---: |
| Twikoo 源记录 | 467 |
| 导入后评论 | 467 |
| 源根评论 / 回复 | 232 / 235 |
| 数据库根评论 / 回复 | 233 / 234 |
| 缺失父记录转为根评论 | 1 |
| 页面 key | 56 |
| 私有邮箱 | 354 |
| 访客网站 | 262 |
| 含换行正文 | 74 |
| 最大语义嵌套深度 | 10 |
| 最早时间（UTC） | `2025-10-15 14:03:02.37+00:00` |
| 最晚时间（UTC） | `2026-08-13 08:12:29.41+00:00` |

允许字段包括时间、昵称、私有邮箱、网站、页面 key、父子层级和纯文本正文。没有导入 IP、UA、
地理位置、头像、赞踩或外部用户 ID。HTML 按 importer 规则转为纯文本并保留换行。导入过程没有生成
通知 outbox 项，也没有向历史评论发送邮件或 Telegram 消息。

导入完成后再次对同一站点执行 dry-run，命令按预期以非零状态退出并报告目标站点已存在评论；数据库
仍为 467 条，证明首次导入不能被误执行两次。

## 自动化与真实环境证据

### 本地源码回归

| 命令 | 结果 |
| --- | --- |
| `go test -count=1 ./...` | 通过；首次因用户 Go build cache 拒绝访问失败，改用仓库内 `GOCACHE` 后全量通过 |
| `go vet ./...` | 通过 |
| `pnpm run verify:client` | 2 个测试文件、24 项测试、type-check、production build、包契约和发布前校验通过；未发布 |
| `pnpm run verify:admin` | 1 个测试文件、9 项测试、type-check 和 production build 通过 |

### 远端 SQLite 与导入

- `PRAGMA quick_check = ok`。
- `PRAGMA foreign_key_check` 返回 0 条。
- 467 条评论全部可从根节点递归到达，没有跨站点或跨页面父关系。
- 活跃评论没有空昵称或空正文；墓碑数为 0。
- 通知 outbox 为 0，email / Telegram 渠道均关闭。
- `--dry-run` 后评论数保持 0；正式导入后为 467；重复导入保护返回非零状态。

### 真实 HTTP/API

- 新管理员凭据登录通过，旧管理员凭据返回 401。
- 管理 API 分页读回全部 467 条，汇总得到 354 个邮箱、262 个网站、56 个页面 key。
- 最大页面线程的公共 API 一次读回 60 条评论；公共 JSON 中没有邮箱、页面标题或管理字段。
- `Origin: https://blog.dejavu.moe` 正确返回 CORS 允许头；未注册来源返回 HTTP 403。
- `/admin/` 静态管理端通过。
- IPv4 与 IPv6 的 `/admin/`、`/api/health` 均返回 HTTP 200，Caddy TLS 保持有效。
- 默认日志扫描：邮箱、Authorization、Bearer、password 和 token 值命中数均为 0。

## 历史凭据状态

该实例的管理入口和凭据不再用于项目测试，仓库不保留访问地址、用户名或登录指引。本文中的数据库
与导入统计只用于回溯当时的迁移结果。

## 条件性与未验证项

- 重置同时清空了 SMTP 和 Telegram 配置；两项当前均未启用。本轮没有发送真实通知，避免全量历史
  导入触发 467 次通知。重新录入通知凭据后，需要由用户手工测试发送。
- 真实浏览器的管理员人工浏览、评论跳转和邮件/Telegram 通知仍由用户继续验收；本记录只证明自动化
  和真实 HTTP API 结果。
- 没有执行 Git push、tag、GitHub/Forgejo Release、npm 发布或生产环境部署。

## 工作区状态

本轮只新增本验收记录，没有修改导入器或运行时代码。用户原有的 `CODEBASE_ANALYSIS.md` 修改和
`test_site/` 未跟踪目录未被覆盖、清理或纳入提交。
