# Admin console

The admin console lives at `https://ecoku.example.com/admin/`. You use it to register sites, handle comments, and configure notifications and CAPTCHA. An instance has a single admin account that manages all sites.

## Sign in

The username comes from `ECOKU_ADMIN_USERNAME` in `ecoku.env`, and the password is the one you entered when generating the password hash. If CAPTCHA is enabled, the sign-in page also shows the verification widget.

Sign-in is rejected unless both of these hold:

- You are connecting over HTTPS. Only loopback addresses such as `localhost` and `127.0.0.1` may use HTTP, for local development.
- The origin in the browser's address bar matches `notifications.instance_public_url` in `app/config.yaml`; if you also set `admin.allowed_origins`, that list is used instead.

After you sign in, the session lasts a fixed 8 hours. Reloading the page or closing and reopening the browser does not require signing in again, but activity does not extend those 8 hours either. When the session expires, the page asks you to sign in again. **Sign out** (退出登录) ends the current session on the server. If the sign-out request fails, the page stays open and asks you to try again; it does not pretend you are signed out.

The session credential is stored in an HttpOnly cookie that is sent only to `/api/admin`, so page scripts cannot read it. After you change the admin password or `ECOKU_ADMIN_TOKEN_KEY` and recreate the container, all old sessions stop working immediately.

If a CAPTCHA misconfiguration keeps you from signing in, see [CAPTCHA](./captcha#disable).

## Layout

The top navigation has four pages: 「评论」 (comments), 「站点」 (sites), 「通知」 (notifications), and 「安全」 (security). On narrow screens, navigation moves to the bottom.

- **评论** (comments): view and delete comments for the current site.
- **站点** (sites): add and edit sites.
- **通知** (notifications): email and Telegram notifications for the whole instance.
- **安全** (security): CAPTCHA for the whole instance.

「评论」 and 「站点」 show the current site at the top left. Click its name to switch when there are multiple sites; a single site is shown as a static name. 「通知」 and 「安全」 apply to the whole instance.

The save bar appears at the bottom after you change settings. 「撤销修改」 (discard changes) restores the saved values. Before switching pages or sites or logging out, the console asks whether to discard unsaved changes.

If saving fails, your inputs remain so you can correct them and retry. Notification and security forms cannot be edited before their settings load. Use 「重试」 (retry) beside the error message, then edit after loading succeeds.

## Register a site {#sites}

A "site" is one website that embeds the comment section. On **Sites** (站点), click **Add site** (新增站点) and fill in:

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
- You cannot list the admin console's own origin (the address of `instance_public_url`, or of `admin.allowed_origins` if you set it). The two must be kept separate.

If someone edited the same site in another browser tab while you were editing it, saving shows "Site configuration was updated by another session" (站点配置已被其他会话更新). Reload and edit again.

### Sticker packs

After you select 「启用」 (enable) under 「表情包」 (sticker packs) and enter a Smoji manifest URL, the comment box shows a **Stickers** (表情) button. The manifest URL must use HTTPS (except for loopback addresses). Sticker images are served to the visitor's browser directly by the server that hosts the manifest, and that server can see the visitor's IP address. See [Smoji sticker packs](../integration/smoji) for the manifest format and how to host one.

### Blogger identity {#blogger}

After you fill in the blogger nickname, blogger email, and blogger passphrase, you can post as the blogger in your own blog's comment section: type the passphrase in the **nickname field**, leave email and website empty, and post. When the server recognizes the passphrase, it replaces the comment's nickname with the blogger nickname and the website with the site URL, and shows the blogger badge after the nickname (`[博主]` by default).

| Field | Description |
| --- | --- |
| Blogger nickname (博主昵称) | The publicly shown name, up to 80 characters. |
| Blogger email (博主邮箱) | Not public. Stored as the private email of blogger comments. During a Twikoo import it is used together with the nickname to recognize past blogger comments. Blogger notifications go to the recipients set on **Notifications** (通知), not to this address. |
| Blogger passphrase (博主口令) | 12 to 80 characters, no more than 72 bytes in UTF-8, no line breaks. Only a bcrypt hash is stored, and it is never shown again after saving. When one is already set, leaving the field empty keeps it unchanged. |
| Badge text (评论区标志) | Text shown after the blogger nickname, up to 16 characters. If empty, no badge is shown. |

Fill in both the nickname and the email, or leave both empty. When both are filled in, a passphrase is required. Clearing the nickname and email turns off the blogger identity and also clears the passphrase.

::: warning If you mistype the passphrase
When the passphrase does not match, the text in the nickname field is just an ordinary nickname. If the site makes email optional, the comment is published with the passphrase text as its nickname. If that happens, delete it on **Comments** (评论) and change the passphrase.
:::

Setting or changing the passphrase does not change the blogger mark on existing comments. See [How it works](../guide/concepts#blogger) for the backfill rules.

## Manage comments

「评论」 (comments) has 「已发布」 (published) and 「已删除」 (deleted) lists with 20 items per page. Choose 「最新在前」 (newest first) or 「最早在前」 (oldest first). Comments are grouped by date and show their body, time, post title and page key directly, together with any private email and visitor website. A reply quotes its parent when that parent is on the current page; click the quote to jump to it. Otherwise, the parent ID is shown.

Tombstone and permanent deletion are confirmed beside the relevant comment. Outside input fields, J/K or the up/down arrows move between comments, O opens the original comment, Delete opens the deletion confirmation, Esc cancels it, and R refreshes the list. On settings pages with changes, Ctrl+S or ⌘+S saves.

**View original comment** (查看原评论) opens the post in a new tab, scrolled to this comment (`site URL + page key + #ecoku-comment-<comment ID>`).

### Tombstone delete

**Tombstone delete** (墓碑删除) clears the comment's nickname, email, website, and body, but keeps its position in the discussion. On public pages it shows as "Deleted" (已删除) and "[This comment has been deleted]" ([该评论已删除]). Its replies stay as they are, and nobody can reply to it anymore. This cannot be undone. For what happens to notifications that are pending or already sent, see [After a comment is deleted](./notifications#after-deletion).

### Permanent delete

In the **Deleted** (已删除) list, a tombstone with **no replies at all** can be removed from the database with **Permanent delete** (彻底删除). A tombstone that still has replies cannot be permanently deleted, so the replies do not lose their context; the comment shows 仍有回复，不能彻底删除 (it still has replies and cannot be permanently deleted).

## Notifications and CAPTCHA

- [Notifications](./notifications): set up SMTP email and a Telegram bot to notify the blogger of new comments, and to email visitors when someone replies to them.
- [CAPTCHA](./captcha): choose between off, Cloudflare Turnstile, and self-hosted Cap. It protects both comment submission and admin sign-in.
