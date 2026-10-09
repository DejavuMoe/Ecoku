# Upgrade

Public releases start at v0.3.0. For a new instance use [Docker deployment](./docker); this page covers upgrades.

The current release is **v0.4.1** (released 2026-10-09, schema v12).

New images are published to GHCR. Deployments using Forgejo images should change `image` to `ghcr.io/dejavumoe/ecoku:v0.4.1` or the exact target tag for future upgrades, keeping existing data and configuration mounts. No new versions will be published to the Forgejo registry. Switching registries at the same version does not require reinitializing the instance.

## What happens during an upgrade

Upgrading means changing the image in `compose.yaml` to the new version and starting it. When the new version starts, it checks the database's schema version. If it is lower than the version it supports, it runs the migrations in order:

- Each migration step runs in one transaction. If a step fails, the whole step is rolled back, the database stays as it was, and the service does not start;
- Migrations run on the existing database file. They do not delete or recreate the database, comments, config, WAL files, or your backups;
- Each completed step appends a record to the `schema_migrations` table;
- **Migrations only go forward.** An older version of the program cannot open a database with a newer schema and refuses to start.

That makes a backup taken before the upgrade the only way to roll back to an older schema.

## Upgrade steps {#steps}

**1. Read the upgrade notes.** Find the target version in the [version list](#versions) below, and check whether it has config changes or a schema migration.

**2. Take a cold backup with the service stopped.** Follow [Backup and restore](./backup#cold-backup) and confirm that the output includes `Verified backup`.

**3. Change the image version.** Edit `~/Ecoku/compose.yaml` and change `image` to the target version, for example:

```yaml
    image: "ghcr.io/dejavumoe/ecoku:v0.4.1"
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

- **Same schema**: stop the service, change the image in `compose.yaml` back to the old version, then pull and start. You do not need to touch the database, and comments posted after the upgrade are kept. If you omitted fields during the upgrade because the new version has defaults for them, add back the configuration the old version requires. If you added a key for the new version that the old version does not recognize, remove it first; otherwise the old version refuses to start because of the unknown field.
- **Different schema**: changing the image version back is not enough, because the old version cannot open the migrated database. You need to [restore](./backup#restore) from the cold backup taken before the upgrade. Comments and settings changes made after the backup are lost.

## Version list {#versions}

| Version | Release date | Schema | Highlights |
| --- | --- | --- | --- |
| [v0.4.1](./upgrades/v0.4.1) | 2026-10-09 | v12 | Remove global admin shortcuts and hints, and correct the npm README install version; no database migration. |
| [v0.4.0](./upgrades/v0.4.0) | 2026-10-09 | v12 | Admin migrated to Svelte 5; SDK and deployment remain compatible, with no database migration. |
| [v0.3.8](./upgrades/v0.3.8) | 2026-10-09 | v12 | Go 1.27.2 and x/net v0.60.0 security fixes; no database migration. |
| [v0.3.7](./upgrades/v0.3.7) | 2026-10-06 | v12 | List optimizations, notification deletion coordination, security hardening, OpenSSL updates and image-check fixes. |
| [v0.3.6](./upgrades/v0.3.6) | 2026-10-06 | v12 | Image publication did not complete; use v0.3.7. |
| [v0.3.5](./upgrades/v0.3.5) | 2026-10-05 | v12 | Fixed horizontal page shifts when switching admin menus and loading data. |
| [v0.3.4](./upgrades/v0.3.4) | 2026-10-05 | v12 | Admin verification loading fix, unconfirmed submission feedback, and identity storage that no longer delays loading or success feedback. |
| [v0.3.3](./upgrades/v0.3.3) | 2026-10-04 | v12 | The admin username is kept after a password reset, a reply depth limit in the comment area, and the loader `data-i18n` attribute with localized failure messages. |
| [v0.3.2](./upgrades/v0.3.2) | 2026-10-04 | v12 | Boxed admin settings with item lists, the email header seal and SDK locale precedence fixes. |
| [v0.3.1](./upgrades/v0.3.1) | 2026-10-03 | v11 → v12 | Three-language interfaces, per-site locale and documentation theme synchronization. |
| [v0.3.0](./upgrades/v0.3.0) | 2026-10-03 | v10 → v11 | Separate Smoji image origin, npm SDK and GHCR releases, configuration templates and documentation theme. |

A single version number in the Schema column means that release has no database migration.

::: details Internal test archive (do not use)
This page preserves the tag, changes and historical upgrade notes. Public deployments start at v0.3.0; old images are no longer supported for deployment. Use the [current deployment guide](./docker).

| Version | Date | Schema | Historical changes |
| --- | --- | --- | --- |
| [v0.2.9](./upgrades/v0.2.9) | 2026-10-02 | v9 → v10 | First-login password setup, persistent administrator and keys, legacy compatibility, and admin fixes. |
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
| [v0.1.0](./upgrades/v0.1.0) | 2026-08-15 | v4 | First stable-tagged internal test release. |
| [Earlier release candidates](./upgrades/earlier) | 2026-08-14 | v1 – v4 | The `v0.1.0-rc.*` series. |
:::

<details id="legacy-config" class="details custom-block">
<summary>Legacy configuration for internal test instances</summary>

v0.2.9 adds the v10 administrator account table on top of schema v9. Existing sites, comments, notifications, CAPTCHA settings, and legacy administrator credentials remain. An existing deployment does not need to edit its configuration before upgrading.

Keep the old `compose.yaml`, `app/config.yaml`, and `ecoku.env`, make a [cold backup](./backup#cold-backup), and start the new image by following [Upgrade steps](#steps). On the first start the new version will:

1. import `ECOKU_ADMIN_USERNAME`, `ECOKU_ADMIN_PASSWORD_HASH`, and `ECOKU_ADMIN_TOKEN_KEY` into the persistent administrator account and session key;
2. copy `ECOKU_NOTIFICATION_ENCRYPTION_KEY` into `data/ecoku-secrets.json` and keep decrypting existing stored credentials with it;
3. keep the compatible behaviour of the old `site.port`, `site.log_path`, static directories, SQLite path, YAML `sites` and `management_key_env`;
4. not generate a temporary password or force the existing administrator to change the password.

After the new version is confirmed healthy, migrate to the smaller configuration:

1. Confirm that the admin login, site count, historical comments, and notification settings work.
2. Confirm that `data/ecoku-secrets.json` exists and that the log does not report `通知凭据校验失败`.
3. Stop the service and back up all of `data/`, `app/config.yaml`, `compose.yaml`, and the old `ecoku.env`.
4. With the service stopped, remove the administrator variables and `ECOKU_NOTIFICATION_ENCRYPTION_KEY` from `ecoku.env`. If you still need `TZ`, move it to the Compose `environment` section; if you keep `env_file`, you may also leave only `TZ` there.
5. Remove `env_file` from Compose only when the environment file is no longer needed. Keep `env_file` if it still supplies `TZ` or a site management key.
6. Keep `notifications.instance_public_url`, any `site.trusted_proxies`, `admin.allowed_origins`, and `rate_limit` settings you use. Remove legacy fields only after confirming that you no longer need the old database path, file logs, or `EcokuSite` automation.
7. Recreate the container and check the admin console, comments, and notifications again.

If the old `ECOKU_NOTIFICATION_ENCRYPTION_KEY` differs from `data/ecoku-secrets.json`, the service refuses to start instead of making existing credentials undecryptable. The old database path continues to work; do not remove `database.sqlite.path` and accidentally mount an empty `/data` directory.

Internal test images are no longer provided for production rollback. Restoring a historical schema requires its complete cold backup; this section preserves the configuration migration record only.

</details>
