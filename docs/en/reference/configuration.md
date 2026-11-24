# Configuration reference

Ecoku reads one YAML file, `app/config.yaml`, plus two environment variables in Compose. A new deployment only needs `instance_public_url`; leave everything else at the defaults. Sites, notifications, CAPTCHA and stickers are set in the admin console, not here.

## Complete template {#template}

The default, allowed values and purpose of each setting are in the comments. Commented-out lines are optional overrides; uncomment them when needed. Each top-level section (`site:`, `admin:` and so on) may appear only once.

<div class="config-template">

<<< ../../../deploy/config.en.yaml.example{yaml}

</div>

## Applying changes {#reload}

Configuration isn't hot-reloaded. After editing, recreate the container and check the logs:

```bash
(
set -eu
sudo docker compose config --quiet
sudo docker compose up -d --force-recreate --wait --wait-timeout 120 ecoku
)
sudo docker compose logs --tail=100 ecoku
```

Unknown fields, invalid values or duplicate fields make the service refuse to start, and the log says which one.

Startup also checks one more thing: the admin console origin (`instance_public_url` or `admin.allowed_origins`) can't overlap with any site's allowed origins in the database. On overlap, the log reports 「管理端来源 … 与已存储的公开站点来源重叠」 (admin origin … overlaps a stored public site origin) and the service doesn't start. To fix it, give the admin console and your blog different domains: change the site origins in the admin console, or adjust the admin domain and reverse proxy. CLI subcommands that open the database perform the same check.

## Rate limits {#rate-limit}

Each setting under `rate_limit` counts per IP; over the limit, requests get `429` and a `Retry-After` header. Counters are kept in memory and reset on restart. `0` means the default; rate limiting can't be turned off.

When Ecoku is behind a reverse proxy, you must configure [`site.trusted_proxies`](../self-hosting/reverse-proxy#trusted-proxies), or all visitors share one quota.

## Logs {#logs}

Logs go to standard output by default; view them with `docker compose logs`, and Docker handles retention and rotation. If you set `site.log_path` to a file path, logs go to both standard output and that file, and you need to mount a directory the container can write to.

## Environment variables {#env}

These two go under `environment` in `compose.yaml`:

| Variable | Description |
| --- | --- |
| `TZ` | Time zone for the comment section, admin console and notifications; an IANA time zone name such as `Asia/Shanghai`. |
| `ECOKU_ADMIN_LOCALE` | Admin console language: `zh-CN`, `zh-Hant` or `en`. Case-insensitive; forms such as `zh-TW` and `en-US` are also accepted. Unrecognized values fall back to `zh-CN`. |

They don't affect the comment section language, which is set per site under **Comment language** in the admin console.

Fields in the template ending in `_env` take the name of an environment variable, not its value. A new deployment creates the administrator and keys automatically, so you don't need to inject these variables. The image already sets `GIN_MODE=release` and `ECOKU_RUNTIME=container`; don't override them.

## Site seeds and the database {#legacy}

The `sites` section is imported only once, when a brand-new database is created; later changes to it don't affect existing sites. For a new deployment, just create sites in the admin console.

The database and `ecoku-secrets.json` in the same directory must be backed up and moved together. Changing the database path doesn't move data; an empty database is created at the new path.
