# REST API

This page lists Ecoku's HTTP endpoints, for reference when you write a custom frontend or automation scripts. If you use the official loader or SDK, you do not need to call these endpoints directly.

All paths are relative to the instance URL, such as `https://ecoku.example.com/api/health`.

## Conventions

### Response format

All `/api/` endpoints return JSON with the same structure:

```json
{ "code": 200, "message": "Success", "data": { } }
```

`code` is the same as the HTTP status code. On error there is usually no `data` (a failed test notification is the exception, see [Notifications](#notifications)), and `message` is a short explanation in Chinese, for example (the origin does not belong to the current site):

```json
{ "code": 403, "message": "来源不属于当前站点" }
```

Time fields are RFC 3339 strings in UTC, such as `2026-08-20T12:00:00Z`.

### Status codes

| Status code | Meaning |
| --- | --- |
| `200` / `201` | Success. Creating a comment or a site returns `201`. |
| `400` | Invalid parameters or request body, or CAPTCHA verification failed. |
| `401` | Not signed in to the admin API, or the session has expired. |
| `403` | The origin is not on the allowed list, or permission is denied. |
| `404` | The site, comment, or endpoint does not exist. |
| `405` | The path exists, but does not support the request method. |
| `409` | State conflict: the parent comment belongs to another page, the reply targets a deleted comment, the settings were changed by another session, and so on. |
| `413` | The request body exceeds the limit. |
| `422` | The comment list exceeds the read limits, or the reply is more than 16 levels deep. |
| `429` | Rate limited. The `Retry-After` response header gives the number of seconds to wait. |
| `502` | Sending a test notification failed. |
| `503` | The service is busy, a read timed out, the CAPTCHA service is unavailable, the admin session store is unavailable, or the credential encryption master key is not configured. |

### Cross-origin requests and origins

- When a browser request carries `Origin`, public endpoints accept only addresses registered as an allowed origin of some site, and admin endpoints accept only addresses in `admin.allowed_origins`. Other origins get `403`.
- Submitting a comment **must** carry an `Origin` that belongs to the site. Submissions without `Origin` are rejected too.
- Reading the comment list does not require `Origin`, so server-side scripts can call it directly.

### Request body limits

80 KiB for comment submission, 16 KiB for admin endpoints. Exceeding them returns `413`.

## Public endpoints

### Health check

```http
GET /api/health
```

```json
{ "code": 200, "message": "Success", "data": { "status": "healthy", "timestamp": 1790000000 } }
```

This only shows that the process can answer requests. It does not check the database or external services.

### Read comments

```http
GET /api/comment/list?siteId=blog&key=/posts/hello-world/&page=1&pageSize=10&sort=newest
```

| Parameter | Required | Description |
| --- | :---: | --- |
| `siteId` | Yes | Site ID. |
| `key` | Yes | Page key, at most 512 characters. |
| `page` | No | Root comment page number, default `1`. |
| `pageSize` | No | Root comments per page, 1 to 100, default `10`. |
| `sort` | No | `newest` or `oldest`. Defaults to the site setting. |

Returns the root comments on the current page, **together with all of their replies**:

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
        "username": "Alice",
        "url": "https://example.com",
        "content": "This is a root comment",
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
      "turnstileSitekey": "",
      "captcha": { "provider": "off", "sitekey": "" },
      "smoji": { "enabled": false, "manifestUrl": "" }
    }
  }
}
```

Comment fields:

| Field | Description |
| --- | --- |
| `id` | Comment ID. It corresponds to the anchor `#ecoku-comment-{id}` on the page. |
| `site_id`, `mark` | Site ID and page key. |
| `parent` | Parent comment ID; `0` for a root comment. |
| `username` | Nickname. Always "已删除" ("Deleted") for deleted comments. |
| `url` | Visitor website. The field is omitted when there is none. |
| `content` | Plain-text body. Always "[该评论已删除]" ("[This comment has been deleted]") for deleted comments. |
| `isBlogger` | Whether it is a blogger comment. |
| `deleted` | Whether it is deleted (a tombstone). |

Other fields:

| Field | Description |
| --- | --- |
| `total` | Total number of root comments, for pagination. |
| `commentTotal` | Number of all comments reachable from root comments (including replies and tombstones). |
| `pageCount` | Total number of pages. |
| `timeZone` | The server's display time zone (IANA name). |
| `formConfig` | The site's comment form settings. See the table below. |

`formConfig` fields:

| Field | Description |
| --- | --- |
| `emailRequired`, `websiteRequired` | Whether email and website are required. |
| `placeholder`, `emptyMessage` | Hint text in the comment box, and the text shown when there are no comments. |
| `defaultSort` | Default sort order. |
| `lengthLimit` | Maximum body length (counted in Unicode characters). |
| `bloggerBadge` | Blogger badge text. An empty string means no badge is shown. |
| `bloggerProofEnabled` | Whether the site has a blogger passphrase set. |
| `captcha` | The current CAPTCHA mode: `provider` is `off`, `turnstile`, or `cap`; `sitekey` is the public site key; for Cap there is also `instanceUrl`. |
| `turnstileSitekey` | Kept for old clients. Has a value only in Turnstile mode. |
| `smoji` | `enabled` controls stickers and `manifestUrl` is the manifest URL. v0.3.0 provides optional `imageOrigin`; missing or empty means the manifest origin. |

