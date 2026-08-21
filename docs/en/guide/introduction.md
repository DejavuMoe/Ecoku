# Introduction

Ecoku is a self-hosted, multi-site plain-text comment system. One instance can serve many sites. Comments are published as soon as they are submitted.

It fits static blogs, docs sites, and anyone who does not want comments on a third-party SaaS. Production only supports Docker Compose and SQLite3.

## What it does

- Guest comments: nickname is always required; email and website required-ness is per site.
- Unbounded semantic reply threads; public lists paginate by root thread.
- Deletes keep a tombstone so descendant replies stay in context.
- Instance admin: sites, comments, notifications, bot protection.
- Browser SDK at same-origin `/client/ecoku-loader.js`.
- Optional SMTP / Telegram, first-time Twikoo import, Cloudflare Turnstile or self-hosted Cap.

## What it does not do

Body text is plain text only — no HTML or Markdown. No avatars, votes, rich text, end-user accounts, per-site moderation, or MySQL.

Never put admin tokens or site management keys in the browser, URL, or page markup.

## Runtime

One non-root container serves the API, `/admin/`, and the comment frontend. The port is bound to `127.0.0.1:12123` on the host; the public internet should hit a local Caddy or Nginx.

Data lives outside the container:

| Path | Role |
| --- | --- |
| `app/config.yaml` | Public config (port, logs, trusted proxies, admin origins) |
| `ecoku.env` | Admin credentials, notification encryption key, timezone |
| `data/` | SQLite database and WAL |
| `app/logs/` | Optional file log copy |

Sites, form settings, and notification channels are written to SQLite from the admin UI. YAML `sites` is imported only when the database is empty.

## Versioning

The container version is the root `VERSION` file. The Git tag is `v` plus that value. `compose.yaml` pins an exact image tag — do not use `latest`.

Next: [Features](/en/guide/features) or [Docker](/en/self-hosting/docker).
