# Features

This page lists the features of the current Ecoku release (v0.3.7), grouped by who uses them. The link after each item points to the details.

## Visitors

- Post without registering by entering a nickname, email address, and optional website. Each site decides whether the email address and website are required. [Visitor identity](./concepts#visitor-identity)
- Reply directly under any comment. The reply box opens in place, and any missing identity fields are filled in inside that reply box.
- The browser remembers the visitor's identity, encrypted, for 7 days. No cookies are used.
- Preview before posting. Length is counted in Unicode characters, so one CJK character counts as one.
- Switch between newest-first and oldest-first order.
- Collapse long discussion branches.
- Insert Smoji stickers when the site has a sticker pack enabled. [Smoji sticker packs](../integration/smoji)

## Blogger

- Enter the passphrase in the nickname field of the comment section to post as the blogger, with a blogger badge. [Blogger identity](./concepts#blogger)
- Get new comments and new replies by email or Telegram. [Notifications](../self-hosting/notifications)
- When a visitor gets a reply, they are notified by email automatically.

## Admins

- Register multiple sites on one instance, each with its own allowed origins, default sort order, required fields, length limit, and placeholder text. [Admin console](../self-hosting/admin#sites)
- Browse comments by status, Published (已发布) or Deleted (已删除), and jump to the comment on the original page with one click.
- Tombstone delete keeps the structure of the discussion. A tombstone with no replies can be permanently deleted. [Deletion](./concepts#deletion)
- Switch between three CAPTCHA modes (off, Cloudflare Turnstile, and self-hosted Cap). CAPTCHA protects both commenting and admin sign-in. [CAPTCHA](../self-hosting/captcha)
- Import existing comments from Twikoo. [Migrate from Twikoo](../self-hosting/twikoo)

## Integration

- Embed with a snippet of HTML and one script. Works on any static site. [HTML integration](../integration/html)
- In single-page apps built with Vue, React, and similar frameworks, the comment section follows along when the reader switches posts. [JavaScript SDK](../integration/sdk)
- Ready-made templates for the Hugo PaperMod theme. [Hugo PaperMod](../integration/hugo)
- Adjust colors, corner radius, and font size of the default styles with CSS variables, or use only the structural styles, or write your own from scratch. [Custom styles](../integration/custom-css)
- Follows the page's light and dark mode.

## Operations

- A single Docker container that runs as non-root on a read-only file system. [Docker deployment](../self-hosting/docker)
- Stop the service and back up the data directory, persistent keys and configuration. [Backup and restore](../self-hosting/backup)
- The database is migrated automatically on upgrade, and existing data stays in place. [Upgrade](../self-hosting/upgrade)
- Per-IP rate limits, with support for running behind a reverse proxy or CDN. [Reverse proxy](../self-hosting/reverse-proxy)
- Notifications are sent asynchronously through a database queue, with automatic retries on failure, and never hold up comment submission.

## Privacy

- Visitor IP addresses, User-Agents, and geolocation are not stored. [Data stored and made public](./concepts#data)
- Email addresses never appear in any public API.
- SMTP passwords, bot tokens, and CAPTCHA secrets are encrypted before they are stored in the database. The admin console only shows them as Set (已设置).
- The comment section does not call any third-party avatar, analytics, or IP lookup service.
