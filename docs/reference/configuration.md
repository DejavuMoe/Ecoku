# 配置参考

::: info 升级与配置迁移
本页适用于 v0.2.9。现有 v0.2.8 实例请先阅读[升级与旧配置迁移](../self-hosting/upgrade#legacy-config)。
:::

新部署的手工配置只有 `app/config.yaml`：

```yaml
notifications:
  instance_public_url: "https://ecoku.example.com"
```

站点、评论、通知、人机验证和管理员账户保存在 SQLite 中，在[管理后台](../self-hosting/admin)修改。官方镜像固定使用端口 `12123`、浏览器资源 `/app/client`、管理页面 `/app/admin` 和数据库 `/data/ecoku.sqlite3`。新实例的会话签名密钥、通知加密主密钥和管理员账户也保存在 `data/` 中。

配置文件只能包含一个 YAML 文档。未知字段会拒绝启动；旧版本字段在兼容期内仍可读取，见[旧配置迁移](../self-hosting/upgrade#legacy-config)。

## site

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `trusted_proxies` | `[]` | 允许其转发 `X-Forwarded-For` 的直连对端，写 IP 或 CIDR。通常只填 Docker 网关，例如 `172.18.0.1/32`。禁止 `0.0.0.0/0` 与 `::/0`。详见[反向代理](../self-hosting/reverse-proxy#trusted-proxies)。 |

## rate_limit {#rate-limit}

所有限流按客户端 IP 计数，状态保存在进程内存中，重启后清零。超过限额返回 `429` 和 `Retry-After`。

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `window_seconds` | `60` | 计数窗口长度（秒）。 |
| `comment_submit` | `5` | 每个窗口允许提交的评论数。 |
| `comment_list` | `60` | 每个窗口允许读取评论列表的次数。 |
| `comment_delete` | `30` | 每个窗口允许删除的次数。 |
| `admin_login` | `5` | 每个窗口允许的登录尝试次数。 |
| `notification_test` | `5` | 每个窗口允许发送测试通知的次数。 |

## notifications

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `instance_public_url` | 空 | Ecoku 的公网地址，例如 `https://ecoku.example.com`。它也是未显式填写 `admin.allowed_origins` 时的管理后台来源。启用通知前必须填写。 |

## admin

管理后台和管理 API 始终启用，页面位于 `/admin/`。

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `allowed_origins` | `instance_public_url` 的来源 | 允许访问管理 API 的浏览器来源。只有从多个地址打开后台时才需要填写。至少要有一个管理来源。 |

新实例启动时会自动创建管理员 `admin` 和随机临时密码。临时密码只显示在首次启动日志中，首次登录后必须修改。新管理员账户不需要环境变量。

## 日志 {#logs}

日志写到标准输出，用 `docker compose logs` 查看，保留和轮转由 Docker 管理。新部署不挂载 `app/logs`，也不需要 `site.log_path`。

## 环境变量 {#env}

新部署不需要 `ecoku.env`。如需指定显示时区，可在 Compose 中设置可选的 `TZ`，例如 `Asia/Shanghai`。

旧实例的下列环境变量会在升级时继续读取，并写入 `data/ecoku-secrets.json` 或 `admin_accounts`：

| 变量 | 用途 |
| --- | --- |
| `ECOKU_ADMIN_USERNAME` | 旧管理员用户名。 |
| `ECOKU_ADMIN_PASSWORD_HASH` | 旧管理员 bcrypt 密码哈希。 |
| `ECOKU_ADMIN_TOKEN_KEY` | 旧管理员会话签名密钥。 |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | 旧通知、人机验证凭据的加密主密钥。值必须保持不变，直到迁移完成。 |

旧变量导入并验证成功后，可以停服备份，再删除它们，让程序改用 `/data` 中的持久状态。

## 旧配置字段 {#legacy}

新模板不再写这些字段，但兼容期内旧配置仍可读取：`site.port`、`site.log_path`、`client.static_dir`、`admin.static_dir`、`database.sqlite.path`、`sites`、`management_key_env`、`admin.enabled`、`admin.token_ttl_minutes`、管理员和通知的 `*_env` 字段。新实例不要添加这些字段；迁移方式见[升级](../self-hosting/upgrade#legacy-config)。

镜像内固定设置 `GIN_MODE=release` 与 `ECOKU_RUNTIME=container`，新部署不要覆盖它们。
