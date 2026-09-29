# Admin console

The admin console lives at `https://ecoku.example.com/admin/`. You use it to register sites, handle comments, and configure notifications and CAPTCHA. An instance has a single admin account that manages all sites.

## Sign in

The username comes from `ECOKU_ADMIN_USERNAME` in `ecoku.env`, and the password is the one you entered when generating the password hash. If CAPTCHA is enabled, the sign-in page also shows the verification widget.

Sign-in is rejected unless both of these hold:

- You are connecting over HTTPS. Only loopback addresses such as `localhost` and `127.0.0.1` may use HTTP, for local development.
- The origin in the browser's address bar is listed in `admin.allowed_origins` in `app/config.yaml`.

After you sign in, the session lasts a fixed 8 hours. Reloading the page or closing and reopening the browser does not require signing in again, but activity does not extend those 8 hours either. When the session expires, the page asks you to sign in again. **Sign out** (退出登录) ends the current session on the server. If the sign-out request fails, the page stays open and asks you to try again; it does not pretend you are signed out.

The session credential is stored in an HttpOnly cookie that is sent only to `/api/admin`, so page scripts cannot read it. After you change the admin password or `ECOKU_ADMIN_TOKEN_KEY` and recreate the container, all old sessions stop working immediately.

If a CAPTCHA misconfiguration keeps you from signing in, see [CAPTCHA](./captcha#disable).

## Layout

There are four pages along the top:

- **Comments** (评论管理): view and delete comments for the current site.
- **Sites** (站点管理): add and edit sites.
- **Notifications** (通知设置): email and Telegram notifications, for the whole instance.
- **Security** (安全): CAPTCHA, for the whole instance.

The top-left corner of **Comments** (评论管理) shows the current site. If you have more than one site, click the site name to switch. **Notifications** (通知设置) and **Security** (安全) apply to the whole instance and do not change with the site.

## Register a site {#sites}

A "site" is one website that embeds the comment section. On **Sites** (站点管理), click **Add site** (新增站点) and fill in:

| Field | Description |
| --- | --- |
| Site ID (站点 ID) | The `data-site-id` in the embed code. Starts with a letter or digit and may contain letters, digits, `.`, `_`, and `-`, up to 100 characters. **It cannot be changed after the site is created.** |
| Site URL (站点 URL) | The canonical address of the website, such as `https://blog.example.com`. Notification emails and the admin console's **View original comment** (查看原评论) build post links from it plus the page path. |
| Site name (站点名称) | Shown in the admin console and in notification emails, up to 120 characters. If empty, the domain of the site URL is used. |
| Allowed origins (允许来源) | Origins that may load this site's comment section, one per line, up to 32. See below. |
| Comment order (评论排序) | The default order when a visitor opens the comment section: newest or oldest first. Visitors can switch it temporarily. |
| Field requirements (字段要求) | Whether email is required (required by default) and whether website is required (optional by default). Nickname is always required. |
| Comment placeholder (评论占位文案) | The hint text in the comment box, 1 to 80 characters. The default is "Write a comment (plain text only)" (写下评论（仅支持纯文本）). |
| Comment length limit (评论长度上限) | Maximum number of characters in a comment body, 1 to 10000, default 1000. Counted in Unicode characters, so one CJK character or kana counts as one. |
| Empty-state text (无评论文案) | Text shown when there are no comments yet, 1 to 240 characters. It may contain line breaks. |

### Allowed origins

An "origin" is `scheme://domain[:port]`, without a path. The origin of the page that hosts the comment section must be listed here. Otherwise the browser is refused both when reading and when submitting comments.

- `https://blog.example.com` and `https://www.blog.example.com` are two different origins. If your blog is reachable on both domains, list both.
- When you preview your blog locally, add addresses such as `http://localhost:1313` too. You can remove them after you go live.
- You cannot list the admin console's own origin (an address in `admin.allowed_origins`). The two must be kept separate.

If someone edited the same site in another browser tab while you were editing it, saving shows "Site configuration was updated by another session" (站点配置已被其他会话更新). Reload and edit again.

### Sticker packs

After you turn on the **Enable sticker pack** (启用表情包) switch and enter a Smoji manifest URL, the comment box shows a **Stickers** (表情) button. The manifest URL must use HTTPS (except for loopback addresses). Sticker images are served to the visitor's browser directly by the server that hosts the manifest, and that server can see the visitor's IP address. See [Smoji sticker packs](../integration/smoji) for the manifest format and how to host one.

### Blogger identity {#blogger}

After you fill in the blogger nickname, blogger email, and blogger passphrase, you can post as the blogger in your own blog's comment section: type the passphrase in the **nickname field**, leave email and website empty, and post. When the server recognizes the passphrase, it replaces the comment's nickname with the blogger nickname and the website with the site URL, and shows the blogger badge after the nickname (`[博主]` by default).

| Field | Description |
| --- | --- |
| Blogger nickname (博主昵称) | The publicly shown name, up to 80 characters. |
| Blogger email (博主邮箱) | Not public. Stored as the private email of blogger comments. During a Twikoo import it is used together with the nickname to recognize past blogger comments. Blogger notifications go to the recipients set on **Notifications** (通知设置), not to this address. |
| Blogger passphrase (博主口令) | 12 to 80 characters, no more than 72 bytes in UTF-8, no line breaks. Only a bcrypt hash is stored, and it is never shown again after saving. When one is already set, leaving the field empty keeps it unchanged. |
| Badge text (评论区标志) | Text shown after the blogger nickname, up to 16 characters. If empty, no badge is shown. |

Fill in both the nickname and the email, or leave both empty. When both are filled in, a passphrase is required. Clearing the nickname and email turns off the blogger identity and also clears the passphrase.

::: warning If you mistype the passphrase
When the passphrase does not match, the text in the nickname field is just an ordinary nickname. If the site makes email optional, the comment is published with the passphrase text as its nickname. If that happens, delete it on **Comments** (评论管理) and change the passphrase.
:::

Setting or changing the passphrase does not change the blogger mark on existing comments. See [How it works](../guide/concepts#blogger) for the backfill rules.

## Manage comments

**Comments** (评论管理) has two lists by status, **Published** (已发布) and **Deleted** (已删除), with 20 comments per page. You can switch between newest-first and oldest-first by submission time. Click a comment to see its details: private email, visitor website, post title, page key, submission time, and parent comment.

**View original comment** (查看原评论) opens the post in a new tab, scrolled to this comment (`site URL + page key + #ecoku-comment-<comment ID>`).

### Tombstone delete

**Tombstone delete** (墓碑删除) clears the comment's nickname, email, website, and body, but keeps its position in the discussion. On public pages it shows as "Deleted" (已删除) and "[This comment has been deleted]" ([该评论已删除]). Its replies stay as they are, and nobody can reply to it anymore. This cannot be undone. For what happens to notifications that are pending or already sent, see [After a comment is deleted](./notifications#after-deletion).

### Permanent delete

In the **Deleted** (已删除) list, a tombstone with **no replies at all** can be removed from the database with **Permanent delete** (彻底删除). A tombstone that still has replies cannot be permanently deleted, so the replies do not lose their context; its details show 仍有回复，不能彻底删除 (it still has replies and cannot be permanently deleted).

## Notifications and CAPTCHA

- [Notifications](./notifications): set up SMTP email and a Telegram bot to notify the blogger of new comments, and to email visitors when someone replies to them.
- [CAPTCHA](./captcha): choose between off, Cloudflare Turnstile, and self-hosted Cap. It protects both comment submission and admin sign-in.
