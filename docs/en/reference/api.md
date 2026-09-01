# REST API Reference

---

## 1. Public Endpoints

### Health Check `GET /api/health`
- **Method**: `GET`
- **Auth**: None
- **Response (HTTP 200)**:
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

### List Comments `GET /api/comment/list`
- Query parameters: `siteId`, `key`, `page`, `pageSize`, `sort`
- Successful default responses retain `data.data`, root `total`, reachable `commentTotal`, `page/pageSize/pageCount`, `formConfig` and `timeZone`.
- Complete-thread mode permits **200 returned nodes, 16 descendant levels** (root depth 0), and an ID/parent probe of at most **10,000 records per site/page**. Exceeding a budget returns **422**, never a partial tree or approximate total. An oversized article fails even with `pageSize=1`. The current SDK displays its existing load-failure state; it does not switch modes automatically.
- For on-demand reads, set `parentId=0` for roots or a positive parent ID for direct children only, including tombstones within the same site/page. Use `afterId` (default 0) for **ascending ID** cursor pagination and `pageSize` (default 10, max 100). Do not combine this mode with `page` or `sort`. It neither expands descendants nor counts totals. The response `data` contains `data` (comments), `parentId/pageSize/hasMore/nextAfterId/formConfig/timeZone`; continue with `nextAfterId` only when `hasMore=true`. Missing or out-of-scope parents return 404; invalid parameters return 400.

```http
GET /api/comment/list?siteId=blog&key=/posts/example/&parentId=0&pageSize=20
GET /api/comment/list?siteId=blog&key=/posts/example/&parentId=101&afterId=120&pageSize=20
```

Both modes cap the complete escaped JSON envelope at **1 MiB**; a larger response returns 422 (retry with a smaller `pageSize`). List processing has **4 concurrent slots** and a **2-second database-read deadline**. Saturation returns 503 with `Retry-After: 1`; deadline expiry returns 503. Comment counts and descendant reads share a SQLite snapshot. The [read rate limit](../self-hosting/configuration.md) defaults to **60 requests per IP per 60 seconds**, returning 429 with `Retry-After`.

### Submit Comment `POST /api/comment/submit`
Submit a new root comment or reply to an existing comment. Body size limit: **80 KiB**.

- **JSON Body**:
  ```json
  {
    "siteId": "blog",
    "mark": "/posts/hello-world/",
    "pageTitle": "Hello World",
    "parent": 0,
    "username": "Alice",
    "email": "alice@example.com",
    "url": "https://example.com",
    "content": "Plain text comment body",
    "captchaToken": "0.xxxxxx"
  }
  ```

- **Response (HTTP 201 Created)**:
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

- **Blogger Passphrase**:
  If configured on the site, typing the secret passphrase into `username` (leaving `email` and `url` empty) authenticates the author as the verified blogger.

---

## 2. Admin Endpoints

All admin endpoints (except `login-config` and `login`) require the `Authorization: Bearer {TOKEN}` header. Request body size limit: **16 KiB**.

- `GET /api/admin/login-config`: Retrieve CAPTCHA configuration for login form.
- `POST /api/admin/login`: Administrator authentication. Returns `{ "code": 200, "data": { "token": "...", "token_type": "Bearer", "expires_at": "...", "expires_in": 28800 } }`.
- `GET /api/admin/sites`: List all registered sites.
- `POST /api/admin/sites`: Register a new site.
- `GET /api/admin/sites/:siteId`: Get site configuration.
- `PUT /api/admin/sites/:siteId`: Update site configuration.
- `GET /api/admin/captcha`: Get current instance bot protection configuration.
- `PUT /api/admin/captcha`: Update instance bot protection (off / turnstile / cap).
- `GET /api/admin/notifications`: Get notification channels configuration.
- `PUT /api/admin/notifications/email`: Update email SMTP settings.
- `POST /api/admin/notifications/email/test`: Send a test email.
- `PUT /api/admin/notifications/telegram`: Update Telegram Bot settings.
- `POST /api/admin/notifications/telegram/test`: Send a test Telegram message.
- `GET /api/admin/sites/:siteId/comments`: Paginated comment list for moderation.
- `GET /api/admin/sites/:siteId/comments/:commentId`: Detailed comment view.
- `DELETE /api/admin/sites/:siteId/comments/:commentId`: Tombstone soft delete (wipes personal data, retains thread tree).
- `DELETE /api/admin/sites/:siteId/comments/:commentId/permanent`: Hard purge (only if no children exist).
