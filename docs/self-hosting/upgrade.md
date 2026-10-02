# 升级

当前版本是 **v0.2.8**（2026-10-01 发布，schema v9）。

## 升级时会发生什么

升级就是把 `compose.yaml` 中的镜像换成新版本再启动。新版本启动时检查数据库的 schema 版本，如果低于自己支持的版本，就按顺序执行迁移：

- 每一步迁移在一个事务中完成，失败则整步回滚，数据库保持原样，服务不启动；
- 迁移在原数据库文件上进行，不会删除或重建数据库、评论、配置、WAL 文件或你的备份；
- 每完成一步，在 `schema_migrations` 表中追加一条记录；
- **只能向上迁移**。旧版本的程序打不开更高 schema 的数据库，会拒绝启动。

所以，升级前的备份是回滚到旧 schema 的唯一途径。

可以跨版本直接升级，比如从 v0.1.8 直接换到 v0.2.8，中间的迁移会依次执行。但请把跨过的每个版本的升级说明都读一遍，有的版本需要调整配置（例如 [v0.2.4](./upgrades/v0.2.4) 要求 `admin.token_ttl_minutes` 为 480 或省略）。

## 下一版本的配置迁移（未发布） {#unreleased-config}

以下变更尚未发布，不适用于直接重启 v0.2.8。数据库 schema 保持 v9；现有站点、评论和通知设置都保留，但旧 YAML 中的下列字段必须删除，否则新版本会拒绝启动。

