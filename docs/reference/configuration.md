# 配置参考

Ecoku 的配置分两处：

- `app/config.yaml`：实例级参数，容器启动时读取一次，挂载为只读。修改后需要重建容器才会生效。
- `ecoku.env`：管理员凭据、密钥和时区，通过 Compose 的 `env_file` 注入。

站点、博主、人机验证和通知设置不在这两个文件里，而是保存在 SQLite 数据库中，在[管理后台](../self-hosting/admin)修改。

## 通用规则

- 配置文件只能包含一个 YAML 文档，出现未知字段会拒绝启动。旧版本遗留的 MySQL、普通用户等字段也会导致启动失败。
- 数值类字段写 `0` 或省略时，使用下表中的默认值。
- 表中的“默认值”是程序在字段省略时的取值。官方镜像内的端口、目录、日志和数据库路径已经内置（表中标“容器内”），[Docker 部署](../self-hosting/docker)时 `config.yaml` 通常只需要 `notifications.instance_public_url`，配置反向代理后再加 `site.trusted_proxies`。
- 已经显式写出的字段仍然有效，旧的完整配置文件不需要删减。
- 配置文件里只写环境变量的**名字**（`*_env` 字段），密钥本身放在 `ecoku.env`。

修改 `config.yaml` 或 `ecoku.env` 后，执行下面的命令重建容器：

```bash
cd ~/Ecoku && sudo docker compose up -d --force-recreate ecoku
```

`docker compose restart` 不会重新读取 `ecoku.env`。

