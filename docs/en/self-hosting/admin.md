# Admin console

The admin console lives at `https://ecoku.example.com/admin/`. You use it to register sites, handle comments, and configure notifications and CAPTCHA. An instance has a single admin account that manages all sites.

## Sign in

A new instance prints a temporary password for `admin` in its first-start log. Set a permanent password on first sign-in; you may keep the username `admin`. Existing instances use their persistent account. For internal test credential migration see [legacy configuration](./upgrade#legacy-config). When enabled, CAPTCHA also appears on the sign-in page.

Sign-in is rejected unless both of these hold:

- You are connecting over HTTPS. Only loopback addresses such as `localhost` and `127.0.0.1` may use HTTP, for local development.
- The origin in the browser's address bar matches `notifications.instance_public_url` in `app/config.yaml`; if you also set `admin.allowed_origins`, that list is used instead.

After you sign in, the session lasts a fixed 8 hours. Reloading the page or closing and reopening the browser does not require signing in again, but activity does not extend those 8 hours either. When the session expires, the page asks you to sign in again. 「退出登录」 (Sign out) ends the current session on the server. If the sign-out request fails, the page stays open and asks you to try again; it does not pretend you are signed out.

Session credentials use an HttpOnly cookie scoped to `/api/admin`, inaccessible to page scripts. If you forget the password, use [admin reset-password](../reference/cli#admin-reset-password), which revokes old sessions. Do not edit or delete persistent key files to reset a password.

If a CAPTCHA misconfiguration keeps you from signing in, see [CAPTCHA](./captcha#disable).

## Layout

The console language is set by `ECOKU_ADMIN_LOCALE`; see [Time zone and admin language](./docker#timezone). This documentation quotes button and field names from the default Simplified Chinese interface, followed by the English interface label in parentheses.

The top navigation has four pages: 「评论」 (Comments), 「站点」 (Sites), 「通知」 (Notifications) and 「安全」 (Security). On narrow screens, navigation moves to the bottom.

- **评论** (Comments): view and delete comments for the current site.
- **站点** (Sites): add and edit sites.
- **通知** (Notifications): email and Telegram notifications for the whole instance.
- **安全** (Security): CAPTCHA for the whole instance.

「评论」 and 「站点」 show the current site at the top left. Click its name to switch when there are multiple sites; a single site is shown as a static name. 「通知」 and 「安全」 apply to the whole instance.

The save bar appears at the bottom after you change settings. 「撤销修改」 (Undo changes) restores the saved values. Before switching pages or sites or signing out, the console asks whether to discard unsaved changes.

If saving fails, your inputs remain so you can correct them and retry. Notification and security forms cannot be edited before their settings load. Use 「重试」 (Retry) beside the error message, then edit after loading succeeds.

## Register a site {#sites}

A "site" is one website that embeds the comment section. On 「站点」 (Sites), click 「新增站点」 (New site) and fill in:

| Field | Description |
| --- | --- |
| Site ID (站点 ID) | The `data-site-id` in the embed code. Starts with a letter or digit and may contain letters, digits, `.`, `_`, and `-`, up to 100 characters. **It cannot be changed after the site is created.** |
| Site URL (站点 URL) | The canonical address of the website, such as `https://blog.example.com`. Notification emails and the admin console's 「查看原评论」 (View original comment) build post links from it plus the page path. |
| Site name (站点名称) | Shown in the admin console and in notification emails, up to 120 characters. If empty, the domain of the site URL is used. |
| Allowed origins (允许来源) | Origins that may load this site's comment section, one input per origin, up to 32. See below. |
| Comment language (评论区语言) | The interface language visitors see in the comment section: 简体中文 (the default), 繁體中文 or English. The [`data-i18n`](../integration/html) attribute or the [SDK](../integration/sdk) `i18n` option in your embed code overrides it. |
| Comment order (评论排序) | The default order when a visitor opens the comment section: newest or oldest first. Visitors can switch it temporarily. |
| Visitor email (访客邮箱) | Whether a visitor's email is required (必填, the default) or optional (选填). |
| Visitor website (访客网站) | Whether a visitor's website is required (必填) or optional (选填, the default). Nickname is always required. |
| Comment placeholder (评论占位文案) | The hint text in the comment box, 1 to 80 characters. The default is 写下评论（仅支持纯文本）; when the comment language is English, visitors see "Write a plain-text comment" instead. |
| Comment limit (评论长度上限) | Maximum number of characters in a comment body, 1 to 10000, default 1000. Counted in Unicode characters, so one CJK character or kana counts as one. |
| Empty-state message (无评论文案) | Text shown when there are no comments yet, 1 to 240 characters. It may contain line breaks. |

### Allowed origins

An "origin" is `scheme://domain[:port]`, without a path. The origin of the page that hosts the comment section must be listed here. Otherwise the browser is refused both when reading and when submitting comments.

- `https://blog.example.com` and `https://www.blog.example.com` are two different origins. If your blog is reachable on both domains, list both.
- When you preview your blog locally, add addresses such as `http://localhost:1313` too. You can remove them after you go live.
- You cannot list the admin console's own origin (the address of `instance_public_url`, or of `admin.allowed_origins` if you set it). The two must be kept separate.

Press Enter in an input to add the next one; press Backspace in an empty input to remove it. Pasting several lines, or several origins separated by commas, splits them into separate items. After you leave an item that lacks a scheme or includes a path, a note appears under it with a "Change to …" (改为 …) button that replaces it with the correct origin. Duplicate origins are merged when you save.

If someone edited the same site in another browser tab while you were editing it, the save is refused and the console shows 「数据已经被其他请求修改，请刷新后重试。」 ("The data was changed by another request. Refresh and try again."). Reload and edit again.

### Sticker packs

Set 「表情包」 (Stickers) to 「启用」 (On) and enter the Smoji manifest URL; the comment box then shows a 「表情」 (Sticker) button. 「图片来源」 (Image origin) is optional: enter the CDN origin when images are hosted separately, or leave it empty to preserve the manifest-origin rule. Resource hosts serve files directly and can see visitor IP addresses. See [host the Smoji manifest and images](../integration/smoji#hosting) for exact values.

### Blogger identity {#blogger}

After you fill in the blogger nickname, blogger email, and blogger passphrase, you can post as the blogger in your own blog's comment section: type the passphrase in the **nickname field**, leave email and website empty, and post. When the server recognizes the passphrase, it replaces the comment's nickname with the blogger nickname and the website with the site URL, and shows the blogger badge after the nickname (`[博主]` by default).

| Field | Description |
| --- | --- |
| Blogger name (博主昵称) | The publicly shown name, up to 80 characters. |
| Blogger email (博主邮箱) | Not public. Stored as the private email of blogger comments. During a Twikoo import it is used together with the nickname to recognize past blogger comments. Blogger notifications go to the recipients set on 「通知」 (Notifications), not to this address. |
| Blogger passphrase (博主口令) | 12 to 80 characters, no more than 72 bytes in UTF-8, no line breaks. Only a bcrypt hash is stored, and it is never shown again after saving. When one is already set, leaving the field empty keeps it unchanged. |
| Comment badge (评论区标志) | Text shown after the blogger nickname, up to 16 characters. If empty, no badge is shown. |

Fill in both the nickname and the email, or leave both empty. When both are filled in, a passphrase is required. Clearing the nickname and email turns off the blogger identity and also clears the passphrase.

::: warning If you mistype the passphrase
When the passphrase does not match, the text in the nickname field is just an ordinary nickname. If the site makes email optional, the comment is published with the passphrase text as its nickname. If that happens, delete it on 「评论」 (Comments) and change the passphrase.
:::

Setting or changing the passphrase does not change the blogger mark on existing comments. See [How it works](../guide/concepts#blogger) for the backfill rules.

## Manage comments

「评论」 (Comments) has 「已发布」 (Published) and 「已删除」 (Deleted) lists with 20 items per page. Choose 「最新在前」 (Newest first) or 「最早在前」 (Oldest first). Comments are grouped by date and show their body, time, post title and page key directly, together with any private email and visitor website. A reply quotes its parent when that parent is on the current page; click the quote to jump to it. Otherwise, the parent ID is shown.

Tombstone and permanent deletion are confirmed beside the relevant comment.

「查看原评论」 (View original comment) opens the post in a new tab, scrolled to this comment (`site URL + page key + #ecoku-comment-<comment ID>`).

### Tombstone delete

「墓碑删除」 (Tombstone delete) clears the comment's nickname, email, website, and body, but keeps its position in the discussion. On public pages it shows as 「已删除」 and 「[该评论已删除]」 (in English: "Deleted" and "[Comment deleted]"). Its replies stay as they are, and nobody can reply to it anymore. This cannot be undone. For what happens to notifications that are pending or already sent, see [After a comment is deleted](./notifications#after-deletion).

### Permanent delete

In the 「已删除」 (Deleted) list, a tombstone with **no replies at all** can be removed from the database with 「彻底删除」 (Delete permanently). A tombstone that still has replies cannot be permanently deleted, so the replies do not lose their context; the comment shows 仍有回复，不能彻底删除 (it still has replies and cannot be permanently deleted).

## Notifications and CAPTCHA

- [Notifications](./notifications): set up SMTP email and a Telegram bot to notify the blogger of new comments, and to email visitors when someone replies to them.
- [CAPTCHA](./captcha): choose between off, Cloudflare Turnstile, and self-hosted Cap. It protects both comment submission and admin sign-in.
