# 配置参考

本页对应下一版本，现有实例请先阅读[配置迁移](../self-hosting/upgrade#unreleased-config)。

Ecoku 的配置分两处：

- `app/config.yaml`：实例级参数，容器启动时读取一次，挂载为只读。修改后需要重建容器才会生效。
- `ecoku.env`：管理员凭据、密钥和时区，通过 Compose 的 `env_file` 注入。

站点、博主、人机验证和通知设置不在这两个文件里，而是保存在 SQLite 数据库中，在[管理后台](../self-hosting/admin)修改。监听端口 `12123`、浏览器资源、管理后台页面和数据库文件 `/data/ecoku.sqlite3` 的位置都固定在镜像里，不能配置。

## 通用规则

- 配置文件只能包含一个 YAML 文档，出现未知字段会拒绝启动，日志会给出字段所在的行。
- 数值类字段写 `0` 或省略时，使用下表中的默认值。
- [Docker 部署](../self-hosting/docker)时 `config.yaml` 通常只需要 `notifications.instance_public_url`，配置反向代理后再加 `site.trusted_proxies`。

修改 `config.yaml` 或 `ecoku.env` 后，执行下面的命令重建容器：

```bash
cd ~/Ecoku && sudo docker compose up -d --force-recreate ecoku
```

`docker compose restart` 不会重新读取 `ecoku.env`。

## site

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `trusted_proxies` | `[]` | 允许其转发 `X-Forwarded-For` 的直连对端，写 IP 或 CIDR。通常只填 Docker 网关，如 `172.18.0.1/32`。禁止 `0.0.0.0/0` 与 `::/0`。详见[反向代理](../self-hosting/reverse-proxy#trusted-proxies)。 |

## rate_limit {#rate-limit}

所有限流都按客户端 IP 计数，窗口固定、状态保存在进程内存中，重启后清零。超过限额时返回 `429` 和 `Retry-After` 响应头。每种操作的计数互相独立。

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `window_seconds` | `60` | 计数窗口长度（秒），所有操作共用。 |
| `comment_submit` | `5` | 每个窗口内允许提交的评论数。 |
| `comment_list` | `60` | 每个窗口内允许读取评论列表的次数。浏览器的 CORS 预检和来源被拒绝的请求也计入。 |
| `comment_delete` | `30` | 每个窗口内允许的删除请求数。软删除与彻底删除分别计数。 |
| `admin_login` | `5` | 每个窗口内允许的管理员登录尝试次数。 |
| `notification_test` | `5` | 每个窗口内允许发送测试通知的次数。测试邮件与测试 Telegram 消息分别计数。 |

每种限流最多同时跟踪 10,000 个 IP。已满时，新出现的 IP 会被拒绝，直到有旧记录过期；已有 IP 的额度不会被挤掉。

没有正确配置 `trusted_proxies` 时，反向代理后面的所有访客会被算成同一个 IP，共享这里的额度。

## notifications

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `instance_public_url` | 空 | Ecoku 的公网地址，如 `https://ecoku.example.com`。启用邮件或 Telegram 通知前必须填写。没有写 `admin.allowed_origins` 时，它的来源（协议 + 域名 + 可选端口）也是管理后台的来源。通知里的原文链接由站点 URL 和页面路径拼接，不使用此地址。 |

## admin

管理后台和管理 API 始终启用，镜像在 `/admin/` 提供后台页面。

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `allowed_origins` | `notifications.instance_public_url` 的来源 | 允许访问管理 API 的浏览器来源，即打开后台时地址栏中的 `协议://域名[:端口]`。只有用多个地址打开后台时才需要填写。它和 `instance_public_url` 至少要有一个，否则服务无法启动。 |

Ecoku 在启动阶段还会检查：

- `ECOKU_ADMIN_USERNAME`、`ECOKU_ADMIN_PASSWORD_HASH`、`ECOKU_ADMIN_TOKEN_KEY` 都不能为空；
- 密码哈希必须是有效的 bcrypt，cost 不低于 10（`hash-password` 生成的哈希满足要求）；
- 签名密钥至少 32 字节，且不能与密码哈希相同。

后台新建或修改站点时，站点的允许来源不能与管理后台的来源相同，否则保存失败。

## 日志 {#logs}

日志写到标准输出，用 `docker compose logs` 查看，保留与轮转由 Docker 的日志设置决定。日志不包含 IP、User-Agent、评论正文或凭据。访问日志只记录路由模板（如 `/api/admin/sites/:siteId`），不记录实际路径参数。

## 环境变量 {#env}

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `ECOKU_ADMIN_USERNAME` | 是 | 管理员用户名，1～80 个字符。 |
| `ECOKU_ADMIN_PASSWORD_HASH` | 是 | 管理员密码的 bcrypt 哈希。用 `hash-password` 命令生成，见[命令行](./cli#hash-password)。 |
| `ECOKU_ADMIN_TOKEN_KEY` | 是 | 会话签名密钥，至少 32 字节。可用 `openssl rand -hex 32` 生成。 |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | 保存凭据时 | 加密数据库中的 SMTP 密码、Telegram Bot Token 和人机验证 Secret Key。Base64 编码的 32 字节密钥（带或不带填充均可），可用 `openssl rand -base64 32` 生成。 |
| `TZ` | 否 | 评论和通知的显示时区，IANA 名称，如 `Asia/Shanghai`。不设置或名称无效时回退到容器的系统时区，无法识别时使用 `Asia/Shanghai`。建议显式填写。 |

`ecoku.env` 中每个值建议用单引号包住，避免 bcrypt 哈希中的 `$` 被 Compose 展开。填写示例与生成命令见 [Docker 部署](../self-hosting/docker#env)。

镜像内已设置 `GIN_MODE=release` 与 `ECOKU_RUNTIME=container`，不要在 `ecoku.env` 中修改。

更换 `ECOKU_ADMIN_TOKEN_KEY` 或密码哈希后重建容器，所有已登录的管理员会话都会失效。

`ECOKU_NOTIFICATION_ENCRYPTION_KEY` 不能随意更换：数据库中已经保存的凭据是用旧密钥加密的，换掉后 Ecoku 无法解密，会在启动时报错退出。
