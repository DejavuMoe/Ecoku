# Features

## Comments

- Plain text, published on submit.
- Nested threads; visual indent caps at three levels. Public lists paginate by root thread; the current page includes every public descendant of those roots.
- Replies are composed under the parent. Missing identity is collected in that reply box, never as a mistaken root comment.
- Sort: site default `newest` or `oldest`; visitors can switch temporarily.
- Tombstones keep the nickname “已删除” and body “[该评论已删除]”; they cannot receive new replies.

## Identity

- Nickname is always required. Email and website required-ness is per site (email required, website optional by default).
- Saved identity is encrypted with a non-extractable AES-GCM key in the current origin’s IndexedDB, scoped by `serverURL + siteId`, and expires after 7 days. It is not written to localStorage, cookies, or the URL. There is no extra “forget me” control.
- Blogger: configure nickname, email, and passphrase in admin. On the public form, put the passphrase in the nickname field. The server rewrites it to the configured nickname, private email, and site URL. Badge defaults to `[博主]`; no avatar.

## Admin

- Single instance admin at `/admin/`. The token stays in page memory; a refresh requires login again.
- Site IDs cannot change after create. Configure allowed origins, sort, field rules, placeholder, Unicode limit (1–10000, default 1000), and empty-state text.
- Comment tools: filter published / tombstone, detail, tombstone delete; leaf tombstones can be purged.
- Bot protection is instance-wide: off, Cloudflare Turnstile, or self-hosted Cap. When on, it covers both comment submit and admin login. Failures reject the request; there is no automatic fallback.

## Notifications

| Author | Target | Delivery |
| --- | --- | --- |
| Guest | Root | Blogger SMTP / Telegram |
| Guest | Guest | Blogger channels + email to the parent |
| Guest | Blogger | Blogger channels once |
| Blogger | Root / blogger | None |
| Blogger | Guest | Email to the parent only |

A guest replying to themselves with the same email does not get a reply mail. SMTP allows `tls` or `starttls` only. Passwords and bot tokens are encrypted at rest; the UI only shows “已设置”.

## Data and privacy

- SQLite3 only. Migrations run in order, in-place, inside a transaction. Success appends a version row.
- Public DTOs omit email, IP, UA, geo, and secrets. IP is used in-process for rate limits only.
- `X-Forwarded-For` is untrusted by default. Per-visitor limits trust only the Docker gateway; the proxy must overwrite the header.

## Embed

The image serves `/client/ecoku-loader.js`, `/client/ecoku.umd.js`, `/client/ecoku.css`, and structural `/client/ecoku.unstyled.css`. Each page must supply the container, `serverURL`, `siteId`, and an in-site relative `pageKey`.
