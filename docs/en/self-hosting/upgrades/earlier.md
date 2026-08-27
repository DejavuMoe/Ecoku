# Earlier candidates

These tags may still appear in Compose on older instances. Upgrade steps always follow [Upgrade](../upgrade). Cross-schema rollback must restore a backup.

## v0.1.0-rc.10 / rc.9 / rc.8

Schema through rc.8 writes **v3 + v4** (blogger flag, `turnstile_settings`). rc.9 fixes Turnstile `api.js` vs `turnstile.ready()` conflicts. rc.10 adjusts comment copy and layout.

After adding `TZ='<IANA>'` to `ecoku.env`, recreate the container with the current Compose `env_file`; no `config.yaml` change is required. Upgrading from rc.7 to rc.8 requires a backup; a database already at v3/v4 cannot roll back to rc.7 by tag alone.

## v0.1.0-rc.7

Integration switches to `data-ecoku-*`; shell ids are `ecoku-comments` / `ecoku-mount`. The loader still briefly recognizes legacy `#tcomment`. Schema remains v2.

## v0.1.0-rc.6

Logs always go to stdout; when `log_path` points at a file, an in-process copy is kept as well. Schema remains v2.

## v0.1.0-rc.5

Schema **v1 → v2**: sites gain blogger nickname and email. The SDK encrypts identity in IndexedDB for 7 days. The admin UI does not show notification decision previews.

## v0.1.0-rc.3

Host layout converges on `app/config.yaml`, `app/logs/`, and `data/`. SQLite enables WAL. Upgrading from rc.2 requires moving `config.yaml` to `app/config.yaml` and old `data/ecoku.log` to `app/logs/ecoku.log`.

## v0.1.0-rc.2 / rc.1

From rc.2 the container ships `/client/ecoku-loader.js` and `hash-password`. rc.1 provides multi-site plain-text comments, admin, notifications, and Twikoo import.
