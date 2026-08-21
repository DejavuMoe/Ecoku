# Upgrade procedure

After each release, add a page under [Upgrades](/en/self-hosting/upgrades/). Read that page and root `CHANGELOG.md` before you move.

## Order

1. Confirm the target tag, schema, env vars, and directory changes.
2. Take a [cold backup](/en/self-hosting/backup).
3. Pin the new exact image tag in `compose.yaml`. Add the current `logging` block if the old file lacks it.
4. If the release needs a new env var (for example `TZ`), write it to `ecoku.env`, not `config.yaml`.
5. Pull, start, watch migration logs, confirm `healthy`.
6. Check admin login, sites, comment timestamps, submit, reply, and notifications. If Turnstile or Cap is on, both login and posting must complete the current challenge.

```bash
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=200 ecoku
curl --fail http://127.0.0.1:12123/api/health
```

## Schema

Migrations run inside the existing `data/ecoku.sqlite3` file, one version per transaction. Success only inserts a `schema_migrations` row. There is no down-migration. A database already at a newer schema cannot run on an older image; restore the pre-upgrade backup.

| Image | Schema |
| --- | --- |
| `v0.1.0` – `v0.1.2` | v4 |
| `v0.1.3` – `v0.1.4` | v5 |
| `v0.1.5` – `v0.1.6` | v6 |

Current schema is v6 (`captcha_settings` plus Cap fields).

## Rollback

Stop → keep the failed file → restore backup → pin the old tag → start. See [Backup](/en/self-hosting/backup#restore).
