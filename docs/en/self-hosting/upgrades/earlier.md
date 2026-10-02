# Earlier release candidates

::: warning Internal test release — do not use
This page preserves the tag, changes and historical upgrade notes. Public deployments start at v0.3.0; old images are no longer supported for deployment. Use the [current deployment guide](../docker).
:::

`v0.1.0-rc.1` · [v0.1.0-rc.2](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.2) · [v0.1.0-rc.3](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.3) · [v0.1.0-rc.5](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.5) · [v0.1.0-rc.6](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.6) · [v0.1.0-rc.7](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.7) · [v0.1.0-rc.8](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.8) · [v0.1.0-rc.9](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.9) · [v0.1.0-rc.10](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.10)

## v0.1.0-rc.8 – rc.10

- rc.8 writes schema v3 and v4: the blogger badge on comments, and the `turnstile_settings` table.
- rc.9 fixes a conflict between Turnstile's `api.js` and `turnstile.ready()`.
- rc.10 adjusts the comment section's wording and layout.

The time zone is now read from `TZ='<IANA time zone>'` in `ecoku.env`. Add it and recreate the container; you do not need to change `config.yaml`.

You must back up before upgrading from rc.7 to rc.8. A database that has been written as v3/v4 cannot be switched straight back to rc.7.

## v0.1.0-rc.7

The embed code switches to `data-ecoku-*` attributes, and the wrapper IDs change to `ecoku-comments` / `ecoku-mount`. The loader still recognizes the old `#tcomment` for now. The schema is still v2.

## v0.1.0-rc.6

Logs always go to stdout. When `log_path` points to a file, a copy is also kept there. The schema is still v2.

## v0.1.0-rc.5

Schema v1 → v2: sites gain a blogger nickname and email. The SDK stores visitor identity encrypted in IndexedDB for 7 days.

## v0.1.0-rc.3

The host directories change to `app/config.yaml`, `app/logs/`, and `data/`, and SQLite enables WAL. When upgrading from rc.2, move `config.yaml` to `app/config.yaml` and the old `data/ecoku.log` to `app/logs/ecoku.log`.

## v0.1.0-rc.1 / rc.2

- rc.1 provides multi-site plain-text comments, the admin console, notifications, and Twikoo import.
- Starting with rc.2, the container includes `/client/ecoku-loader.js` and the `hash-password` command.
