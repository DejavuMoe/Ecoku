# REST API Reference

Ecoku provides a clean, predictable RESTful HTTP interface divided into public visitor endpoints and authenticated administrative endpoints.

---

## General Conventions & Status Codes

- **Payload Format**: All responses use `application/json; charset=utf-8`.
- **Timestamps**: Formatted as ISO 8601 UTC strings (e.g. `2026-08-20T12:00:00Z`).
- **Standard HTTP Status Codes**:
  - `200 OK`: Request succeeded.
  - `201 Created`: Resource successfully created.
  - `400 Bad Request`: Malformed parameters or invalid payload.
  - `401 Unauthorized`: Missing or expired administrator session.
  - `403 Forbidden`: Request origin not permitted by site CORS whitelist.
  - `404 Not Found`: Target site, parent comment, or resource not found.
  - `422 Unprocessable Entity`: Request exceeds resource budgets (200 nodes, 16 depth levels, 10,000 count probe, 1 MiB JSON).
  - `429 Too Many Requests`: Rate limit quota exceeded (includes `Retry-After` header).
  - `503 Service Unavailable`: Server busy (all 4 worker slots saturated) or DB read timeout (2 seconds).

---

## 1. Public Endpoints

### Health Check `GET /api/health`
- **Method**: `GET`
- **Authentication**: None
- **Response Example (HTTP 200)**:
  ```json
  {
    "code": 200,
    "message": "success",
    "data": {
      "status": "healthy",
      "timestamp": 1756700000
    }
  }
  ```

---

### Fetch Comment List `GET /api/comment/list`

By default, returns complete discussion threads paginated by root comments. Successful responses include `data.data`, root count `total`, reachable comments count `commentTotal`, pagination `page/pageSize/pageCount`, `formConfig`, and server `timeZone`.

Complete-thread mode allows up to **200 returned nodes, 16 descendant levels** (root depth 0), and an ID/parent count probe of at most **10,000 records per site/page**. Exceeding any budget returns **422 Unprocessable Entity** rather than a partial tree or approximate count. When the overall page record count exceeds 10,000, even `pageSize=1` will fail; the current SDK displays its standard loading failure and will not switch modes automatically.

For on-demand, single-layer reads, pass `parentId`: `0` reads roots only; a positive parent ID reads direct children of that comment only (including tombstones within the same site/page). Use `afterId` (default 0) for **ascending ID cursor pagination** with `pageSize` (default 10, max 100). Do not combine this mode with `page` or `sort`. It does not expand descendants or calculate totals. The response `data` contains `data` (comments), `parentId`, `pageSize`, `hasMore`, `nextAfterId`, `formConfig`, and `timeZone`. Request the next batch with `nextAfterId` only when `hasMore: true`. Missing or out-of-scope parent comments return 404; invalid parameters return 400.

```http
GET /api/comment/list?siteId=blog&key=/posts/example/&parentId=0&pageSize=20
GET /api/comment/list?siteId=blog&key=/posts/example/&parentId=101&afterId=120&pageSize=20
```

Both modes cap the complete escaped JSON payload at **1 MiB**; exceeding it returns 422 (retry with a smaller `pageSize`). List processing shares **4 concurrent worker slots** and a **2-second database read deadline**. Saturation returns 503 with `Retry-After: 1`; deadline expiry returns 503. Comment counts and descendant reads run within the same SQLite read snapshot. [Read rate limiting](../self-hosting/configuration.md) defaults to **60 requests per IP per 60 seconds**, returning 429 with `Retry-After`.

- **Query Parameters**:
  - `siteId` (string, required): Unique site identifier.
  - `key` (string, required): Canonical site-relative page path.
  - `page` (number, optional): Root comments page number (default 1).
  - `pageSize` (number, optional): Root comments per page (default 10, max 100).
  - `sort` (string, optional): Sorting order: `newest` (default) or `oldest`.
  - `parentId` (number, optional): Enable single-layer cursor mode. `0` for roots, positive integer for children of specific comment.
  - `afterId` (number, optional): Cursor anchor ID for pagination (used with `parentId`).

