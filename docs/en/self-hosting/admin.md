# Admin Console

The management interface is located at `/admin/`.

---

## 1. Authentication & In-Memory Session
- **Credentials**: `ECOKU_ADMIN_USERNAME` and password from `ecoku.env`.
- **In-Memory Bearer Token**: Stored strictly in JavaScript memory during runtime. Never written to `localStorage`, `sessionStorage`, or cookies. Refreshing the browser or closing the tab immediately terminates the session.
- **Session Duration**: Defaults to 8 hours (480 minutes).

---

## 2. Multi-Site Management
- **Site ID**: Unique immutable identifier used by client SDKs.
- **Canonical URL**: Base URL used to assemble comment links in emails and admin views.
- **Allowed Origins**: Strict list of `https://` origins allowed to make CORS requests.
- **Form Controls**: Configure mandatory email/website fields, placeholder text, character limits (1~10,000), and empty state text.
- **Smoji Stickers**: Enable Smoji support and provide a remote HTTPS `smoji.json` manifest URL.

---

## 3. Blogger Identity & Passphrases
- Configure blogger nickname, private email, and an optional public badge (`[Blogger]`).
- Set a secret 12~80 character passphrase.
- In the public comment form, entering the passphrase into the Nickname field authenticates the blogger without exposing their email.

---

## 4. Comment Moderation
- **Tombstone Soft-Delete**: Erases author name, email, website, and raw body while preserving comment IDs and discussion threads.
- **Hard Purge**: Only allowed on isolated tombstones with zero descendant replies.

---

## 5. Bot Protection (CAPTCHA)
- Tri-state toggle: **Off**, **Cloudflare Turnstile**, or **Self-hosted Cap**.
- Secrets are encrypted with AES-256-GCM and never echoed back in plaintext.

---

## 6. Emergency Recovery (CLI)

If misconfigured CAPTCHA locks you out of the admin panel:

```bash
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```
