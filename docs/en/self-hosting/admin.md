# Admin setup

Open `https://comments.example.com/admin/` with the account created at init. The token lives in page memory only; refresh requires login. Admin origins and public comment origins are separate allowlists.

## Sites

| Field | Notes |
| --- | --- |
| Site ID | Stable, short; immutable after create |
| Site URL | e.g. `https://blog.example.com`; notification permalinks are built from this plus the page key |
| Name | Falls back to the URL host if empty |
| Allowed origins | One full Origin per line |
| Default sort | `newest` or `oldest` |
| Email / website | Required flags; email required, website optional by default |
| Placeholder | Up to 80 characters |
| Body limit | 1–10000 Unicode code points, default 1000 |
| Empty copy | Shown as plain text under the form |

Comments go public on submit. A site management key is only for trusted server automation to tombstone-delete that site’s comments; new sites do not get a key in the UI. List/detail GETs with that key return 403.

## Blogger

Nickname and email must both be set or both empty. Enabling them requires a passphrase (12–80 chars). Only a bcrypt hash is stored.

On the public form, put the passphrase in the nickname field. The server rewrites nickname, private email, and website to the site URL. A wrong passphrase with a full guest identity publishes as a guest.

Saving the passphrase backfills unpublished-history `is_blogger` rows by exact nickname and case-insensitive email.

## Notifications

Instance-wide. SMTP blogger mail, guest-reply mail, and Telegram. Test sends have their own rate limit. SMTP allows `tls` or `starttls` only. Secrets use `ECOKU_NOTIFICATION_ENCRYPTION_KEY`. The UI does not show a decision table or template preview. Matrix: [Features](/en/guide/features#notifications).

## Bot protection

Security page: off / Turnstile / Cap. Only one provider when enabled; both comment submit and admin login are covered. Switching does not wipe the other provider’s saved settings. Failures close; no auto-fallback.

### Turnstile

1. Create a widget; add the admin host and every comment-site hostname.
2. Choose Turnstile in admin; save Sitekey and Secret.
3. Widget mode is configured only in Cloudflare.

Pre-clearance is also Cloudflare-only. Disable it when the site is not behind Cloudflare proxying, or the console shows `aborting clearance redemption`.

### Cap

Cap’s `ADMIN_KEY` is for Cap’s own admin, not Ecoku.

1. Create a Key; keep instrumentation on; allow the admin Origin and every comment-site Origin in that Key’s CORS.
2. Public HTTPS instance with versioned `/assets/widget.js` and `/assets/cap_wasm_bg.wasm`.
3. Choose Cap; enter instance root, Site key, Secret. HTTPS only — no credentials, query, fragment, localhost, or private IPs.
4. Verify login and posting in a separate window. Tokens are single-use.

From `v0.1.6`, admin CSP adds `'unsafe-eval'` for that exact Cap origin only while Cap is the active provider.

If instrumentation returns `instr_timeout` and `/redeem` is 429, check that the response CSP comes from the current image. Do not work around it with a second loose CSP on Caddy.

Sites on the image-hosted loader pick up Cap automatically. Pinned old npm/UMD clients must be updated to `formConfig.captcha` / `captchaToken` first.

Host CSP notes: [FAQ](/en/self-hosting/faq#host-csp).

## Recover admin login

When the current provider is down:

```bash
set -euo pipefail
cd ~/Ecoku

sudo docker compose down
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm

umask 077
mkdir -p ./backups
backup_stamp="$(date +%Y%m%d-%H%M%S)"
sudo cp --reflink=auto --preserve=mode,timestamps \
  ./data/ecoku.sqlite3 "./backups/ecoku-before-captcha-disable-${backup_stamp}.sqlite3"
sudo chown "$USER":"$USER" "./backups/ecoku-before-captcha-disable-${backup_stamp}.sqlite3"
chmod 600 "./backups/ecoku-before-captcha-disable-${backup_stamp}.sqlite3"

sudo docker compose run --rm --no-deps ecoku captcha status
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```

Log in with CAPTCHA off, then repair or switch the provider. Use the current image tag and the same `./data`. Do not hand-edit the settings table.

## Timezone

`TZ` belongs only in `ecoku.env`. Recreate the container after changing it:

```bash
printf "\nTZ='Asia/Singapore'\n" >> ecoku.env
sudo chmod 0600 ./ecoku.env
sudo docker compose up -d
```

Hover text looks like `Asia/Singapore UTC+8`. Images at `v0.1.0-rc.7` and older ignore this format.
