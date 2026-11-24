# 升级

升级就是把 `compose.yaml` 里的镜像换成新版本，再重建容器。新版本启动时会检查数据库的 schema 版本，必要时按顺序原位迁移。

当前版本是 **v0.6.2**（2026-11-23，schema v12）。新部署请直接看 [Docker 部署](./docker)。

升级前先在 [版本列表](#versions) 里读一遍从你的版本到目标版本之间每个版本的说明。需要特别注意的两处：

- 从 v0.5.7 或更早版本升级，要同时替换 Compose 里的健康检查，见 [迁移到 distroless 镜像](#distroless)。
- 从 v0.5.0 之前的版本升级，管理后台的来源不能和任何站点的允许来源重复，否则新版本拒绝启动，见 [v0.5.0 兼容性说明](./upgrades/v0.5.0#compatibility)。

## 数据库迁移

- 每一步迁移在一个事务里完成。某一步失败时只回滚这一步，服务不会启动，之前完成的步骤保留。
- 迁移直接修改原数据库文件，不会删除数据库、评论、配置或备份。
- 只能向上迁移。旧版本程序打不开更高 schema 的数据库。

所以升级前的冷备份，是回到旧 schema 的唯一办法。

## 升级步骤 {#steps}

<div class="steps">


### 读升级说明

在 [版本列表](#versions) 里找到目标版本，看有没有配置变更和数据库迁移。

### 停服冷备份

按 [备份与恢复](./backup#cold-backup) 操作，看到 `Verified backup` 后保持服务停止。

### 改镜像版本

编辑 `~/Ecoku/compose.yaml`，写精确的版本号：

```yaml
    image: "ghcr.io/dejavumoe/ecoku:v0.6.2"
```

升级说明要求改 `app/config.yaml` 的，一并改好。以前从 Forgejo 镜像仓库拉取的实例，直接改成上面的 GHCR 地址；Forgejo 不再发布新版本。

### 拉取并启动


```bash
(
set -eu
cd ~/Ecoku
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d --force-recreate --wait --wait-timeout 120 ecoku
)
```

### 检查


```bash
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

容器为 `healthy`、日志没有报错后，打开一篇文章确认评论能加载和发布，再登录一次后台。

</div>

使用 npm 包 `ecoku` 的网站，同时把依赖更新到同一版本并重新构建。

## 回滚 {#rollback}

先看新旧两个版本的 schema 是否相同（见下表）。

**schema 相同**：停服，把 `compose.yaml` 里的镜像改回旧版本，拉取并重建。数据库不用动，升级后的新评论会保留。如果为新版本加过旧版本不认识的配置项，先删掉，否则旧版本会因为未知字段拒绝启动。

**schema 不同**：改回镜像没有用，旧版本打不开已迁移的数据库。用升级前的冷备份 [恢复](./backup#restore)，备份之后的评论和设置修改会丢失。

## 版本列表 {#versions}

schema 一栏只有一个版本号的，表示没有数据库迁移。

| 版本 | 发布日期 | schema | 要点 |
| --- | --- | --- | --- |
| [v0.6.2](./upgrades/v0.6.2) | 2026-11-23 | v12 | 评论区默认样式的回复改为树形连线，新增 `--ecoku-thread-*` 变量。无数据库迁移。 |
| [v0.6.1](./upgrades/v0.6.1) | 2026-11-19 | v12 | 修复 Twikoo 导入、后台评论列表一致性与可信代理校验，优化评论列表读取。无数据库迁移。 |
| [v0.6.0](./upgrades/v0.6.0) | 2026-11-17 | v12 | 运行镜像迁移至 distroless Debian 13 static，镜像不含 shell/wget；新增二进制 healthcheck 探针，旧 Compose 须替换探针。无数据库迁移。 |
| [v0.5.7](./upgrades/v0.5.7) | 2026-11-12 | v12 | 优化公开读取与 SDK 加载；修复回复草稿、排序和刷新时序；后台时间跟随实例时区。无数据库迁移。 |
| [v0.5.6](./upgrades/v0.5.6) | 2026-11-09 | v12 | 修复运行时镜像 musl 与 zlib 漏洞及 `x/net` HTML 解析漏洞（GO-2026-6860），包含 v0.5.5 的全部变更；无数据库迁移，对外行为不变。 |
| [v0.5.5](./upgrades/v0.5.5) | 2026-11-09 | v12 | 镜像发布未完成，请使用 v0.5.6。 |
| [v0.5.4](./upgrades/v0.5.4) | 2026-10-23 | v12 | 修复 SDK 末页刷新、导航标题和缺失站点校验，以及首次管理员设置的数据竞争；无数据库迁移。 |
| [v0.5.3](./upgrades/v0.5.3) | 2026-10-19 | v12 | 管理后台界面打磨：导航居中、完整日期、删除确认卡片；无数据库迁移，服务端与 SDK 运行时代码不变。 |
| [v0.5.2](./upgrades/v0.5.2) | 2026-10-18 | v12 | 启动日志不再输出管理员密码，首次登录通过停服重置取得临时密码；无数据库迁移。 |
| [v0.5.1](./upgrades/v0.5.1) | 2026-10-16 | v12 | 清理未使用的配置辅助代码，减少 CI 浏览器下载；无数据库迁移，SDK 运行时代码不变。 |
| [v0.5.0](./upgrades/v0.5.0) | 2026-10-11 | v12 | 修复评论区并发、后台状态、导入、通知与来源校验；无数据库迁移，升级前检查来源冲突。 |
| [v0.4.1](./upgrades/v0.4.1) | 2026-10-09 | v12 | 移除后台全局快捷键与提示，修正 npm 包首页安装版本，无数据库迁移。 |
| [v0.4.0](./upgrades/v0.4.0) | 2026-10-09 | v12 | 后台迁移至 Svelte 5，SDK 与部署方式保持兼容，无数据库迁移。 |
| [v0.3.8](./upgrades/v0.3.8) | 2026-10-09 | v12 | Go 1.27.2 与 x/net v0.60.0 安全修复，无数据库迁移。 |
| [v0.3.7](./upgrades/v0.3.7) | 2026-10-06 | v12 | 列表性能优化、通知删除协调、安全加固、OpenSSL 更新与镜像检查修复。 |
| [v0.3.6](./upgrades/v0.3.6) | 2026-10-06 | v12 | 镜像发布未完成，请使用 v0.3.7。 |
| [v0.3.5](./upgrades/v0.3.5) | 2026-10-05 | v12 | 修复管理后台切换菜单和加载数据时的整页横向抖动。 |
| [v0.3.4](./upgrades/v0.3.4) | 2026-10-05 | v12 | 后台验证加载修复、评论提交结果提示、身份存储不阻塞加载与成功反馈。 |
| [v0.3.3](./upgrades/v0.3.3) | 2026-10-04 | v12 | 重置密码后保留管理员用户名、评论区回复层级上限、加载器 `data-i18n` 与失败提示多语言。 |
| [v0.3.2](./upgrades/v0.3.2) | 2026-10-04 | v12 | 后台设置改用输入框与逐项列表、邮件页眉印章、SDK 语言优先级修复。 |
| [v0.3.1](./upgrades/v0.3.1) | 2026-10-03 | v11 → v12 | 三语后台与评论区、站点语言、文档主题同步。 |
| [v0.3.0](./upgrades/v0.3.0) | 2026-10-03 | v10 → v11 | Smoji 独立图片来源、npm SDK 与 GHCR 发布、配置模板及文档主题更新。 |


## 迁移到 distroless 镜像 {#distroless}

从 v0.6.0 起，运行镜像从 Alpine 换成了 distroless Debian 13 static，里面没有 shell、wget 和包管理器。从 v0.5.7 或更早版本升级时，必须把 Compose 里旧的 wget 健康检查换成：

```yaml
    healthcheck:
      test: ["CMD", "/app/ecoku-server", "healthcheck"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

只换镜像不换探针，旧探针会一直失败。改了容器内端口的，加上 `--port=你的端口`。

其他保持不变：UID/GID `10001:10001`、`/app/config.yaml`、`/data` 挂载和 schema v12 都没变，数据目录不需要重新改属主，宿主机也不需要升级到 Debian 13。

排查问题时改用宿主机上的 `docker compose logs`、`docker inspect`、`docker cp`。依赖 `docker exec … sh` 的脚本需要调整。

回滚到 v0.5.7 时，同时恢复旧的 wget 健康检查，或者删掉 Compose 里的 `healthcheck` 段，使用旧镜像自带的探针。

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
<summary>内测实例（v0.2.9 及更早）的旧配置迁移</summary>

v0.2.9 在 schema v9 上增加 v10 管理员账户表。现有站点、评论、通知、验证码和历史管理员凭据都会保留；旧实例不需要在升级前修改配置。

升级时保留原来的 `compose.yaml`、`app/config.yaml` 和 `ecoku.env`，按 [升级步骤](#steps) 停服备份后启动新镜像。新版本第一次启动会：

1. 把旧的 `ECOKU_ADMIN_USERNAME`、`ECOKU_ADMIN_PASSWORD_HASH` 和 `ECOKU_ADMIN_TOKEN_KEY` 导入管理员账户和持久会话密钥；
2. 把 `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 写入 `data/ecoku-secrets.json`，并用它继续解密数据库中已有的凭据；
3. 保留旧的 `site.port`、`site.log_path`、静态目录、SQLite 路径、YAML `sites` 和 `management_key_env` 兼容行为；
4. 不生成临时密码，也不强迫旧管理员改密。

确认新版本正常运行后，再迁移为简化配置：

1. 确认能登录后台、站点数量和历史评论正确，通知设置可以打开；
2. 确认 `data/ecoku-secrets.json` 已创建，并且日志中没有 `通知凭据校验失败`；
3. 停服并按 [备份](./backup#cold-backup) 保存整个 `data/`、`app/config.yaml`、`compose.yaml` 和旧的 `ecoku.env`；
4. 停服后删除 `ecoku.env` 中的管理员变量和 `ECOKU_NOTIFICATION_ENCRYPTION_KEY`。如果仍需要 `TZ`，把它移到 Compose 的 `environment`；保留 `env_file` 时也可以只保留 `TZ`；
5. 不再需要该环境文件时才删除 Compose 的 `env_file`。如果仍通过它注入 `TZ` 或站点管理密钥，就保留 `env_file`；
6. 新配置保留 `notifications.instance_public_url`、实际使用的 `site.trusted_proxies`、`admin.allowed_origins` 和 `rate_limit`。旧字段可以暂时保留，删除前先确认不再使用旧数据库路径、文件日志或 `EcokuSite` 自动化；
7. 重建容器并再次检查后台、评论和通知。

旧的 `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 与 `data/ecoku-secrets.json` 不一致时，服务会拒绝启动，以免覆盖后无法解密已有凭据。旧数据库路径继续生效，不能只删除 `database.sqlite.path` 后把空的 `/data` 挂载进去。

内测版本不再提供生产回滚镜像。历史 schema 的恢复需要当时的完整冷备份；此处仅保留配置迁移记录。

</details>
