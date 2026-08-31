# Upgrade & Migrations

Ecoku features sequential, in-place SQLite schema migrations.

Preparing for **[v0.1.9](./upgrades/v0.1.9)**? Wait for commit CI and image publication. Upgrading from v0.1.8 retains schema v7; public read budgets and rate limits change. Remove an explicitly added `rate_limit.comment_list` before rolling back to v0.1.8. Read the version notes for SDK behavior and rollback steps.

---

## Upgrade SOP

1. Review the upgrade release notes for your target version.
2. Execute a cold backup (`sudo docker compose down && tar ...`).
3. Update the exact image tag in `compose.yaml` (e.g. `v0.1.8`).
4. Pull the new image and launch:
   ```bash
   sudo docker compose pull
   sudo docker compose up -d
   sudo docker compose logs --tail=100 -f ecoku
   curl -f http://127.0.0.1:12123/api/health
   ```

---

## Schema Evolution History

| Image Version | Schema | Core Database Changes |
| :--- | :---: | :--- |
| `v0.1.0`–`v0.1.2` | `v4` | Base tables, sites, comments, Turnstile. |
| `v0.1.3`–`v0.1.4` | `v5` | `sites.blogger_passphrase_hash`, `comments.is_blogger`, outbox target split. |
| `v0.1.5`–`v0.1.7` | `v6` | Renamed `turnstile_settings` to `captcha_settings`, added Cap provider fields. |
| `v0.1.8` | `v7` | Added `smoji_enabled` and `smoji_manifest_url` to `sites`. |
| `v0.1.9` | `v7` | No migration; public read budgets/pagination/rate limiting and SQLite reconnection safety. |

---

## Upgrade Index

- [v0.1.9](./upgrades/v0.1.9): 2026-08-31; CWE-400 fix and compatibility notes
- [v0.1.8](./upgrades/v0.1.8): Smoji stickers support
- [v0.1.7](./upgrades/v0.1.7): Toolchain and docs site
- [v0.1.6](./upgrades/v0.1.6): Cap instrumentation CSP
- [v0.1.5](./upgrades/v0.1.5): Cap CAPTCHA provider
- [v0.1.4](./upgrades/v0.1.4): Passphrase `is_blogger` backfill
- [v0.1.3](./upgrades/v0.1.3): Passphrases and outbox refactor
- [v0.1.2](./upgrades/v0.1.2): Typography baseline
- [v0.1.1](./upgrades/v0.1.1): Jitter-free 3ch collapse
- [v0.1.0](./upgrades/v0.1.0): Initial release
- [Earlier](./upgrades/earlier): Pre-releases
