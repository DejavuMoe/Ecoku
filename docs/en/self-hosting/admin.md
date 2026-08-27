# Admin setup

Open `/admin/` on the instance and sign in with `ECOKU_ADMIN_USERNAME` and the matching password. The admin Bearer token lives only in page memory; closing or refreshing requires signing in again.

`admin.allowed_origins` is separate from comment-site origins; one broad origin cannot stand in for both.

## Sites

| Setting | Notes |
| --- | --- |
| ID | Unique value used for integration; cannot change after creation |
| Site URL, name | Identify the site and build notification links |
| Allowed origins | Exact Origins allowed to call the comment API (full `https://domain`, no path) |
| Email, website | Whether visitor fields are **required** (fields still show) |
| Placeholders, length limits, empty state, sort | Form and list behavior |

Comments publish immediately on submit; there is no moderation queue.

### Stickers

Each site may enable stickers and provide one `smoji.json` manifest URL. Production URLs must use HTTPS, and every image must share the manifest's origin. Ecoku neither bundles nor proxies these resources; the browser loads them only when a visitor first opens the picker. Direct image requests can expose a visitor's IP address to the resource host, so use a host you trust. Disabling the feature retains the URL and shows historical markers as plain text.

A management key (if declared in YAML) is only for trusted server-side tombstone deletion on that site—not browser integration. See [Docker](./docker#configuration).

## Blogger identity

Nickname and email must both be filled or both left empty. When enabled, also set a 12–80 character passphrase; saving backfills the blogger badge on historical comments matching that identity. Public badge text is configurable.

On the public form: when a passphrase is enabled, bloggers enter only the passphrase in the nickname field—no email or website needed. If the passphrase is wrong and visitor identity is also filled in, the comment posts as a normal visitor.

## Notifications

Instance-level SMTP (TLS / STARTTLS only) and Telegram. Credentials are encrypted into SQLite with `ECOKU_NOTIFICATION_ENCRYPTION_KEY`; the admin UI only shows “configured” and does not offer decision tables or template previews. Set `notifications.instance_public_url` before enabling a channel.

Default rules (based on stored `is_blogger`):

| Scenario | Behavior |
| --- | --- |
| Visitor posts a root comment | Notify blogger channels |
| Visitor replies to visitor | Notify blogger channels, and email the direct parent |
| Blogger replies to visitor | Email the direct parent only |
| Visitor replies to blogger | Notify blogger channels only |
| Blogger replies to blogger | No notification |
| Same email replies to self | No visitor-reply email |

## Bot protection

On the Security page choose off, Cloudflare Turnstile, or self-hosted Cap (one of three). When enabled it protects both comment submit and admin login; failure rejects the request and does not fall back to another provider. Switching providers does not delete stored settings for the unused provider.

### Turnstile

Create a Widget in Cloudflare and enter the Site key and Secret key. Pre-clearance requires the site to be proxied through Cloudflare; `cf_clearance` does not replace Ecoku Siteverify.

### Cap

Create a key in Cap Standalone and add the admin Origin plus every comment-site Origin to that Key’s CORS. The instance must serve `/assets/widget.js`, `/assets/cap_wasm_bg.wasm`, and `/<sitekey>/siteverify` over public HTTPS. In Ecoku enter the instance URL, Site key, and Secret key.

Admin CSP tightens to the current provider: Turnstile allows Cloudflare; Cap allows the instance Origin, WASM, and Blob Worker; Cap instrumentation may also need `'unsafe-eval'`. If that is unacceptable, disable instrumentation or switch to Turnstile.

## Recover login when verification blocks you

```bash
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku captcha status
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```

Sign in, fix verification settings, then re-enable in the admin UI.
