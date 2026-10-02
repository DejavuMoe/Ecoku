# Configuration reference

::: warning Unreleased configuration contract
This page describes the next version. Existing v0.2.8 instances must read [upgrade and legacy configuration migration](../self-hosting/upgrade#unreleased-config) first.
:::

A new deployment only needs `app/config.yaml`:

```yaml
notifications:
  instance_public_url: "https://ecoku.example.com"
```

Sites, comments, notifications, CAPTCHA, and the administrator account live in SQLite and are managed in the [admin console](../self-hosting/admin). The official image fixes port `12123`, browser assets at `/app/client`, the admin pages at `/app/admin`, and the database at `/data/ecoku.sqlite3`. New instances also store the session signing key, notification encryption key, and administrator account under `data/`.

The config file may contain only one YAML document. Unknown fields prevent startup. Legacy fields remain readable during the compatibility period; see [legacy configuration migration](../self-hosting/upgrade#unreleased-config).

## site

| Field | Default | Description |
| --- | --- | --- |
| `trusted_proxies` | `[]` | Direct peers allowed to forward `X-Forwarded-For`, as IPs or CIDRs. Usually just the Docker gateway, such as `172.18.0.1/32`. `0.0.0.0/0` and `::/0` are forbidden. See [Reverse proxy](../self-hosting/reverse-proxy#trusted-proxies). |

## rate_limit {#rate-limit}

Rate limits count per client IP in process memory and reset on restart. Exceeding a limit returns `429` with `Retry-After`.

| Field | Default | Description |
| --- | --- | --- |
| `window_seconds` | `60` | Length of the counting window in seconds. |
| `comment_submit` | `5` | Comments allowed per window. |
| `comment_list` | `60` | Comment list reads allowed per window. |
| `comment_delete` | `30` | Delete requests allowed per window. |
| `admin_login` | `5` | Sign-in attempts allowed per window. |
| `notification_test` | `5` | Test notifications allowed per window. |

## notifications

| Field | Default | Description |
| --- | --- | --- |
| `instance_public_url` | Empty | Ecoku's public URL, such as `https://ecoku.example.com`. Its origin is also the admin origin when `admin.allowed_origins` is omitted. It is required before enabling notifications. |

## admin

The admin console and API are always enabled at `/admin/`.

| Field | Default | Description |
| --- | --- | --- |
| `allowed_origins` | Origin of `instance_public_url` | Browser origins allowed to access the admin API. Set it only when the console is opened from more than one address. At least one admin origin is required. |

On a new instance Ecoku creates the `admin` account and a random temporary password. The password is printed only on the first account creation and must be replaced after the first sign-in. New administrator accounts do not need environment variables.

## Logs {#logs}

Logs go to standard output. View them with `docker compose logs`; Docker controls retention and rotation. New deployments do not mount `app/logs` or use `site.log_path`.

## Environment variables {#env}

A new deployment does not need `ecoku.env`. To set the display time zone, add the optional `TZ` environment variable to Compose, such as `Asia/Shanghai`.

Existing deployments continue to read these variables during migration and copy their values into `data/ecoku-secrets.json` or `admin_accounts`:

| Variable | Purpose |
| --- | --- |
| `ECOKU_ADMIN_USERNAME` | Legacy administrator username. |
| `ECOKU_ADMIN_PASSWORD_HASH` | Legacy bcrypt password hash. |
| `ECOKU_ADMIN_TOKEN_KEY` | Legacy session signing key. |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | Encryption master key for stored notification and CAPTCHA credentials. Keep it unchanged until migration is complete. |

After the variables have been imported and verified, stop the service, make a backup, and remove them so Ecoku uses the persistent state under `/data`.

## Legacy configuration fields {#legacy}

New templates no longer write these fields, but the compatibility layer still reads them: `site.port`, `site.log_path`, `client.static_dir`, `admin.static_dir`, `database.sqlite.path`, `sites`, `management_key_env`, `admin.enabled`, `admin.token_ttl_minutes`, and the administrator or notification `*_env` fields. Do not add them to new instances; see [upgrade](../self-hosting/upgrade#unreleased-config).

The image sets `GIN_MODE=release` and `ECOKU_RUNTIME=container`. Do not override them in a new deployment.
