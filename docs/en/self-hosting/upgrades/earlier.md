# Earlier candidates

Old `compose.yaml` files may still pin these tags. Always: cold backup → exact tag → `pull && up -d`. Cross-schema rollback needs the backup.

## v0.1.0-rc.10 / rc.9 / rc.8

rc.8 writes schema **v3 + v4** (blogger badge, `turnstile_settings`). rc.9 fixes Turnstile `api.js` vs `turnstile.ready()` so the login widget appears. Add `TZ='<IANA>'` to `ecoku.env` and recreate the container; do not put it in `config.yaml`. A v3/v4 database cannot run on rc.7.

## v0.1.0-rc.7

Markup moves to `data-ecoku-*` with ids `ecoku-comments` / `ecoku-mount`. The loader still accepts `#tcomment` temporarily. Schema stays v2. Deploy the blog partial after this image is live.

## v0.1.0-rc.6

Logs always go to stdout. `log_path` still keeps an in-process file copy. Schema stays v2.

## v0.1.0-rc.5

Schema **v1 → v2**: blogger nickname and email on sites. SDK stores encrypted identity in IndexedDB for 7 days. Admin no longer shows a notification decision preview.

## v0.1.0-rc.3

Host layout becomes `app/config.yaml`, `app/logs/`, `data/`. WAL is enabled. From rc.2, move `config.yaml` to `app/config.yaml` and `data/ecoku.log` to `app/logs/ecoku.log`. SIGTERM checkpoints WAL after stopping HTTP and the notification worker.

Git has a `v0.1.0-rc.4` tag without a CHANGELOG section.

## v0.1.0-rc.2 / rc.1

rc.2 ships `/client/ecoku-loader.js` and `hash-password`. rc.1 is the first CI candidate: multi-site comments, admin, notifications, Twikoo import.