#### Read limits

To keep a single huge discussion from overwhelming the service, each request has the following limits. Exceeding any of them returns `422` instead of truncated data:

- At most 200 comments (root comments and replies combined);
- Replies at most 16 levels deep;
- At most 1 MiB of response JSON;
- When counting, at most 10,000 comments on the same page are checked.

When a page's total comment count exceeds the counting limit, the request fails even with `pageSize=1`.

In addition, the list endpoint handles at most 4 requests at a time and returns `503` with `Retry-After: 1` when busy. Database reads are limited to 2 seconds per request, and a timeout returns `503`. The read rate is limited by `rate_limit.comment_list`, 60 per IP per minute by default.

#### Level-by-level reads {#cursor}

When you pass `parentId`, the endpoint returns only one level of direct replies, without recursion and without counting totals. This suits custom frontends that expand large discussions on demand.

```http
GET /api/comment/list?siteId=blog&key=/posts/hello-world/&parentId=0&pageSize=20
GET /api/comment/list?siteId=blog&key=/posts/hello-world/&parentId=101&afterId=120&pageSize=20
```

| Parameter | Description |
| --- | --- |
| `parentId` | `0` reads root comments. A positive integer reads the direct replies of that comment (including deleted ones). |
| `afterId` | Return only comments with an ID greater than this. Default `0`. |
| `pageSize` | 1 to 100, default `10`. |

Results are sorted by ID in ascending order. `afterId` must be used together with `parentId`; in this mode you cannot also pass `page` or `sort`; doing so returns `400`. If the parent comment does not exist or does not belong to the page, the response is `404`.

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

When `hasMore` is `true`, use `nextAfterId` as the `afterId` of the next request. The 1 MiB response limit applies here too. If you exceed it, retry with a smaller `pageSize`.

### Submit a comment

```http
POST /api/comment/submit
Content-Type: application/json
Origin: https://blog.example.com
```

```json
{
  "siteId": "blog",
  "mark": "/posts/hello-world/",
  "pageTitle": "Hello, world",
  "parent": 0,
  "username": "Alice",
  "email": "alice@example.com",
  "url": "https://example.com",
  "content": "Plain-text body",
  "captchaToken": "..."
}
```

| Field | Required | Description |
| --- | :---: | --- |
| `siteId` | Yes | Site ID. |
| `mark` | Yes | Page key: a relative path on the site, at most 512 characters. It cannot be a full URL and cannot contain `?` or `#`. |
| `pageTitle` | No | Post title, at most 200 characters, used in notifications. |
| `parent` | No | ID of the comment being replied to. For a root comment, pass `0` or omit it. |
| `username` | Yes | Nickname, at most 80 characters. |
| `email` | Depends on site settings | Email, at most 254 characters. |
| `url` | Depends on site settings | Website. Only `http`/`https` is accepted, at most 2048 characters. |
| `content` | Yes | Body, no longer than the site's length limit. |
| `captchaToken` | When verification is enabled | The one-time token returned by the Turnstile or Cap widget. |

On success, it returns `201`:

```json
{ "code": 201, "message": "评论提交成功", "data": { "id": 102, "isBlogger": false } }
```

To post as the blogger, put the blogger passphrase in `username` and leave `email` and `url` empty. When the passphrase matches, the server saves the comment with the site's blogger nickname, blogger email, and site URL, and `isBlogger` is `true`.

Errors related to submission:

| Status code | Reason |
| --- | --- |
| `400` | Invalid fields; CAPTCHA verification failed (`请完成验证后再发布。`, "complete verification before posting"); or the body contains a non-conforming Smoji marker. |
| `403` | `Origin` is missing, or the origin does not belong to the site. |
| `404` | The site or parent comment does not exist. |
| `409` | The parent comment belongs to another page, or the parent comment is deleted. |
| `413` | The request body exceeds 80 KiB. |
| `422` | The reply is more than 16 levels deep. |
| `429` | Exceeds `rate_limit.comment_submit` (by default 5 per IP every 60 seconds). |
| `503` | The CAPTCHA service is unavailable. |

## Admin endpoints

Admin endpoints live under `/api/admin/`. When `admin.allowed_origins` below is not set, it is the origin of `notifications.instance_public_url`.

### Authentication

- **Session cookie**: after a successful `POST /api/admin/login`, the server sets a cookie named `ecoku_admin_session` (HttpOnly, SameSite=Strict, Path=`/api/admin`, with Secure in production), valid for 8 hours. The sign-in response does not contain a token.
- The sign-in request, and every non-GET request authenticated by cookie, must carry an `Origin` from `admin.allowed_origins`.
- Requests authenticated with `Authorization: Bearer <credential>` may omit `Origin`; if they carry one, it must still be in `admin.allowed_origins`, otherwise the response is `403`. The Bearer credential must be a currently valid session that has not been signed out. Old tokens issued before v0.2.4 are no longer valid.
- Sign-in requires HTTPS. Only loopback addresses may use HTTP.

