# 升级

公开版本从 v0.3.0 开始。新部署直接使用 [Docker 部署](./docker)；本页用于已有实例升级。

当前版本是 **v0.3.2**（2026-10-04 发布，schema v12）。

新镜像统一发布到 GHCR。使用 Forgejo 镜像的实例，后续升级请将 `image` 改为 `ghcr.io/dejavumoe/ecoku:v0.3.2` 或目标版本的精确 tag，保留原来的数据与配置挂载；Forgejo registry 不再发布新版本。同版本切换仓库不需要重新初始化实例。

## 升级时会发生什么

升级就是把 `compose.yaml` 中的镜像换成新版本再启动。新版本启动时检查数据库的 schema 版本，如果低于自己支持的版本，就按顺序执行迁移：

- 每一步迁移在一个事务中完成，失败则整步回滚，数据库保持原样，服务不启动；
- 迁移在原数据库文件上进行，不会删除或重建数据库、评论、配置、WAL 文件或你的备份；
- 每完成一步，在 `schema_migrations` 表中追加一条记录；
- **只能向上迁移**。旧版本的程序打不开更高 schema 的数据库，会拒绝启动。

所以，升级前的备份是回滚到旧 schema 的唯一途径。

## 升级步骤 {#steps}

**1. 阅读升级说明**。在下方的[版本列表](#versions)中找到目标版本，确认是否有配置变更、是否涉及 schema 迁移。

**2. 停服冷备份**。按[备份与恢复](./backup#cold-backup)执行，确认输出 `Verified backup`。

**3. 修改镜像版本**。编辑 `~/Ecoku/compose.yaml`，把 `image` 改成目标版本，例如：

```yaml
    image: "ghcr.io/dejavumoe/ecoku:v0.3.2"
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
| [v0.3.2](./upgrades/v0.3.2) | 2026-10-04 | v12 | 后台设置改用输入框与逐项列表、邮件页眉印章、SDK 语言优先级修复。 |
| [v0.3.1](./upgrades/v0.3.1) | 2026-10-03 | v11 → v12 | 三语后台与评论区、站点语言、文档主题同步。 |
| [v0.3.0](./upgrades/v0.3.0) | 2026-10-03 | v10 → v11 | Smoji 独立图片来源、npm SDK 与 GHCR 发布、配置模板及文档主题更新。 |

表中 schema 一栏只写一个版本号的，表示该版本没有数据库迁移。

::: details 内测版本记录（请勿使用）
仅保留版本标签、变更和历史升级事项。公开部署从 v0.3.0 开始；旧镜像不再提供部署支持。请使用 [当前部署文档](./docker)。

| 版本 | 日期 | schema | 历史变更 |
| --- | --- | --- | --- |
| [v0.2.9](./upgrades/v0.2.9) | 2026-10-02 | v9 → v10 | 首次登录改密、持久管理员与密钥、旧配置兼容及后台修复。 |
| [v0.2.8](./upgrades/v0.2.8) | 2026-10-01 | v9 | 管理后台改为评论流与行式设置，增加快捷键和底部导航；容器内置默认配置，部署模板精简。 |
| [v0.2.7](./upgrades/v0.2.7) | 2026-09-29 | v8 → v9 | 通知邮件改用纸墨视觉与系统字体，主题附带文章标题；删除评论时取消未发通知并撤回已发 Telegram 消息；通知队列不再重试注定失败的投递。 |
| [v0.2.6](./upgrades/v0.2.6) | 2026-09-29 | v8 | 管理后台改用与评论区一致的纸墨配色和系统字体，重排各页面布局；功能与接口不变。 |
| [v0.2.5](./upgrades/v0.2.5) | 2026-09-26 | v8 | 评论区默认样式改为「纸与墨」，CSS 变量可直接覆盖；Turnstile 核验拒绝重定向。 |
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
| [v0.1.0](./upgrades/v0.1.0) | 2026-08-15 | v4 | 首个带稳定标签的内测版本。 |
| [更早的候选版本](./upgrades/earlier) | 2026-08-14 | v1 ～ v4 | `v0.1.0-rc.*` 系列。 |
:::

<details id="legacy-config" class="details custom-block">
<summary>内测实例的旧配置迁移</summary>

v0.2.9 在 schema v9 上增加 v10 管理员账户表。现有站点、评论、通知、验证码和历史管理员凭据都会保留；旧实例不需要在升级前修改配置。

升级时保留原来的 `compose.yaml`、`app/config.yaml` 和 `ecoku.env`，按[升级步骤](#steps)停服备份后启动新镜像。新版本第一次启动会：

1. 把旧的 `ECOKU_ADMIN_USERNAME`、`ECOKU_ADMIN_PASSWORD_HASH` 和 `ECOKU_ADMIN_TOKEN_KEY` 导入管理员账户和持久会话密钥；
2. 把 `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 写入 `data/ecoku-secrets.json`，并用它继续解密数据库中已有的凭据；
3. 保留旧的 `site.port`、`site.log_path`、静态目录、SQLite 路径、YAML `sites` 和 `management_key_env` 兼容行为；
4. 不生成临时密码，也不强迫旧管理员改密。

确认新版本正常运行后，再迁移为简化配置：

1. 确认能登录后台、站点数量和历史评论正确，通知设置可以打开；
2. 确认 `data/ecoku-secrets.json` 已创建，并且日志没有「无法解密凭据」；
3. 停服并按[备份](./backup#cold-backup)保存整个 `data/`、`app/config.yaml`、`compose.yaml` 和旧的 `ecoku.env`。
4. 停服后删除 `ecoku.env` 中的管理员变量和 `ECOKU_NOTIFICATION_ENCRYPTION_KEY`。如果仍需要 `TZ`，把它移到 Compose 的 `environment`；保留 `env_file` 时也可以只保留 `TZ`；
5. 不再需要该环境文件时才删除 Compose 的 `env_file`。如果仍通过它注入 `TZ` 或站点管理密钥，就保留 `env_file`；
6. 新配置保留 `notifications.instance_public_url`、实际使用的 `site.trusted_proxies`、`admin.allowed_origins` 和 `rate_limit`。旧字段可以暂时保留，删除前先确认不再使用旧数据库路径、文件日志或 `EcokuSite` 自动化；
7. 重建容器并再次检查后台、评论和通知。

旧的 `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 与 `data/ecoku-secrets.json` 不一致时，服务会拒绝启动，以免覆盖后无法解密已有凭据。旧数据库路径继续生效，不能只删除 `database.sqlite.path` 后把空的 `/data` 挂载进去。

内测版本不再提供生产回滚镜像。历史 schema 的恢复需要当时的完整冷备份；此处仅保留配置迁移记录。

</details>
