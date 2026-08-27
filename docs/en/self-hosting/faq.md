# FAQ

## `/api/health` is fine, but pages do not load

Health only means the process can respond. Confirm the reverse proxy forwards `/`, `/api/`, `/admin/`, and `/client/`:

```bash
sudo docker compose ps
sudo docker compose logs --tail=200 ecoku
```

See [Reverse proxy](./reverse-proxy).

## All visitors share one rate-limit bucket

Common when `trusted_proxies: []`, or when the proxy **appends** instead of overwriting `X-Forwarded-For`. Configure the Docker gateway `/32` as in [Reverse proxy](./reverse-proxy#client-address-and-rate-limits); do not use `0.0.0.0/0`, `::/0`, or CDN ranges.

## CORS errors

Put the comment page’s full Origin in the site Allowed origins; put the admin page Origin in admin settings. Protocol, domain, and port must match exactly—no path, no `*`.

## Administrator cannot sign in

Check username, bcrypt hash, `ECOKU_ADMIN_TOKEN_KEY`, and admin Allowed origins. If bot protection is blocking you, see [Recover login](./admin#recover-login-when-verification-blocks-you).

## Turnstile or Cap verification fails

Confirm the instance can reach the verification service, keys are a matching pair, CORS includes the needed Origins, and the browser can load the Widget / WASM / Siteverify. Tokens are single-use; failed attempts need a new solve.

## After upgrade: unsupported database version

Do not delete the database or edit `schema_migrations` by hand. Keep the backup and compare the image–schema table in [Upgrade](./upgrade). Only ordered in-place upgrades are supported; there are no downgrade migrations.

## How to change the timezone

Set `TZ` in `ecoku.env` to an IANA name (for example `Asia/Singapore`), then:

```bash
sudo docker compose up -d --force-recreate
```

## Strict CSP blocks the verification widget

Turnstile needs Cloudflare Origins; Cap needs the instance Origin, WASM, and Blob Worker; instrumentation may also need `'unsafe-eval'`. See [Bot protection](./admin#bot-protection).
