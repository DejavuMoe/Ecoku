# Upgrading

To upgrade, change the image in `compose.yaml` to the new version and recreate the container. On startup, the new version checks the database schema version and, if needed, migrates it in place, in order.

The current version is **v0.6.3** (2026-11-24, schema v12). For a new deployment, go straight to [Docker installation](./docker).

Before upgrading, read the notes in the [version list](#versions) for every version between yours and the target. Two things need special attention:

- When upgrading from v0.5.7 or earlier, you must also replace the health check in Compose; see [Migrating to the distroless image](#distroless).
- When upgrading from a version before v0.5.0, the admin console origin can't overlap with any site's allowed origins, or the new version refuses to start; see [v0.5.0 compatibility notes](./upgrades/v0.5.0#compatibility).

## Database migrations

- Each migration step runs in one transaction. If a step fails, only that step is rolled back and the service doesn't start; earlier completed steps stay applied.
- Migrations modify the existing database file directly. They don't delete the database, comments, configuration or backups.
- Migrations only go forward. An older version can't open a database with a newer schema.

So the cold backup taken before the upgrade is the only way back to the old schema.

## Upgrade steps {#steps}

<div class="steps">


### Read the upgrade notes

Find the target version in the [version list](#versions) and check whether it has configuration changes or database migrations.

### Take a cold backup with the service stopped

Follow [Backup and restore](./backup#cold-backup). After you see `Verified backup`, keep the service stopped.

### Change the image version

Edit `~/Ecoku/compose.yaml` and write an exact version number:

```yaml
    image: "ghcr.io/dejavumoe/ecoku:v0.6.3"
```

If the upgrade notes ask you to change `app/config.yaml`, do it now. Instances that used to pull from the Forgejo registry should switch to the GHCR address above; Forgejo no longer publishes new versions.

### Pull and start


```bash
(
set -eu
cd ~/Ecoku
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d --force-recreate --wait --wait-timeout 120 ecoku
)
```

### Check


```bash
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

Once the container is `healthy` and the logs show no errors, open a post to confirm that comments load and can be posted, then sign in to the admin console once.

</div>

If your site uses the npm package `ecoku`, update the dependency to the same version and rebuild.

## Rollback {#rollback}

First check whether the old and new versions have the same schema (see the table below).

**Same schema**: stop the service, change the image in `compose.yaml` back to the old version, then pull and recreate. Leave the database alone; comments posted after the upgrade are kept. If you added configuration keys for the new version that the old version doesn't recognize, remove them first, or the old version refuses to start because of the unknown fields.

**Different schema**: changing the image back doesn't help, because the old version can't open the migrated database. [Restore](./backup#restore) from the cold backup taken before the upgrade; comments and settings changes made after the backup are lost.

## Version list {#versions}

A single version number in the Schema column means that release has no database migration.

| Version | Release date | Schema | Highlights |
| --- | --- | --- | --- |
| [v0.6.3](./upgrades/v0.6.3) | 2026-11-24 | v12 | "Powered by Ecoku" at the bottom right of the comment area; the admin footer shows the credit and the running version. No database migration. |
| [v0.6.2](./upgrades/v0.6.2) | 2026-11-23 | v12 | Replies in the default comment style hang off tree connectors; new `--ecoku-thread-*` variables. No database migration. |
| [v0.6.1](./upgrades/v0.6.1) | 2026-11-19 | v12 | Fix Twikoo import, admin comment list consistency and trusted proxy validation. Improve comment list reads. No database migration. |
| [v0.6.0](./upgrades/v0.6.0) | 2026-11-17 | v12 | Migrate runtime image to distroless Debian 13 static without shell/wget; add built-in binary healthcheck probe; older Compose files must update probe. No database migration. |
| [v0.5.7](./upgrades/v0.5.7) | 2026-11-12 | v12 | Optimize public reads and SDK loading; fix reply drafts, sorting and refresh races; use the instance time zone in admin. No database migration. |
| [v0.5.6](./upgrades/v0.5.6) | 2026-11-09 | v12 | Fix musl and zlib vulnerabilities in the runtime image and the `x/net` HTML parsing vulnerability (GO-2026-6860); includes every v0.5.5 change. No database migration; external behavior unchanged. |
| [v0.5.5](./upgrades/v0.5.5) | 2026-11-09 | v12 | Image publication did not complete; use v0.5.6. |
| [v0.5.4](./upgrades/v0.5.4) | 2026-10-23 | v12 | Fix SDK last-page recovery, navigation titles, missing site validation, and the initial administrator setup data race. No database migration. |
| [v0.5.3](./upgrades/v0.5.3) | 2026-10-19 | v12 | Admin console polish: centred navigation, full dates, a delete confirmation card. No database migration; server and SDK runtime code unchanged. |
| [v0.5.2](./upgrades/v0.5.2) | 2026-10-18 | v12 | Stop logging administrator passwords; first sign-in uses a password reset while the service is stopped. No database migration. |
| [v0.5.1](./upgrades/v0.5.1) | 2026-10-16 | v12 | Remove unused configuration helpers and reduce CI browser downloads; no database migration or SDK runtime changes. |
| [v0.5.0](./upgrades/v0.5.0) | 2026-10-11 | v12 | Fix comment request races, admin state, imports, notifications, and origin validation; no database migration. Check origin conflicts before upgrading. |
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


## Migrating to the distroless image {#distroless}

Starting in v0.6.0, the runtime image changed from Alpine to distroless Debian 13 static, which has no shell, wget or package manager. When upgrading from v0.5.7 or earlier, you must replace the old wget health check in Compose with:

```yaml
    healthcheck:
      test: ["CMD", "/app/ecoku-server", "healthcheck"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

If you change only the image and not the probe, the old probe keeps failing. If you changed the port inside the container, add `--port=YOUR_PORT`.

Everything else stays the same: UID/GID `10001:10001`, `/app/config.yaml`, the `/data` mount and schema v12 are unchanged. You don't need to change ownership of the data directory, and the host doesn't need to be upgraded to Debian 13.

For troubleshooting, use `docker compose logs`, `docker inspect` and `docker cp` on the host instead. Scripts that depend on `docker exec … sh` need to be updated.

When rolling back to v0.5.7, also restore the old wget health check, or remove the `healthcheck` section from Compose to use the old image's built-in probe.

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
