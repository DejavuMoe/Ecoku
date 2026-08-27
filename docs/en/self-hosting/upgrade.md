# Upgrade

Change only the **exact image tag** in Compose. Do not overwrite the whole existing Compose file. Follow the order below; per-version notes are in the index at the end of this page.

## Procedure

1. Read the target version notes and confirm whether schema, environment variables, or mounts change.
2. Take a stopped cold backup per [Backup & restore](./backup) (database, config, secrets, Compose).
3. Keep existing resource limits and mounts; change only the image tag.
4. Add any environment variables or config the version notes require.
5. Pull and start; check logs and the health endpoint.
6. Verify admin login, sites, comments, replies, notifications, and any enabled bot protection.

```bash
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=200 ecoku
curl --fail http://127.0.0.1:12123/api/health
```

`/api/health` only means the process can respond; it does not prove migrations or dependencies are fully healthy.

## Database

Migrations run inside `data/ecoku.sqlite3` by version and in transactions. Success only appends a `schema_migrations` row; it never auto-deletes the database, WAL, or backups. A failed version is not marked complete, and the service refuses to start. There are no downgrade migrations.

| Images | Schema |
| --- | --- |
| `v0.1.0`–`v0.1.2` | v4 |
| `v0.1.3`–`v0.1.4` | v5 |
| `v0.1.5`–`v0.1.7` | v6 |
| `v0.1.8` | v7 |

A database already written at a higher schema cannot be rolled back by changing only the image tag; restore the full pre-stop backup, then start with the old tag.

## Rollback

Stop the service, keep the failure scene, restore per [Backup & restore](./backup), pin Compose back to the old exact tag, then start.

## Version index

| Version | Date | Schema | Highlights |
| --- | --- | --- | --- |
| [v0.1.8](./upgrades/v0.1.8) | 2026-08-27 | v6 → v7 | Smoji stickers; two new site settings |
| [v0.1.7](./upgrades/v0.1.7) | 2026-08-26 | v6 | Build toolchain and docs site; runtime contract unchanged |
| [v0.1.6](./upgrades/v0.1.6) | 2026-08-18 | v6 | Admin CSP for Cap instrumentation |
| [v0.1.5](./upgrades/v0.1.5) | 2026-08-17 | v5 → v6 | Turnstile / Cap tri-state |
| [v0.1.4](./upgrades/v0.1.4) | 2026-08-15 | v5 | Backfill `is_blogger` when saving passphrase |
| [v0.1.3](./upgrades/v0.1.3) | 2026-08-15 | v4 → v5 | Blogger passphrase; outbox split per target |
| [v0.1.2](./upgrades/v0.1.2) | 2026-08-15 | v4 | Comment meta font size |
| [v0.1.1](./upgrades/v0.1.1) | 2026-08-15 | v4 | Fold controls monospace width |
| [v0.1.0](./upgrades/v0.1.0) | 2026-08-15 | v4 | First stable release |
| [Earlier candidates](./upgrades/earlier) | 2026-08-14 | v1–v4 | Directory layout, WAL, timezone, first Turnstile |
