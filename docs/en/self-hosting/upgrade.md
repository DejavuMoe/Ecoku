# Upgrade

The current release is **v0.2.8** (released 2026-10-01, schema v9).

## What happens during an upgrade

Upgrading means changing the image in `compose.yaml` to the new version and starting it. When the new version starts, it checks the database's schema version. If it is lower than the version it supports, it runs the migrations in order:

- Each migration step runs in one transaction. If a step fails, the whole step is rolled back, the database stays as it was, and the service does not start;
- Migrations run on the existing database file. They do not delete or recreate the database, comments, config, WAL files, or your backups;
- Each completed step appends a record to the `schema_migrations` table;
- **Migrations only go forward.** An older version of the program cannot open a database with a newer schema and refuses to start.

That makes a backup taken before the upgrade the only way to roll back to an older schema.

You can skip versions and upgrade directly, for example from v0.1.8 straight to v0.2.8. The intermediate migrations run one after another. But read the upgrade notes for every version you skip, because some versions require config changes (for example, [v0.2.4](./upgrades/v0.2.4) requires `admin.token_ttl_minutes` to be 480 or omitted).

## Configuration migration for the next version (unreleased) {#unreleased-config}

These changes are not released and do not apply to restarting v0.2.8. The database stays at schema v9. Existing sites, comments, and notification settings remain, but the new version rejects the following YAML fields, which must be removed.

