# REST API 参考

Ecoku 提供了整洁的 RESTful HTTP 接口，分为面向访客的**公开评论接口**与面向管理者的**管理后台接口**。

---

## 通用约定与状态码

- **响应格式**：所有接口均返回 `application/json; charset=utf-8`。
- **时间格式**：采用 ISO 8601 UTC 时间戳（如 `2026-08-20T10:00:00Z`）。
- **标准状态码**：
  - `200 OK`：请求成功。
  - `400 Bad Request`：参数校验未通过。
  - `401 Unauthorized`：未提供有效凭据或管理 Token 已过期。
  - `403 Forbidden`：跨域 Origin 未在站点白名单中。
  - `429 Too Many Requests`：触发了单 IP 内存频控限流。
  - `500 Internal Server Error`：服务端处理异常。

---

## 1. 公开端点（Public Endpoints）

### 健康检查 `GET /api/health`
- **请求方法**：`GET`
- **认证方式**：公开无认证
- **响应示例 (HTTP 200)**：
  ```json
  {
    "code": 200,
    "message": "Success",
    "data": {
      "status": "healthy",
      "timestamp": 1756700000
    }
  }
  ```

---

### 获取评论列表 `GET /api/comment/list`
默认按根线程分页返回完整评论树。成功响应保持 `data.data`、根数 `total`、可达评论数 `commentTotal`、`page/pageSize/pageCount`、`formConfig` 和 `timeZone`。

完整线程模式最多返回 **200 个节点、16 层后代**（根为 0 层）；统计最多检查同站点/页面的 **10,000 条 ID/父关系**。任何预算超限返回 **422**，不返回残缺线程或近似总数。页面总记录超限时，即使 `pageSize=1` 也会失败；现有 SDK 显示既有加载失败状态，不会自动切换读取模式。

需要按需读取时，显式传入 `parentId`：`0` 只取根节点，正整数只取该父节点的直接子评论（包括墓碑，限定同站点/页面）。传入 `afterId`（默认 0）按 **ID 升序**继续读取；`pageSize` 默认 10、最大 100，不可同时使用 `page` 或 `sort`。该模式不递归、不计算总数，响应 `data` 内为 `data` 评论数组、`parentId/pageSize/hasMore/nextAfterId/formConfig/timeZone`；仅在 `hasMore=true` 时用 `nextAfterId` 继续请求。父节点不存在或不属于该站点/页面返回 404，参数无效返回 400。

```http
GET /api/comment/list?siteId=blog&key=/posts/example/&parentId=0&pageSize=20
GET /api/comment/list?siteId=blog&key=/posts/example/&parentId=101&afterId=120&pageSize=20
```

两种模式的完整 JSON 上限均为 **1 MiB**（包含转义和封装）；超限返回 422，可减小 `pageSize` 重试。列表处理共享 **4 个并发名额**及每次 **2 秒数据库读取超时**；繁忙时返回 503 / `Retry-After: 1`，超时返回 503。评论统计与后代查询在同一 SQLite 快照中执行，不会因并发写入无限增长。读取频控见[配置参考](../self-hosting/configuration.md)：默认每 IP 每 60 秒 60 次，超限返回 429 / `Retry-After`。

- **Query 参数**：
  - `siteId` (string, 必填)：站点 ID。
  - `key` (string, 必填)：站内页面相对路径。
  - `page` (number, 可选)：根评论页码（默认 1）。
  - `pageSize` (number, 可选)：每页根评论数量（默认 10，最大 100）。
  - `sort` (string, 可选)：排序方式，`newest` 或 `oldest`。

- **响应示例 (HTTP 200)**：
  ```json
  {
    "code": 200,
    "data": {
      "data": [
        {
          "id": 101,
          "site_id": "blog",
          "mark": "/posts/example/",
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
        "emailRequired": true,
        "websiteRequired": false,
        "placeholder": "写下评论（仅支持纯文本）",
        "defaultSort": "newest",
        "lengthLimit": 1000,
        "emptyMessage": "还没有评论\n成为第一个留下评论的人。",
        "bloggerBadge": "[博主]",
        "bloggerProofEnabled": true,
        "turnstileSitekey": "example-sitekey",
        "captcha": {
          "provider": "turnstile",
          "sitekey": "example-sitekey"
        },
        "smoji": {
          "enabled": false,
          "manifestUrl": ""
        }
      }
    }
  }
  ```