| 删除项 | 新行为 |
| --- | --- |
| `site.port`、`site.log_path` | 监听 12123，日志写到标准输出。宿主机端口在 Compose 中修改。 |
| 整个 `client`、`database`，以及 `admin.static_dir` | 镜像资源与数据库路径固定；保留原有数据挂载。 |
| 整个 `sites`（包含 `management_key_env`） | 已有站点继续从 SQLite 读取，新站点在后台创建；`EcokuSite` 认证不再支持。 |
| `admin.enabled`、`admin.token_ttl_minutes`、`admin.username_env`、`admin.password_hash_env`、`admin.token_key_env`、`notifications.encryption_key_env` | 后台始终启用，会话固定为 8 小时；环境变量名称见[配置参考](../reference/configuration#env)。 |

发布后，按下面的顺序迁移：

1. 先按[停服冷备份](./backup#cold-backup)保存并验证数据库、原配置、`ecoku.env` 和 Compose。记录实际使用的 SQLite 路径和宿主机挂载位置。
2. 删除表中的 YAML 字段及留下的空节。保留 `notifications.instance_public_url`、`site.trusted_proxies`，以及确实使用的 `admin.allowed_origins` 和 `rate_limit`。如果以前改过环境变量名，将名称改为标准名称，**原密码哈希、签名密钥和加密主密钥的值保持不变**。
3. 确认原数据库映射到 `/data/ecoku.sqlite3`。使用官方模板的实例无需移动数据；自定义位置应调整 Compose 的宿主机路径。自定义文件名需在停服后准备为 `ecoku.sqlite3`，若仍有 `-wal`、`-shm` 文件，必须连同主文件一起复制并对应改名，保留原副本；不要只复制主文件或挂载空目录。目录及文件须允许 UID/GID `10001:10001` 读写。
4. 从 Compose 删除 `./app/logs:/var/log/ecoku`，原日志文件可以留存。新日志用 `docker compose logs` 查看，轮转由 Docker 日志设置负责。使用 `EcokuSite` 的自动化需改用有效的管理员会话，或改在后台操作。
5. 把镜像改为届时发布的精确 tag，再按[升级步骤](#steps)拉取、启动和检查。确认后台中的站点数量、历史评论和通知设置与升级前一致。

回滚到 v0.2.8 时，停止服务，恢复原 Compose、配置与环境变量；若移动过数据库，恢复原挂载对应的数据库位置。schema 相同，无需回退数据库；不要用旧备份覆盖升级后产生的新评论。旧版需要的日志目录仍须允许容器用户写入。

## 升级步骤 {#steps}

**1. 阅读升级说明**。在下方的[版本列表](#versions)中找到目标版本，确认是否有配置变更、是否涉及 schema 迁移。

**2. 停服冷备份**。按[备份与恢复](./backup#cold-backup)执行，确认输出 `Verified backup`。

**3. 修改镜像版本**。编辑 `~/Ecoku/compose.yaml`，把 `image` 改成目标版本，例如：

```yaml
    image: "git.via.moe/dejavu/ecoku:v0.2.8"
```

请写精确的版本号，不要用 `latest`。如果升级说明要求修改 `app/config.yaml` 或 `ecoku.env`，一并修改。

**4. 拉取并启动。**

```bash
cd ~/Ecoku
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
```

**5. 检查。**

```bash
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

容器状态为 `healthy`、日志中没有报错后，再打开博客文章页和管理后台，确认评论能正常加载、发布，后台能登录。

## 回滚

先看新旧两个版本的 schema 是否相同（见下表）：

- **schema 相同**：停止服务，把 `compose.yaml` 中的镜像改回旧版本号，拉取并启动。数据库不用动，升级后产生的新评论也会保留。如果依赖了新版本的省略默认值，先恢复旧版所需的完整配置；如果新版本要求加过新的配置项，而旧版本不认识它，要先删掉，否则旧版本会因未知字段拒绝启动。
- **schema 不同**：只改回镜像版本号不行，旧版本打不开已迁移的数据库。需要用升级前的冷备份[恢复](./backup#restore)。备份之后产生的评论和设置修改会丢失。

## 版本列表 {#versions}

| 版本 | 发布日期 | schema | 要点 |
| --- | --- | --- | --- |
| [v0.2.8](./upgrades/v0.2.8) | 2026-10-01 | v9 | 管理后台改为评论流与行式设置，增加快捷键和底部导航；容器内置默认配置，部署模板精简。 |
| [v0.2.7](./upgrades/v0.2.7) | 2026-09-29 | v8 → v9 | 通知邮件改用纸墨视觉与系统字体，主题附带文章标题；删除评论时取消未发通知并撤回已发 Telegram 消息；通知队列不再重试注定失败的投递。 |
| [v0.2.6](./upgrades/v0.2.6) | 2026-09-29 | v8 | 管理后台改用与评论区一致的纸墨配色和系统字体，重排各页面布局；功能与接口不变。 |
| [v0.2.5](./upgrades/v0.2.5) | 2026-09-26 | v8 | 评论区默认样式改为“纸与墨”，CSS 变量可直接覆盖；Turnstile 核验拒绝重定向。 |
| [v0.2.4](./upgrades/v0.2.4) | 2026-09-16 | v7 → v8 | 管理员会话改为可撤销的 Cookie 会话；`token_ttl_minutes` 只能为 480；新回复最多 16 层。 |
| [v0.2.3](./upgrades/v0.2.3) | 2026-09-16 | v7 | 保存站点不再改写历史博主标记；通知、导入、SDK 多项修复。 |
| [v0.2.2](./upgrades/v0.2.2) | 2026-09-13 | v7 | 修复窄屏下表情选择器超出页面。 |
| [v0.2.1](./upgrades/v0.2.1) | 2026-09-12 | v7 | Smoji 清单容量提高，支持 `base` 模板。 |
| [v0.2.0](./upgrades/v0.2.0) | 2026-09-12 | v7 | 文档与 API 参考修订，运行时无变化。 |
| [v0.1.9](./upgrades/v0.1.9) | 2026-08-31 | v7 | 评论列表增加读取预算、逐层读取接口和独立读取限流。 |
| [v0.1.8](./upgrades/v0.1.8) | 2026-08-27 | v6 → v7 | 新增 Smoji 表情包。 |
| [v0.1.7](./upgrades/v0.1.7) | 2026-08-26 | v6 | 构建工具链与文档站更新，运行时无变化。 |
| [v0.1.6](./upgrades/v0.1.6) | 2026-08-18 | v6 | 修正 Cap 所需的后台 CSP。 |
| [v0.1.5](./upgrades/v0.1.5) | 2026-08-17 | v5 → v6 | 人机验证改为关闭 / Turnstile / Cap 三选一。 |
| [v0.1.4](./upgrades/v0.1.4) | 2026-08-15 | v5 | 保存博主口令时回填历史博主标记（v0.2.3 起取消）。 |
| [v0.1.3](./upgrades/v0.1.3) | 2026-08-15 | v4 → v5 | 博主改用口令认证；通知按收件人拆分。 |
| [v0.1.2](./upgrades/v0.1.2) | 2026-08-15 | v4 | 评论元信息排版调整。 |
| [v0.1.1](./upgrades/v0.1.1) | 2026-08-15 | v4 | 折叠按钮改为固定宽度，切换时不再跳动。 |
| [v0.1.0](./upgrades/v0.1.0) | 2026-08-15 | v4 | 首个正式版本。 |
| [更早的候选版本](./upgrades/earlier) | 2026-08-14 | v1 ～ v4 | `v0.1.0-rc.*` 系列。 |

表中 schema 一栏只写一个版本号的，表示该版本没有数据库迁移。
