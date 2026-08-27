# Features

## Comments

- Plain text; published immediately on submit; no moderation queue.
- Replies are written under the comment being replied to; nesting is unlimited in the data layer, with UI indent capped at three levels.
- Root comments are paginated; each page includes all public replies for those root comments.
- Sort by newest or oldest.
- Deletion keeps a placeholder (tombstone) so threads stay intact; tombstones cannot be replied to.
- Sites may enable Smoji stickers; the picker loads a same-origin manifest on demand and stores selections as plain-text markers.

## Identity and privacy

- Nickname is required; whether email and website are required is per-site (defaults: email required, website optional).
- Visitor identity is encrypted in browser IndexedDB for 7 days; it is not written to localStorage, cookies, or the URL.
- Public APIs never return email, IP, User-Agent, region, or secrets.

## Admin and notifications

- `/admin/` configures sites, comments, blogger identity, notifications, and bot protection.
- Bloggers match on nickname and email together and can show a blogger badge; when enabled, a passphrase proves identity.
- Notifications support SMTP and Telegram; rules and channels are described in [Admin setup](/en/self-hosting/admin#notifications).
- Bot protection is instance-wide: off, Turnstile, or self-hosted Cap; when enabled it protects both comment submit and admin login.

## Data and integration

- SQLite only; multi-site; schema migrates in place, in order.
- Assets: `/client/ecoku-loader.js`, `/client/ecoku.umd.js`, `/client/ecoku.css`, `/client/ecoku.unstyled.css`.
- Integration needs the service URL, site ID, a stable page key, and an optional page title. See [Plain HTML](/en/integration/html).
