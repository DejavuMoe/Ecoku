# FAQ

## Container unhealthy or restart loop

`sudo docker compose logs --tail=200 ecoku`. Typical causes: failed migration, config validation, missing admin static files. Compare [Upgrades](/en/self-hosting/upgrades/) and `CHANGELOG.md`.

## Unknown schema / checksum mismatch

An old image opened a newer database, or `schema_migrations` was edited. Stop and restore the pre-upgrade backup. Do not roll back the image alone.

## Everyone shares one rate-limit bucket

Empty `trusted_proxies`, or the proxy **appends** `X-Forwarded-For` instead of overwriting it. Use topology 1 in [Reverse proxy](/en/self-hosting/reverse-proxy). Never set `0.0.0.0/0`.

## CORS rejects comment submit

The page Origin is missing from the site’s `allowed_origins`. Admin origins and public origins are separate.

## Turnstile login or comment fails

Check the Security page, Sitekey/Secret, and `ECOKU_NOTIFICATION_ENCRYPTION_KEY`. Failed Siteverify does not fall back.

## Cap login or comment fails

Check Cap health, Key CORS, `/assets/widget.js`, WASM, and Siteverify. Spent tokens must be solved again. If you cannot log in, run `captcha disable` as in [Admin](/en/self-hosting/admin#recover-admin-login).

`instr_timeout` plus `/redeem` 429: confirm the admin CSP comes from the current image (`'unsafe-eval'` only in Cap mode from `v0.1.6`). Do not add a second loose CSP on Caddy.

## Console: aborting clearance redemption

Cloudflare Pre-clearance is on, but the site is not proxied by Cloudflare. Turn it off; the widget can still Siteverify.

## Restore from backup still broken

The backup was taken with WAL/SHM present, or only the main file was copied. Stop and confirm sidecars are gone first.

## Wrong comment timestamps

Missing `TZ`, or `ecoku.env` was edited without recreating the container. Write an IANA name and `docker compose up -d`. Unset falls back to `Asia/Shanghai`.

## Blogger badge missing

History was not backfilled. Save the blogger passphrase again; nickname and email must match historical comments.

## Management key can delete but not list

By design: that key only tombstone-deletes its site. Use the admin session for list/detail.

## Host CSP {#host-csp}

Turnstile: allow `https://challenges.cloudflare.com` in `script-src`, `frame-src`, and `connect-src`.

Cap: add the instance Origin to `script-src` and `connect-src`; `worker-src blob:`; `'wasm-unsafe-eval'`; and `'unsafe-eval'` if instrumentation is on. Do not substitute `*` or broad `unsafe-inline`.
