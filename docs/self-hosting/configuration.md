# 配置字典与环境变量参考

表中的默认值是程序兜底值。示例中的 `/app/client`、`/app/admin`、`/data/ecoku.sqlite3` 和 `ECOKU_*` 环境变量名由部署模板显式填写；升级继续保留现有值即可。

本篇提供 `app/config.yaml` 配置文件与 `ecoku.env` 环境变量的完整字段参考与技术规范。

`rate_limit.comment_list` 控制单 IP 的公开列表读取次数，默认每个 `window_seconds` 窗口 60 次（窗口默认 60 秒）。两种列表模式共用同一桶，超限返回 429 和 `Retry-After`；其他操作使用独立桶。每个限流器最多保存 10,000 个活跃地址桶，满时拒绝新地址，过期后释放。沿用 `trusted_proxies` 规则，反代后未配置可信代理时访客会共享代理 IP 的额度。

两种列表模式的保护均在 CORS 查询前执行；列表路径的预检和被拒绝来源也计入读取额度。提前拒绝不会添加未经验证的跨域许可，因此跨域浏览器可能只显示加载失败。取消事务后若 SQLite 重建连接，外键、同步级别和忙等待设置会自动重新应用。

---

## 配置文件 `app/config.yaml`

`app/config.yaml` 在容器启动时挂载为只读文件（`:ro`），定义了实例的服务端口、存储路径、频控规则与各模块的基础参数。

```yaml
site:
  port: 12123
  log_path: "/var/log/ecoku/ecoku.log"
  trusted_proxies:
    - "172.18.0.1/32"

client:
  static_dir: "/app/client"

rate_limit:
  window_seconds: 60
  comment_submit: 5
  comment_list: 60
  comment_delete: 30
  admin_login: 5
  notification_test: 5

notifications:
  encryption_key_env: "ECOKU_NOTIFICATION_ENCRYPTION_KEY"
  instance_public_url: "https://ecoku.example.com"

database:
  sqlite:
    path: "/data/ecoku.sqlite3"

admin:
  enabled: true
  static_dir: "/app/admin"
  username_env: "ECOKU_ADMIN_USERNAME"
  password_hash_env: "ECOKU_ADMIN_PASSWORD_HASH"
  token_key_env: "ECOKU_ADMIN_TOKEN_KEY"
  token_ttl_minutes: 480
  allowed_origins:
    - "https://ecoku.example.com"
```

### 字段详细说明

#### 1. `site` 基础服务配置
| 配置项 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `port` | 整数 | 否 | `12123` | 服务监听的内部端口。 |
| `log_path` | 字符串 | 否 | `""` | 日志输出路径。为空、`stdout` 或 `-` 时仅写标准输出；指定文件路径时在进程内自动轮转归档。 |
| `trusted_proxies` | 字符串列表 | 否 | `[]` | 信任的反向代理 IP 或 CIDR 列表（如 Docker 网关 `172.18.0.1/32`）。仅匹配对端的请求才解析 `X-Forwarded-For`。 |

#### 2. `client` 静态资源
| 配置项 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `static_dir` | 字符串 | 否 | `""` | 浏览器 SDK 与加载器静态文件所在的目录路径。 |

#### 3. `rate_limit` 频控规则
所有限流规则基于固定窗口在单进程内存中运行：
| 配置项 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `window_seconds` | 整数 | 否 | `60` | 限流时间窗口（秒）。 |
| `comment_submit` | 整数 | 否 | `5` | 单 IP 在时间窗口内允许的最大评论提交次数。 |
| `comment_list` | 整数 | 否 | `60` | 单 IP 在时间窗口内允许的最大公开列表读取次数，两种读取模式共用。 |
| `comment_delete` | 整数 | 否 | `30` | 单 IP 在时间窗口内允许的最大删除请求次数。 |
| `admin_login` | 整数 | 否 | `5` | 单 IP 在时间窗口内允许的最大管理端登录尝试次数。 |
| `notification_test`| 整数 | 否 | `5` | 单 IP 在时间窗口内允许的最大通知测试发送次数。 |