- **Full-Thread Response Example (HTTP 200)**:
  ```json
  {
    "code": 200,
    "message": "获取评论成功",
    "data": {
      "data": [
        {
          "id": 101,
          "site_id": "blog",
          "mark": "/posts/example/",
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
        "placeholder": "Write a comment (plain text only)",
        "defaultSort": "newest",
        "lengthLimit": 1000,
        "emptyMessage": "No comments yet.\nBe the first to comment.",
        "bloggerBadge": "[Blogger]",
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

- **Cursor Mode Response Example (HTTP 200, with `parentId`)**:
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
          "username": "Bob",
          "content": "This is a reply to comment 101",
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
        "placeholder": "Write a comment (plain text only)",
        "defaultSort": "newest",
        "lengthLimit": 1000,
        "emptyMessage": "No comments yet.\nBe the first to comment.",
        "bloggerBadge": "[Blogger]",
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

### Submit Comment `POST /api/comment/submit`

Submit a new root comment or reply to an existing discussion. Request body limit: **80 KiB**.

- **Request Body (JSON)**:
  ```json
  {
    "siteId": "blog",
    "mark": "/posts/hello-world/",
    "pageTitle": "Hello World",
    "parent": 0,
    "username": "Alice",
    "email": "alice@example.com",
    "url": "https://example.com",
    "content": "Plain text content only",
    "captchaToken": "0.xxxxxx"
  }
  ```

- **Response Example (HTTP 201 Created)**:
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

- **Blogger Passphrase Authentication**:
  If a blogger passphrase is configured on the site, entering the secret passphrase in `username` (leaving `email` and `url` empty) authenticates the author as the verified blogger and displays the blogger badge.

---

New replies support at most 16 descendant levels (root = 0). Level 17 returns 422 and asks the visitor to reply higher in the thread. Existing deep threads and imported data remain unchanged. The 200-node, 1 MiB JSON and 10,000-node counting budgets still apply.

## 2. Admin Endpoints

The admin browser uses the HttpOnly cookie set by login and same-origin requests. Login JSON contains no token. Login and cookie-authenticated writes require an `Origin` matching `admin.allowed_origins`; session restoration GET may omit Origin. Trusted automation can use a cookie jar. Explicit `Authorization: Bearer` also requires a registered, unrevoked new session credential; legacy stateless tokens are rejected. Existing site-scoped `EcokuSite` tombstone permissions remain unchanged.

Admin write request bodies are limited to **16 KiB**.

### Session restoration and logout

- `GET /api/admin/session`: returns the original `expires_at` and remaining `expires_in`, without renewal or credentials. Invalid/expired sessions return 401; unavailable storage returns 503.
- `POST /api/admin/logout`: revokes the current session and clears its cookie. Success returns 200; a failed write returns 503 and must not be treated as logout. Both endpoints require the instance administrator.

### Admin Login `POST /api/admin/login`
- **Request Body**:
  ```json
  {
    "username": "admin",
    "password": "my-strong-password",
    "captchaToken": "0.xxxxxx"
  }
  ```
- **Response Example (HTTP 200)**:
  ```json
  {
    "code": 200,
    "message": "Success",
    "data": {
      "expires_at": "2026-08-20T20:00:00Z",
      "expires_in": 28800
    }
  }
  ```

### Admin Login Configuration `GET /api/admin/login-config`
Retrieves public CAPTCHA configuration required to render bot protection on the admin login page (no authentication required).

### Site Management Endpoints
- `GET /api/admin/sites`: List all registered sites and their settings.
- `POST /api/admin/sites`: Register a new site (requires `id`, `site_url`, `name`, `allowed_origins`, etc.).
- `GET /api/admin/sites/:siteId`: Retrieve configuration details for a specific site.
- `PUT /api/admin/sites/:siteId`: Update site configuration (supports optimistic locking via `revision`).

### Bot Protection & CAPTCHA Endpoints
- `GET /api/admin/captcha`: Retrieve current tri-state CAPTCHA configuration (passwords masked).
- `PUT /api/admin/captcha`: Update instance bot protection (off / turnstile / cap).

### Notification Channels Endpoints
- `GET /api/admin/notifications`: Get SMTP and Telegram notification configuration.
- `PUT /api/admin/notifications/email`: Update SMTP email settings (passwords encrypted with master key via AES-256-GCM).
- `POST /api/admin/notifications/email/test`: Dispatch a test email to verify SMTP connectivity.
- `PUT /api/admin/notifications/telegram`: Update Telegram Bot settings.
- `POST /api/admin/notifications/telegram/test`: Dispatch a test Telegram message.

### Comment Moderation Endpoints
- `GET /api/admin/sites/:siteId/comments`: Paginated search and filtering of comments across published and deleted states.
- `GET /api/admin/sites/:siteId/comments/:commentId`: Detailed comment view with thread context.
- `DELETE /api/admin/sites/:siteId/comments/:commentId`: Tombstone soft delete (erases author personal information, preserves thread hierarchy).
- `DELETE /api/admin/sites/:siteId/comments/:commentId/permanent`: Hard purge (permitted **only if the comment has zero descendant replies**).
