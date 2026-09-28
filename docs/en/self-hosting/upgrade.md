# Upgrade

The current release is **v0.2.5** (released 2026-09-26, schema v8).

## What happens during an upgrade

Upgrading means changing the image in `compose.yaml` to the new version and starting it. When the new version starts, it checks the database's schema version. If it is lower than the version it supports, it runs the migrations in order:

- Each migration step runs in one transaction. If a step fails, the whole step is rolled back, the database stays as it was, and the service does not start;
- Migrations run on the existing database file. They do not delete or recreate the database, comments, config, WAL files, or your backups;
- Each completed step appends a record to the `schema_migrations` table;
- **Migrations only go forward.** An older version of the program cannot open a database with a newer schema and refuses to start.

That makes a backup taken before the upgrade the only way to roll back to an older schema.

You can skip versions and upgrade directly, for example from v0.1.8 straight to v0.2.5. The intermediate migrations run one after another. But read the upgrade notes for every version you skip, because some versions require config changes (for example, [v0.2.4](./upgrades/v0.2.4) requires `admin.token_ttl_minutes` to be 480 or omitted).

## Upgrade steps {#steps}

**1. Read the upgrade notes.** Find the target version in the [version list](#versions) below, and check whether it has config changes or a schema migration.

**2. Take a cold backup with the service stopped.** Follow [Backup and restore](./backup#cold-backup) and confirm that the output includes `Verified backup`.

**3. Change the image version.** Edit `~/Ecoku/compose.yaml` and change `image` to the target version, for example:

```yaml
    image: "git.via.moe/dejavu/ecoku:v0.2.5"
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

- **Same schema**: stop the service, change the image in `compose.yaml` back to the old version, then pull and start. You do not need to touch the database, and comments posted after the upgrade are kept. If the new version required a new config key that the old version does not recognize, remove it first. Otherwise the old version refuses to start because of the unknown field.
- **Different schema**: changing the image version back is not enough, because the old version cannot open the migrated database. You need to [restore](./backup#restore) from the cold backup taken before the upgrade. Comments and settings changes made after the backup are lost.

## Version list {#versions}

| Version | Release date | Schema | Highlights |
| --- | --- | --- | --- |
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