#### 4. `notifications` 通知服务
| 配置项 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `encryption_key_env` | 字符串 | 是 | `""` | 存储敏感配置的主加密密钥对应的环境变量名称。 |
| `instance_public_url` | 字符串 | 否 | `""` | 启用通知时需填写的实例公开地址；当前不用于生成邮件链接，邮件原文链接来自站点 `site_url` 与评论 `mark`。 |

#### 5. `database` 数据库
| 配置项 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `sqlite.path` | 字符串 | 是 | `./data/ecoku.bin` | SQLite3 数据库文件的绝对路径（代码内置兜底为 `./data/ecoku.bin`，容器部署固定为 `/data/ecoku.sqlite3`）。 |

#### 6. `admin` 管理后台
| 配置项 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `enabled` | 布尔 | 否 | `false` | 是否启用管理端后台。生产环境部署需显式配置为 `true`。 |
| `static_dir` | 字符串 | 否 | `./admin` | 管理端静态 HTML/JS 资源目录（代码内置兜底为 `./admin`，容器部署固定为 `/app/admin`）。 |
| `username_env` | 字符串 | 是 | `""` | 管理员用户名对应的环境变量名。 |
| `password_hash_env` | 字符串 | 是 | `""` | 管理员 bcrypt 密码哈希对应的环境变量名。 |
| `token_key_env` | 字符串 | 是 | `""` | 管理员 Bearer Token 签名密钥对应的环境变量名。 |
| `token_ttl_minutes` | 整数 | 否 | `480` | 兼容键，只能省略或设为 `480`；固定登录后 8 小时，不滚动续期。 |
| `allowed_origins` | 字符串列表 | 是 | `[]` | 允许访问管理后台 API 的精确 Origin 列表（需包含协议与域名）。 |

#### 7. `sites` 初始站点种子（可选）
仅在数据库**首次初始化**时将配置项作为种子站点写入数据库。初始化后，所有站点配置以数据库为准，后续可在管理后台随时新增与调整：
| 配置项 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | 字符串 | 是 | 站点唯一标识符（字母/数字开头，匹配 `^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$`）。 |
| `site_url` | 字符串 | 是 | 规范站点 URL（如 `https://blog.example.com`）。 |
| `name` | 字符串 | 否 | 站点可读名称（留空时自动回退为域名）。 |
| `allowed_origins` | 字符串列表 | 是 | 允许调用评论接口的前端精确 Origin 列表。 |
| `management_key_env` | 字符串 | 否 | 外部自动化调用评论删除 API 的独立凭据环境变量名（至少 32 字符，各站点不可共享）。 |
| `comment` | 对象 | 否 | 评论表单默认规则（`placeholder`, `default_sort`, `length_limit`, `empty_message`, `email_required`, `website_required`）。 |

---

## 环境变量 `ecoku.env`

环境变量通过 Docker Compose 的 `env_file` 指令注入，保存所有高敏感机密：

| 变量名 | 必填 | 安全要求 | 示例与生成方式 |
| :--- | :--- | :--- | :--- |
| `GIN_MODE` | 否 | 生产环境固定为 `release` | `release` |
| `TZ` | 否 | 标准 IANA 时区标识 | `Asia/Shanghai` |
| `ECOKU_ADMIN_USERNAME` | 是 | 管理员登录用户名（1～80 字符） | `admin` |
| `ECOKU_ADMIN_PASSWORD_HASH` | 是 | 管理员密码的 bcrypt 哈希值 | 由 `ecoku-server hash-password` 命令生成 |
| `ECOKU_ADMIN_TOKEN_KEY` | 是 | 管理员 Bearer Token HMAC 签名密钥（至少 32 字符） | `openssl rand -hex 32` |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | 是 | 数据库凭据 AES-256-GCM 主加密密钥（Base64 编码的 32 字节串） | `openssl rand -base64 32` |