### Sign-in and sessions

| Method and path | Description |
| --- | --- |
| `GET /api/admin/login-config` | No sign-in needed. Returns the CAPTCHA settings the sign-in page needs (`captcha`, `turnstileSitekey`). |
| `POST /api/admin/login` | Request body `{"username", "password", "captchaToken"}`. On success, returns `{"expires_at", "expires_in"}` and sets the cookie; a temporary first-login session also returns `requires_password_change: true`. Rate limited by `rate_limit.admin_login`. |
| `GET /api/admin/session` | Returns `expires_at`, remaining `expires_in`, and `requires_password_change`. It does not extend the session. |
| `POST /api/admin/initial-setup` | Accepts only a temporary first-login session. The body is `{"username", "password"}`; success revokes the temporary session and sets a normal administrator session. |
| `POST /api/admin/logout` | Revokes the current session and clears the cookie. A `503` means sign-out did not succeed. |

### Sites

| Method and path | Description |
| --- | --- |
| `GET /api/admin/sites` | All sites. |
| `POST /api/admin/sites` | Create a site. |
| `GET /api/admin/sites/:siteId` | A single site. |
| `PUT /api/admin/sites/:siteId` | Update a site. The request body must include the `revision` you got when reading it; if it is missing, the response is `400`. If another session changed the site in the meantime, the response is `409`. |

Site fields: `id`, `site_url`, `name`, `allowed_origins`, `default_sort`, `email_required`, `website_required`, `placeholder`, `comment_limit`, `empty_message`, `smoji_enabled`, `smoji_manifest_url`, `smoji_image_origin`, `blogger_nickname`, `blogger_email`, `blogger_badge`, `blogger_passphrase` (write-only), `revision`. Responses use `blogger_passphrase_set` to show whether a passphrase is set, and also include the read-only `created_at` and `updated_at`. The site list is in the `data.data` array; a single site, and the result of creating or updating one, is in `data.site`.

`smoji_image_origin` is an optional trusted image origin, for example `https://s3-cdn.zsh.moe`. Empty means the manifest origin. Omitting it on update preserves the existing value; an empty string restores the default. Public `formConfig.smoji.imageOrigin` is returned only when configured. Loading, submission, rendering, and email use the same rule. See [Smoji hosting settings](../integration/smoji#hosting).

Creating a site whose ID already exists, or whose `allowed_origins` duplicates `admin.allowed_origins`, returns `409`.

### Comments

| Method and path | Description |
| --- | --- |
| `GET /api/admin/sites/:siteId/comments` | Comment list. Parameters: `status` (`published` or `deleted`, default `published`), `page` (max 1000000), `pageSize` (default 20, max 100), `sort` (`newest` or `oldest`, default `newest`). The response includes `total`, `pageCount`, and the per-status counts `counts`. |
| `GET /api/admin/sites/:siteId/comments/:commentId` | A single comment, including the private email. |
| `DELETE /api/admin/sites/:siteId/comments/:commentId` | Tombstone delete. Deleting an already deleted comment again returns success, with `unchanged` set to `true`. |
| `DELETE /api/admin/sites/:siteId/comments/:commentId/permanent` | Permanent delete. Only works on a tombstone with no replies; otherwise returns `409`. |

Both delete endpoints are rate limited by `rate_limit.comment_delete`.

### CAPTCHA

| Method and path | Description |
| --- | --- |
| `GET /api/admin/captcha` | Current settings. Secrets are not returned; `secret_set` shows whether one is set. |
| `PUT /api/admin/captcha` | Save settings: `provider` (`off`, `turnstile`, `cap`), `turnstile.sitekey` / `secret`, `cap.instance_url` / `sitekey` / `secret`, and `revision`. An empty secret means unchanged. |

`/api/admin/turnstile` is the old endpoint. It still works, but new code should use `/api/admin/captcha`.

### Notifications {#notifications}

| Method and path | Description |
| --- | --- |
| `GET /api/admin/notifications` | Email and Telegram settings. The password and token are not returned; `password_set` and `token_set` show whether they are set. |
| `PUT /api/admin/notifications/email` | Save email settings: `enabled`, `host`, `port`, `encryption` (`tls` or `starttls`), `username`, `password`, `from_address`, `recipients`, `revision`. |
| `POST /api/admin/notifications/email/test` | Send a test email with the settings in the request. On failure it returns `502`, with `data.error_code` set to `timeout`, `authentication_failed`, `tls_failed`, or `delivery_failed`. |
| `PUT /api/admin/notifications/telegram` | Save Telegram settings: `enabled`, `token`, `targets`, `revision`. |
| `POST /api/admin/notifications/telegram/test` | Send a test message. Failures are reported the same way. |

Both test endpoints are rate limited by `rate_limit.notification_test`.