## site

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `port` | `12123` | 容器内监听端口，范围 1～65535。改动后要同步修改 `compose.yaml` 的端口映射。 |
| `log_path` | 空；容器内 `/var/log/ecoku/ecoku.log` | 日志总是写到 stdout，可用 `docker compose logs` 查看。填一个文件路径时，另外保存一份到该文件，单个文件满 10 MB 轮转，保留 5 个压缩旧文件、最长 28 天。空值、`stdout`、`-` 或 `/dev/stdout` 表示只写 stdout。 |
| `trusted_proxies` | `[]` | 允许其转发 `X-Forwarded-For` 的直连对端，写 IP 或 CIDR。通常只填 Docker 网关，如 `172.18.0.1/32`。禁止 `0.0.0.0/0` 与 `::/0`。详见[反向代理](../self-hosting/reverse-proxy#trusted-proxies)。 |

日志不包含 IP、User-Agent、评论正文或凭据。访问日志只记录路由模板（如 `/api/admin/sites/:siteId`），不记录实际路径参数。

## client

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `static_dir` | 空；容器内 `/app/client` | 浏览器资源所在目录。填写后，Ecoku 在 `/client/` 下提供 `ecoku-loader.js`、`ecoku.umd.js`、`ecoku.css`、`ecoku.unstyled.css`，缺少任一文件会拒绝启动。留空则不提供这些文件。 |

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
| `encryption_key_env` | `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | 存放凭据加密主密钥的环境变量名，一般不需要修改。在后台保存 SMTP 密码、Telegram Bot Token 或人机验证 Secret Key 时需要它。 |
| `instance_public_url` | 空 | Ecoku 的公网地址，如 `https://ecoku.example.com`。启用邮件或 Telegram 通知前必须填写。没有写 `admin.allowed_origins` 时，它的来源（协议 + 域名 + 可选端口）也是管理后台的来源。通知里的原文链接由站点 URL 和页面路径拼接，不使用此地址。 |

## database

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `sqlite.path` | `./data/ecoku.bin`；容器内 `/data/ecoku.sqlite3` | SQLite 数据库文件路径。容器内的默认值对应宿主机的 `data/ecoku.sqlite3`。 |

数据库以 WAL 模式运行，运行时同目录下会有 `-wal` 和 `-shm` 文件，备份时需要整个 `data/` 目录一起保存。

## admin

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `enabled` | `false`；容器内 `true` | 是否启用管理后台和管理 API。关闭时 `/admin/` 与 `/api/admin/*` 都不存在。 |
| `static_dir` | `./admin`；容器内 `/app/admin` | 管理后台静态文件目录。缺少 `index.html` 或 `assets/` 会拒绝启动。目录里有 `favicon.svg` 时，以 `/admin/favicon.svg` 提供标签页图标；没有时不影响启动。 |
| `username_env` | `ECOKU_ADMIN_USERNAME` | 存放管理员用户名的环境变量名，一般不需要修改。 |
| `password_hash_env` | `ECOKU_ADMIN_PASSWORD_HASH` | 存放管理员密码 bcrypt 哈希的环境变量名，一般不需要修改。 |
| `token_key_env` | `ECOKU_ADMIN_TOKEN_KEY` | 存放会话签名密钥的环境变量名，一般不需要修改。 |
| `token_ttl_minutes` | `480` | 兼容保留的字段。会话固定为登录后 8 小时，只能省略或写 `480`，写其他值会拒绝启动。 |
| `allowed_origins` | `notifications.instance_public_url` 的来源 | 允许访问管理 API 的浏览器来源，即打开后台时地址栏中的 `协议://域名[:端口]`。只有用多个地址打开后台时才需要填写。启用后台时，它和 `instance_public_url` 至少要有一个。 |

启用后台时，Ecoku 在启动阶段还会检查：

- 三个 `*_env` 必须是不同的环境变量，且值都不能为空；
- 密码哈希必须是有效的 bcrypt，cost 不低于 10（`hash-password` 生成的哈希满足要求）；
- 签名密钥至少 32 字节，且不能与密码哈希或任何站点管理密钥相同；
- `allowed_origins` 不能与 `sites` 中任何站点的允许来源重复。后台新建或修改站点时，也不能使用管理端来源，否则保存失败。

## sites（可选） {#sites}

`sites` 用于在**全新数据库第一次初始化时**预先写入站点。数据库一旦创建，站点就以数据库为准，之后修改 YAML 中的站点设置不会再生效，请在后台管理站点。唯一的例外是 `management_key_env`，它每次启动都会读取。YAML 中的站点条目每次启动仍会校验，写错同样会拒绝启动。大多数部署不需要写这一节。

```yaml
sites:
  - id: "blog"
    site_url: "https://blog.example.com"
    name: "我的博客"
    allowed_origins:
      - "https://blog.example.com"
    management_key_env: "ECOKU_BLOG_MANAGEMENT_KEY"
    comment:
      default_sort: "newest"
      email_required: true
      website_required: false
      length_limit: 1000
```

| 字段 | 说明 |
| --- | --- |
| `id` | 站点 ID，1～100 个字符，以字母或数字开头，只能包含字母、数字、`.`、`_`、`-`。 |
| `site_url` | 站点规范地址，用来拼接通知里的原文链接。只能是 `http`/`https`，不能带查询串或片段。省略时取 `allowed_origins` 的第一项。 |
| `name` | 站点名称，最多 120 个字符。留空时显示域名。 |
| `allowed_origins` | 允许嵌入评论区的来源，至少一个。 |
| `management_key_env` | 可选。存放该站点管理密钥的环境变量名，值至少 32 字节，各站点不能共用。管理密钥的用途见 [REST API](./api#management-key)。 |
| `comment.default_sort` | `newest`（默认）或 `oldest`。 |
| `comment.email_required` | 邮箱是否必填，默认 `true`。 |
| `comment.website_required` | 网址是否必填，默认 `false`。 |
| `comment.placeholder` | 评论框提示文字，最多 80 个字符，不能换行。 |
| `comment.length_limit` | 正文字数上限，1～10000，默认 1000。 |
| `comment.empty_message` | 没有评论时显示的文字，最多 240 个字符。 |

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `ECOKU_ADMIN_USERNAME` | 启用后台时 | 管理员用户名，1～80 个字符。 |
| `ECOKU_ADMIN_PASSWORD_HASH` | 启用后台时 | 管理员密码的 bcrypt 哈希。用 `hash-password` 命令生成，见[命令行](./cli#hash-password)。 |
| `ECOKU_ADMIN_TOKEN_KEY` | 启用后台时 | 会话签名密钥，至少 32 字节。可用 `openssl rand -hex 32` 生成。 |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | 保存凭据时 | Base64 编码的 32 字节密钥（带或不带填充均可）。可用 `openssl rand -base64 32` 生成。 |
| `TZ` | 否 | 评论时间的显示时区，IANA 名称，如 `Asia/Shanghai`。不设置或名称无效时回退到容器的系统时区，无法识别时使用 `Asia/Shanghai`。建议显式填写。 |
| 站点管理密钥 | 否 | 变量名由 `sites[].management_key_env` 决定，例如 `ECOKU_BLOG_MANAGEMENT_KEY`。配置了该字段时值必须存在，至少 32 字节。 |

`ecoku.env` 中每个值建议用单引号包住，避免 bcrypt 哈希中的 `$` 被 Compose 展开。填写示例与生成命令见 [Docker 部署](../self-hosting/docker#env)。

镜像内已设置 `GIN_MODE=release` 与 `ECOKU_RUNTIME=container`（启用上文的“容器内”默认值），不要在 `ecoku.env` 中修改。

更换 `ECOKU_ADMIN_TOKEN_KEY` 或密码哈希后重建容器，所有已登录的管理员会话都会失效。

`ECOKU_NOTIFICATION_ENCRYPTION_KEY` 不能随意更换：数据库中已经保存的凭据是用旧密钥加密的，换掉后 Ecoku 无法解密，会在启动时报错退出。
