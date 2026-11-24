# Site settings

A site is one website that hosts a comment section. One Ecoku instance can have several sites, each with its own comments and settings.

## Admin console overview

The admin console is at `https://ecoku.example.com/admin/`. It has a single administrator account that manages all sites.

| Page | Scope | Purpose |
| --- | --- | --- |
| Comments | Current site | [View and delete comments](./comments) |
| Sites | Current site | Add and edit sites (this page) |
| Notifications | Whole instance | [Email and Telegram](./notifications) |
| Security | Whole instance | [CAPTCHA](./captcha) |

With several sites, click the site name at the top left to switch. After you sign in, the session lasts 8 hours; when it expires, sign in again.

::: details Can't sign in?
- You must open the admin console over HTTPS (except on `localhost` and `127.0.0.1`).
- The origin in the address bar must exactly match `notifications.instance_public_url`, including the port. If `admin.allowed_origins` is set, it takes precedence.
- If you forgot the password, use [admin reset-password](../reference/cli#admin-reset-password). If CAPTCHA is broken, use [captcha disable](./captcha#disable).
:::

## Add a site {#sites}

On the **Sites** page, click **New site**. Only three fields are required:

| Field | What to enter |
| --- | --- |
| Site ID | The `data-site-id` in the embed code, such as `blog`. Starts with a letter or digit and may contain `.`, `_` and `-`, up to 100 characters. **It can't be changed after creation.** |
| Site URL | The website address, such as `https://blog.example.com`. Post links in notifications and the admin console = site URL + page key. |
| Allowed origins | Website origins allowed to load the comment section; see [below](#origins). |

All other fields have defaults and can be changed at any time:

| Field | Default | Notes |
| --- | --- | --- |
| Site name | Domain of the site URL | Shown in the admin console and notifications, up to 120 characters |
| Comment language | 简体中文 | Can also be 繁體中文 or English. The embed code can override it. |
| Comment order | Newest | The default order when a visitor opens the comment section; visitors can switch it |
| Visitor email | Required | Can be made optional |
| Visitor website | Optional | Can be made required. The name is always required. |
| Comment placeholder | 「写下评论（仅支持纯文本）」 ("Write a plain-text comment") | 1 to 80 characters |
| Comment limit | 1000 | 1 to 10000 characters; one CJK character counts as one |
| Empty-state message | Two lines: 「还没有评论」 ("No comments yet") and 「成为第一个留下评论的人。」 ("Be the first to comment.") | 1 to 240 characters; may contain line breaks |
| Stickers | Off | See [Smoji stickers](../integration/smoji) |

After saving, use the site ID to [embed the comment section](../integration/html).

## Allowed origins {#origins}

An origin is `scheme://domain[:port]`, without a path. If the origin of the page hosting the comment section is not on the list, the browser is refused both when reading and when submitting comments.

- `https://blog.example.com` and `https://www.blog.example.com` are two origins. List every domain your blog can be reached on.
- When previewing your blog locally, add addresses such as `http://localhost:1313` too.
- You can't list the admin console's own origin. The admin console and your blog must use different domains; see [Applying configuration and origin checks](../reference/configuration#reload) for why.

You can paste several origins at once, one per line or separated by commas, up to 32.

## Site URL and page paths {#site-url}

If your blog is deployed in a subdirectory and the page key already includes that subdirectory, don't include it in the site URL again.

| Page key | Site URL | Resulting link |
| --- | --- | --- |
| `/blog/posts/hello/` | `https://example.com` | `https://example.com/blog/posts/hello/` ✓ |
| `/blog/posts/hello/` | `https://example.com/blog` | `https://example.com/blog/blog/posts/hello/` ✗ |

## Blogger identity

After you set the blogger name, email and passphrase for a site, you can post as the blogger in its comment section; see [Blogger identity](./blogger).