- **游标模式响应示例 (HTTP 200，传入 parentId)**：
  ```json
  {
    "code": 200,
    "message": "获取评论成功",
    "data": {
      "data": [
        {
          "id": 105,
          "site_id": "blog",
          "mark": "/posts/example/",
          "parent": 101,
          "username": "李四",
          "content": "这是一条子评论",
          "isBlogger": false,
          "deleted": false,
          "created_at": "2026-08-20T12:05:00Z",
          "updated_at": "2026-08-20T12:05:00Z"
        }
      ],
      "parentId": 101,
      "pageSize": 20,
      "hasMore": true,
      "nextAfterId": 105,
      "timeZone": "Asia/Shanghai",
      "formConfig": {
        "emailRequired": true,
        "websiteRequired": false,
        "placeholder": "写下评论（仅支持纯文本）",
        "defaultSort": "newest",
        "lengthLimit": 1000,
        "emptyMessage": "还没有评论\n成为第一个留下评论的人。",
        "bloggerBadge": "[博主]",
        "bloggerProofEnabled": true,
        "turnstileSitekey": "example-sitekey",
        "captcha": {
          "provider": "turnstile",
          "sitekey": "example-sitekey"
        },
        "smoji": {
          "enabled": false,
          "manifestUrl": ""
        }
      }
    }
  }
  ```

---

### 提交评论 `POST /api/comment/submit`
提交一条新的根评论或对已有评论发表回复。请求体上限为 **80 KiB**。

- **请求体 (JSON)**：
  ```json
  {
    "siteId": "blog",
    "mark": "/posts/hello-world/",
    "pageTitle": "你好，世界",
    "parent": 0,
    "username": "张三",
    "email": "zhangsan@example.com",
    "url": "https://example.com",
    "content": "纯文本正文内容",
    "captchaToken": "0.xxxxxx"
  }
  ```

- **响应示例 (HTTP 201 Created)**：
  ```json
  {
    "code": 201,
    "message": "评论提交成功",
    "data": {
      "id": 102,
      "isBlogger": false
    }
  }
  ```

- **博主免密发表**：
  若站点已配置博主口令，博主只需将 `username` 设置为口令明文，`email` 与 `url` 留空，服务端校验通过后会自动赋予博主身份。

---

## 2. 管理端端点（Admin Endpoints）

所有管理端端点（除获取登录配置与登录接口外）必须在请求头中携带 Bearer Token：
```http
Authorization: Bearer {ADMIN_TOKEN}
```
管理端所有写操作（POST / PUT / DELETE）请求体上限为 **16 KiB**。

### 管理员登录 `POST /api/admin/login`
- **请求体**：
  ```json
  {
    "username": "admin",
    "password": "my-strong-password",
    "captchaToken": "0.xxxxxx"
  }
  ```
- **响应示例 (HTTP 200)**：
  ```json
  {
    "code": 200,
    "message": "Success",
    "data": {
      "token": "eyJ2IjoxLCJzdWIiOiJhZG1pbiIs...",
      "token_type": "Bearer",
      "expires_at": "2026-08-20T20:00:00Z",
      "expires_in": 28800
    }
  }
  ```

### 获取管理端配置 `GET /api/admin/login-config`
获取管理端登录界面所需的人机验证公钥与参数（无需登录）。

### 站点管理接口
- `GET /api/admin/sites`：获取全部注册站点列表与配置。
- `POST /api/admin/sites`：注册新站点（需提供 `id`, `site_url`, `name`, `allowed_origins` 等）。
- `GET /api/admin/sites/:siteId`：获取指定站点的详细配置。
- `PUT /api/admin/sites/:siteId`：更新指定站点的配置（支持乐观锁 `revision`）。

### 安全与人机验证接口
- `GET /api/admin/captcha`：获取当前人机验证三态配置（密码部分掩码保护）。
- `PUT /api/admin/captcha`：更新人机验证三态配置（关闭 / Turnstile / Cap）。

### 通知渠道管理接口
- `GET /api/admin/notifications`：获取 SMTP 邮件与 Telegram 通知渠道配置。
- `PUT /api/admin/notifications/email`：更新邮件通知配置（SMTP 凭据使用主密钥 AES-GCM 加密存储）。
- `POST /api/admin/notifications/email/test`：发送一封测试邮件验证 SMTP 连通性。
- `PUT /api/admin/notifications/telegram`：更新 Telegram Bot 通知配置。
- `POST /api/admin/notifications/telegram/test`：发送测试 Telegram 消息验证 Bot 连通性。

### 评论治理接口
- `GET /api/admin/sites/:siteId/comments`：管理端多条件分页查询评论列表。
- `GET /api/admin/sites/:siteId/comments/:commentId`：获取单条评论详情与上下文。
- `DELETE /api/admin/sites/:siteId/comments/:commentId`：将评论执行墓碑化软删除，清空隐私并保留树结构。
- `DELETE /api/admin/sites/:siteId/comments/:commentId/permanent`：对**没有任何子评论**的孤立墓碑评论执行物理 DELETE 清除。
