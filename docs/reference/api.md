# REST API

本页列出 Ecoku 的 HTTP 接口，供编写自定义前端或自动化脚本时参考。使用官方加载器或 SDK 时，不需要直接调用这些接口。

所有路径都相对于实例地址，例如 `https://ecoku.example.com/api/health`。

## 通用约定

### 响应格式

所有 `/api/` 接口返回 JSON，结构统一：

```json
{ "code": 200, "message": "Success", "data": { } }
```

`code` 与 HTTP 状态码相同。没有返回数据时省略 `data`：出错时通常如此，退出登录和测试通知成功也不带 `data`；测试通知失败会带 `error_code`，见[通知](#notifications)。`message` 是一句中文说明，例如：

```json
{ "code": 403, "message": "来源不属于当前站点" }
```

时间字段为 UTC 的 RFC 3339 字符串，如 `2026-08-20T12:00:00Z`。

### 状态码

| 状态码 | 含义 |
| --- | --- |
| `200` / `201` | 成功；创建评论和站点时返回 `201`。 |
| `400` | 参数或请求体不合法，人机验证未通过。 |
| `401` | 管理接口未登录或会话已失效。 |
| `403` | 来源不在允许列表中，或没有权限。 |
| `404` | 站点、评论或接口不存在。 |
| `409` | 状态冲突：父评论属于其他页面、回复已删除的评论、配置已被其他会话修改等。 |
| `413` | 请求体超过上限。 |
| `422` | 评论列表超出读取上限，或回复层数超过 16 层。 |
| `429` | 触发限流，响应头 `Retry-After` 给出需要等待的秒数。 |
| `500` | 服务端内部错误，操作没有完成。 |
| `502` | 测试通知发送失败。 |
| `503` | 服务繁忙、请求处理超时、人机验证服务不可用、管理员会话存储不可用，或未配置凭据加密主密钥。 |

路径存在但不支持该请求方法时，同样返回 `404` 和「接口不存在」；服务端不区分这两种情况。

### 跨域与来源

- 浏览器请求带有 `Origin` 时，公开接口只接受已登记为某个站点允许来源的地址，管理接口只接受 `admin.allowed_origins` 中的地址，其他来源返回 `403`。
- 提交评论**必须**带有属于该站点的 `Origin`，没有 `Origin` 的提交也会被拒绝。
- 读取评论列表不要求 `Origin`，服务端脚本可以直接调用。
- 浏览器发起 CORS 预检时，`OPTIONS` 请求直接返回 `204`，没有响应体。

### 请求体上限

提交评论 80 KiB，管理接口 16 KiB。超过返回 `413`。

## 公开接口

### 健康检查

```http
GET /api/health
```

```json
{ "code": 200, "message": "Success", "data": { "status": "healthy", "timestamp": 1790000000 } }
```

只表示进程能够响应请求，不检查数据库或外部服务。

### 读取评论

```http
GET /api/comment/list?siteId=blog&key=/posts/hello-world/&page=1&pageSize=10&sort=newest
```

| 参数 | 必填 | 说明 |
| --- | :---: | --- |
| `siteId` | 是 | 站点 ID。 |
| `key` | 是 | 页面 key，最多 512 个字符。 |
| `page` | 否 | 根评论页码，默认 `1`。 |
| `pageSize` | 否 | 每页根评论数，1～100，默认 `10`。 |
| `sort` | 否 | `newest` 或 `oldest`，默认使用站点设置。 |

返回当前页的根评论，**以及它们的全部回复**：

```json
{
  "code": 200,
  "message": "获取评论成功",
  "data": {
    "data": [
      {
        "id": 101,
        "site_id": "blog",
        "mark": "/posts/hello-world/",
        "parent": 0,
        "username": "张三",
        "url": "https://example.com",
        "content": "这是一条根评论",
        "isBlogger": false,
        "deleted": false,
        "created_at": "2026-08-20T12:00:00Z",
        "updated_at": "2026-08-20T12:00:00Z"
      }
    ],
    "total": 1,
    "commentTotal": 1,
    "page": 1,
    "pageSize": 10,
    "pageCount": 1,
    "timeZone": "Asia/Shanghai",
    "formConfig": {
      "i18n": "zh-CN",
      "emailRequired": true,
      "websiteRequired": false,
      "placeholder": "写下评论（仅支持纯文本）",
      "defaultSort": "newest",
      "lengthLimit": 1000,
      "emptyMessage": "还没有评论\n成为第一个留下评论的人。",
      "bloggerBadge": "[博主]",
      "bloggerProofEnabled": true,
      "turnstileSitekey": "",
      "captcha": { "provider": "off", "sitekey": "" },
      "smoji": { "enabled": false, "manifestUrl": "" }
    }
  }
}
```

评论字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 评论 ID。页面上对应锚点 `#ecoku-comment-{id}`。 |
| `site_id`、`mark` | 站点 ID 与页面 key。 |
| `parent` | 父评论 ID，根评论为 `0`。 |
| `username` | 昵称。已删除的评论固定为「已删除」；昵称为空的导入评论显示为「匿名用户」。 |
| `url` | 访客网址，没有时省略该字段。 |
| `content` | 纯文本正文。已删除的评论固定为「[该评论已删除]」。 |
| `isBlogger` | 是否博主评论。 |
| `deleted` | 是否已删除（墓碑）。 |

其他字段：

| 字段 | 说明 |
| --- | --- |
| `total` | 根评论总数，用于分页。 |
| `commentTotal` | 从根评论可达的全部评论数（含回复与墓碑）。 |
| `pageCount` | 总页数。 |
| `timeZone` | 服务端的显示时区（IANA 名称）。 |
| `formConfig` | 该站点的评论表单设置，见下表。 |

`formConfig` 字段：

| 字段 | 说明 |
| --- | --- |
| `i18n` | 站点评论区默认语言：`zh-CN`、`zh-Hant` 或 `en`。SDK 接入配置中的 `i18n` 可以覆盖它。 |
| `emailRequired`、`websiteRequired` | 邮箱、网址是否必填。 |
| `placeholder`、`emptyMessage` | 评论框提示文字、无评论时的文字。 |
| `defaultSort` | 默认排序。 |
| `lengthLimit` | 正文字数上限（按 Unicode 字符计）。 |
| `bloggerBadge` | 博主标志文字，空字符串表示不显示。 |
| `bloggerProofEnabled` | 站点是否已设置博主口令。 |
| `captcha` | 当前人机验证方式：`provider` 为 `off`、`turnstile` 或 `cap`；`sitekey` 为公开的 Site key；Cap 时另有 `instanceUrl`。 |
| `turnstileSitekey` | 为旧客户端保留。仅在 Turnstile 模式下有值。 |
| `smoji` | `enabled` 表示是否启用，`manifestUrl` 为清单地址；`imageOrigin` 仅在站点配置了图片来源时返回，未返回时使用清单来源。 |

#### 读取上限

为防止单个超大讨论拖垮服务，每次请求有以下上限，超过任何一项返回 `422`，不返回截断的数据：

- 最多 200 条评论（根评论与回复合计）；
- 回复最多 16 层；
- 响应 JSON 最多 1 MiB；
- 统计时，同一页面最多检查 10,000 条评论。

页面评论总数超过统计上限时，即使 `pageSize=1` 也会失败。

此外，列表接口同时最多处理 4 个请求，繁忙时返回 `503` 和 `Retry-After: 1`；每次请求的数据库读取限时 2 秒，超时返回 `503`。读取频率受 `rate_limit.comment_list` 限制，默认每个 IP 每分钟 60 次。

#### 逐层读取 {#cursor}

传入 `parentId` 时，接口改为只返回一层直接回复，不递归，也不统计总数。适合自定义前端按需展开大型讨论。

```http
GET /api/comment/list?siteId=blog&key=/posts/hello-world/&parentId=0&pageSize=20
GET /api/comment/list?siteId=blog&key=/posts/hello-world/&parentId=101&afterId=120&pageSize=20
```

| 参数 | 说明 |
| --- | --- |
| `parentId` | `0` 表示读取根评论，正整数表示读取这条评论的直接回复（包括已删除的）。 |
| `afterId` | 只返回 ID 大于它的评论，默认 `0`。 |
| `pageSize` | 1～100，默认 `10`。 |

结果按 ID 升序排列。`afterId` 必须和 `parentId` 一起使用；这种模式下不能同时传 `page` 或 `sort`，否则返回 `400`。父评论不存在或不属于该页面时返回 `404`。

```json
{
  "code": 200,
  "message": "获取评论成功",
  "data": {
    "data": [ { "id": 121, "parent": 101, "...": "..." } ],
    "parentId": 101,
    "pageSize": 20,
    "hasMore": true,
    "nextAfterId": 140,
    "timeZone": "Asia/Shanghai",
    "formConfig": { }
  }
}
```

`hasMore` 为 `true` 时，把 `nextAfterId` 作为下一次请求的 `afterId`。1 MiB 响应上限同样适用，超过时可减小 `pageSize` 重试。

### 提交评论 {#submit-comment}

```http
POST /api/comment/submit
Content-Type: application/json
Origin: https://blog.example.com
```

```json
{
  "siteId": "blog",
  "mark": "/posts/hello-world/",
  "pageTitle": "你好，世界",
  "parent": 0,
  "username": "张三",
  "email": "zhangsan@example.com",
  "url": "https://example.com",
  "content": "纯文本正文",
  "captchaToken": "..."
}
```

| 字段 | 必填 | 说明 |
| --- | :---: | --- |
| `siteId` | 是 | 站点 ID。 |
| `mark` | 是 | 页面 key，站内相对路径，最多 512 个字符，不能是完整 URL，不能带 `?` 或 `#`。 |
| `pageTitle` | 否 | 文章标题，最多 200 个字符，用于通知。 |
| `parent` | 否 | 回复的评论 ID；根评论传 `0` 或省略。 |
| `username` | 是 | 昵称，最多 80 个字符。 |
| `email` | 视站点设置 | 邮箱，最多 254 个字符。 |
| `url` | 视站点设置 | 网址，只接受 `http`/`https`，最多 2048 个字符。 |
| `content` | 是 | 正文，不超过站点的字数上限。 |
| `captchaToken` | 启用验证时 | Turnstile 或 Cap 组件返回的一次性 token。 |

成功返回 `201`：

```json
{ "code": 201, "message": "评论提交成功", "data": { "id": 102, "isBlogger": false } }
```

来源检查、站点与验证配置读取、人机验证和评论写入共享 8 秒处理预算，并响应请求取消。官方 SDK 的单次请求超时为 10 秒。评论与通知事件在同一事务中保存。

连接中断、超时或未收到有效的成功响应时，评论可能已经保存。官方 SDK 会保留草稿并提示结果尚未确认，不自动重发。此接口不提供幂等重试保证；重试前请核对评论，避免重复发布。

博主发言时，`username` 填博主口令，`email` 和 `url` 留空。口令匹配后，服务端用站点的博主昵称、邮箱和站点 URL 保存，`isBlogger` 返回 `true`。

提交相关的错误：

| 状态码 | 原因 |
| --- | --- |
| `400` | 字段不合法；人机验证未通过（`请完成验证后再发布。`）；正文中含有不合规的 Smoji 标记。 |
| `403` | 缺少 `Origin`，或来源不属于该站点。 |
| `404` | 站点或父评论不存在。 |
| `409` | 父评论属于其他页面，或父评论已删除。 |
| `413` | 请求体超过 80 KiB。 |
| `422` | 回复层数超过 16 层。 |
| `429` | 超过 `rate_limit.comment_submit`（默认每个 IP 每 60 秒 5 次）。 |
| `503` | 人机验证服务不可用，或请求处理超时、取消。 |

## 管理接口

管理接口位于 `/api/admin/`。下文的 `admin.allowed_origins` 没有填写时，取 `notifications.instance_public_url` 的来源。

### 认证方式

- **会话 Cookie**：`POST /api/admin/login` 成功后，服务端设置名为 `ecoku_admin_session` 的 Cookie（HttpOnly、SameSite=Strict、Path=`/api/admin`，生产环境带 Secure），有效期 8 小时。登录响应中不包含 token。
- 登录请求，以及用 Cookie 认证的非 GET 请求，必须带有 `admin.allowed_origins` 中的 `Origin`。
- 用 `Authorization: Bearer <凭据>` 认证的请求可以不带 `Origin`；如果带了，仍须在 `admin.allowed_origins` 中，否则返回 `403`。Bearer 凭据必须是当前有效、未注销的会话；v0.2.4 之前签发的旧 token 不再有效。
- **站点管理凭据**：站点在 `app/config.yaml` 中配置了 `management_key_env` 时，服务端自动化可以用 `Authorization: EcokuSite <凭据>` 对该站点的评论执行墓碑删除（`DELETE /api/admin/sites/:siteId/comments/:commentId`）。凭据无效返回 `401`；指向其他站点返回 `403`「无权管理该站点」；访问其他管理接口（包括彻底删除和读取接口）返回 `403`「站点管理凭据不能访问此接口」。
- 登录要求 HTTPS，只有回环地址可以用 HTTP。

### 登录与会话

| 方法与路径 | 说明 |
| --- | --- |
| `GET /api/admin/login-config` | 无需登录。返回登录页需要的人机验证配置（`captcha`、`turnstileSitekey`）和后台语言 `locale`（取自 `ECOKU_ADMIN_LOCALE`）。 |
| `POST /api/admin/login` | 请求体 `{"username", "password", "captchaToken"}`。成功返回 `{"expires_at", "expires_in"}` 并设置 Cookie；用临时密码登录时额外返回 `requires_password_change: true` 和当前用户名 `username`。受 `rate_limit.admin_login` 限流。 |
| `GET /api/admin/session` | 返回当前会话的 `expires_at`、剩余秒数 `expires_in` 和是否需要首次改密的 `requires_password_change`，需要改密时另含 `username`；不延长会话。 |
| `POST /api/admin/initial-setup` | 只接受首次临时密码会话。请求体为 `{"username", "password"}`，成功后撤销临时会话并设置普通管理员会话。 |
| `POST /api/admin/logout` | 注销当前会话并清除 Cookie。返回 `503` 时表示注销没有成功。 |

### 站点

| 方法与路径 | 说明 |
| --- | --- |
| `GET /api/admin/sites` | 所有站点。 |
| `POST /api/admin/sites` | 新建站点。 |
| `GET /api/admin/sites/:siteId` | 单个站点。 |
| `PUT /api/admin/sites/:siteId` | 更新站点。请求体需带上读取时得到的 `revision`，缺少时返回 `400`；期间被其他会话修改过时返回 `409`。 |

站点字段：`id`、`site_url`、`name`、`allowed_origins`、`i18n`、`default_sort`、`email_required`、`website_required`、`placeholder`、`comment_limit`、`empty_message`、`smoji_enabled`、`smoji_manifest_url`、`smoji_image_origin`、`blogger_nickname`、`blogger_email`、`blogger_badge`、`blogger_passphrase`（只写）、`revision`。响应中用 `blogger_passphrase_set` 表示是否已设置口令，另含只读的 `created_at`、`updated_at`。站点列表在 `data.data` 数组中，单个站点以及创建、更新的结果在 `data.site` 中。

`smoji_image_origin` 为选填的受信任图片来源，例如 `https://s3-cdn.zsh.moe`。留空使用清单来源；更新请求省略该字段时保留原值，传空字符串恢复默认。公开 `formConfig.smoji.imageOrigin` 仅在已配置时返回。加载、提交、显示和邮件通知使用同一规则，见 [Smoji 托管设置](../integration/smoji#hosting)。

`i18n` 只接受 `zh-CN`、`zh-Hant`、`en`（及 `zh-TW`、`en-US` 等地区写法），其他值返回 `400`。更新请求省略该字段时保留原值。

新建站点时 ID 已存在，或 `allowed_origins` 与 `admin.allowed_origins` 重复，都返回 `409`。

### 评论

| 方法与路径 | 说明 |
| --- | --- |
| `GET /api/admin/sites/:siteId/comments` | 评论列表。参数：`status`（`published` 或 `deleted`，默认 `published`）、`page`（最大 1000000）、`pageSize`（默认 20，最大 100）、`sort`（`newest` 或 `oldest`，默认 `newest`）。响应含 `total`、`pageCount` 和各状态数量 `counts`。 |
| `GET /api/admin/sites/:siteId/comments/:commentId` | 单条评论，含私有邮箱。 |
| `DELETE /api/admin/sites/:siteId/comments/:commentId` | 墓碑删除。已删除的评论再次删除时返回成功，`unchanged` 为 `true`。 |
| `DELETE /api/admin/sites/:siteId/comments/:commentId/permanent` | 彻底删除。只能用于没有回复的墓碑，否则返回 `409`。 |

两个删除接口都受 `rate_limit.comment_delete` 限流。

### 人机验证

| 方法与路径 | 说明 |
| --- | --- |
| `GET /api/admin/captcha` | 当前设置。Secret 不返回，用 `secret_set` 表示是否已设置。 |
| `PUT /api/admin/captcha` | 保存设置：`provider`（`off`、`turnstile`、`cap`），`turnstile.sitekey` / `secret`，`cap.instance_url` / `sitekey` / `secret`，以及 `revision`。Secret 留空表示不修改。 |

`/api/admin/turnstile` 是旧版接口，仍然可用，新代码请使用 `/api/admin/captcha`。

### 通知 {#notifications}

| 方法与路径 | 说明 |
| --- | --- |
| `GET /api/admin/notifications` | 邮件与 Telegram 设置。密码与 Token 不返回，用 `password_set`、`token_set` 表示。 |
| `PUT /api/admin/notifications/email` | 保存邮件设置：`enabled`、`host`、`port`、`encryption`（`tls` 或 `starttls`）、`username`、`password`、`from_address`、`recipients`、`revision`。 |
| `POST /api/admin/notifications/email/test` | 用请求中的设置发送测试邮件。失败返回 `502`，`data.error_code` 为 `timeout`、`authentication_failed`、`tls_failed` 或 `delivery_failed`。 |
| `PUT /api/admin/notifications/telegram` | 保存 Telegram 设置：`enabled`、`token`、`targets`、`revision`。 |
| `POST /api/admin/notifications/telegram/test` | 发送测试消息，失败时同上。 |

两个测试接口受 `rate_limit.notification_test` 限流。