| Remove | New behavior |
| --- | --- |
| `site.port`, `site.log_path` | Listen on 12123 and log to standard output. Change the host port in Compose. |
| The entire `client` and `database` sections, and `admin.static_dir` | Image assets and database paths are fixed. Preserve the existing data mount. |
| The entire `sites` section, including `management_key_env` | Read existing sites from SQLite; create new sites in the admin console. `EcokuSite` authentication is removed. |
| `admin.enabled`, `admin.token_ttl_minutes`, `admin.username_env`, `admin.password_hash_env`, `admin.token_key_env`, `notifications.encryption_key_env` | The console is always enabled and sessions last 8 hours. See the fixed environment variable names in [Configuration reference](../reference/configuration#env). |

After release, migrate in this order:

1. Make and verify a [cold backup](./backup#cold-backup) of the database, original config, `ecoku.env`, and Compose file. Record the actual SQLite path and host mount location.
2. Remove the fields above and any empty sections. Keep `notifications.instance_public_url`, `site.trusted_proxies`, and any `admin.allowed_origins` or `rate_limit` settings you use. If you used custom environment variable names, rename them to the standard names; **keep the original password hash, signing key, and encryption master key values**.
3. Confirm that the existing database maps to `/data/ecoku.sqlite3`. Official-template deployments need no data move; for a custom location, adjust the host path in Compose. For a custom filename, prepare it as `ecoku.sqlite3` while the service is stopped. If `-wal` or `-shm` files remain, copy them together with the main file and rename them consistently, retaining the originals. Never copy just the main file or mount an empty directory. UID/GID `10001:10001` must be able to read and write the directory and files.
4. Remove `./app/logs:/var/log/ecoku` from Compose; you may retain the old log files. Read new logs with `docker compose logs`; Docker controls rotation. Automation using `EcokuSite` must use a valid admin session instead, or move the operation to the admin console.
5. Set the exact tag published at that time, then follow [Upgrade steps](#steps) to pull, start, and check it. Verify site counts, historical comments, and notification settings in the console.

To roll back to v0.2.8, stop the service and restore the original Compose, config, and environment variables. If you moved the database, restore the location expected by the original mount. The schema is unchanged, so no database rollback is needed; do not overwrite newer comments with an old backup. The old version also needs a log directory writable by the container user.

## Upgrade steps {#steps}

**1. Read the upgrade notes.** Find the target version in the [version list](#versions) below, and check whether it has config changes or a schema migration.

**2. Take a cold backup with the service stopped.** Follow [Backup and restore](./backup#cold-backup) and confirm that the output includes `Verified backup`.

**3. Change the image version.** Edit `~/Ecoku/compose.yaml` and change `image` to the target version, for example:

```yaml
    image: "git.via.moe/dejavu/ecoku:v0.2.8"
```

Use an exact version number, not `latest`. If the upgrade notes ask you to change `app/config.yaml` or `ecoku.env`, change them at the same time.

**4. Pull and start.**

```bash
cd ~/Ecoku
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
```

**5. Check.**

```bash
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

Once the container status is `healthy` and the log shows no errors, open a blog post and the admin console, and confirm that comments load and can be posted and that you can sign in to the admin console.

## Roll back

First check whether the old and new versions have the same schema (see the table below):

- **Same schema**: stop the service, change the image in `compose.yaml` back to the old version, then pull and start. You do not need to touch the database, and comments posted after the upgrade are kept. If you relied on defaults for omitted fields in the new version, first restore the complete config required by the old version. If the new version required a new config key that the old version does not recognize, remove it first. Otherwise the old version refuses to start because of the unknown field.
- **Different schema**: changing the image version back is not enough, because the old version cannot open the migrated database. You need to [restore](./backup#restore) from the cold backup taken before the upgrade. Comments and settings changes made after the backup are lost.

## Version list {#versions}

| Version | Release date | Schema | Highlights |
| --- | --- | --- | --- |
| [v0.2.8](./upgrades/v0.2.8) | 2026-10-01 | v9 | The admin console adds a comment stream, row-based settings, shortcuts and bottom navigation; container defaults allow shorter deployment templates. |
| [v0.2.7](./upgrades/v0.2.7) | 2026-09-29 | v8 → v9 | Notification emails use the paper-and-ink look and system fonts, with the post title in the subject; deleting a comment cancels pending notifications and retracts sent Telegram messages; the queue stops retrying deliveries that cannot succeed. |
| [v0.2.6](./upgrades/v0.2.6) | 2026-09-29 | v8 | The admin console uses the same paper-and-ink colours as the comment section and system fonts, with reorganized page layouts; features and APIs are unchanged. |
| [v0.2.5](./upgrades/v0.2.5) | 2026-09-26 | v8 | Default comment styles changed to "paper and ink" and can be overridden directly with CSS variables; Turnstile verification rejects redirects. |
| [v0.2.4](./upgrades/v0.2.4) | 2026-09-16 | v7 → v8 | Admin sessions changed to revocable cookie sessions; `token_ttl_minutes` can only be 480; new replies go at most 16 levels deep. |
| [v0.2.3](./upgrades/v0.2.3) | 2026-09-16 | v7 | Saving a site no longer rewrites past blogger marks; several fixes to notifications, import, and the SDK. |
| [v0.2.2](./upgrades/v0.2.2) | 2026-09-13 | v7 | Fixed the sticker picker overflowing the page on narrow screens. |
| [v0.2.1](./upgrades/v0.2.1) | 2026-09-12 | v7 | Higher Smoji manifest capacity; support for `base` templates. |
| [v0.2.0](./upgrades/v0.2.0) | 2026-09-12 | v7 | Documentation and API reference revisions; no runtime changes. |
| [v0.1.9](./upgrades/v0.1.9) | 2026-08-31 | v7 | Comment list gets a read budget, a level-by-level read API, and a separate read rate limit. |
| [v0.1.8](./upgrades/v0.1.8) | 2026-08-27 | v6 → v7 | Added Smoji sticker packs. |
| [v0.1.7](./upgrades/v0.1.7) | 2026-08-26 | v6 | Build toolchain and docs site updates; no runtime changes. |
| [v0.1.6](./upgrades/v0.1.6) | 2026-08-18 | v6 | Fixed the admin console CSP required by Cap. |
| [v0.1.5](./upgrades/v0.1.5) | 2026-08-17 | v5 → v6 | CAPTCHA changed to a choice of off / Turnstile / Cap. |
| [v0.1.4](./upgrades/v0.1.4) | 2026-08-15 | v5 | Saving the blogger passphrase backfilled past blogger marks (removed in v0.2.3). |
| [v0.1.3](./upgrades/v0.1.3) | 2026-08-15 | v4 → v5 | Blogger switched to passphrase authentication; notifications split per recipient. |
| [v0.1.2](./upgrades/v0.1.2) | 2026-08-15 | v4 | Comment metadata layout adjustments. |
| [v0.1.1](./upgrades/v0.1.1) | 2026-08-15 | v4 | Collapse button uses a fixed width and no longer shifts when toggled. |
| [v0.1.0](./upgrades/v0.1.0) | 2026-08-15 | v4 | First stable release. |
| [Earlier release candidates](./upgrades/earlier) | 2026-08-14 | v1 – v4 | The `v0.1.0-rc.*` series. |

A single version number in the Schema column means that release has no database migration.
