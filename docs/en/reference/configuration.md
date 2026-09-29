# Configuration reference

Ecoku's configuration lives in two places:

- `app/config.yaml`: instance-level parameters. It is read once when the container starts and is mounted read-only. After changing it, you need to recreate the container for the change to take effect.
- `ecoku.env`: admin credentials, secrets, and the time zone, injected through Compose's `env_file`.

Site, blogger, CAPTCHA, and notification settings are not in these two files. They are stored in the SQLite database, and you change them in the [admin console](../self-hosting/admin).

## General rules

- The config file may contain only one YAML document. Any unknown field makes startup fail. Leftover fields from older releases, such as MySQL or regular-user settings, also make startup fail.
- For numeric fields, `0` or omitting the field means the default in the tables below is used.
- The "Default" in the tables is the value the program uses when the field is omitted. The official image has the port, directories, log file and database path built in (marked "in the container" in the tables), so for a [Docker deployment](../self-hosting/docker) `config.yaml` usually needs only `notifications.instance_public_url`, plus `site.trusted_proxies` once the reverse proxy is set up.
- Fields you have already written out still take effect; an older, complete config file does not need trimming.
- The config file contains only the **names** of environment variables (the `*_env` fields). The secrets themselves go into `ecoku.env`.

After changing `config.yaml` or `ecoku.env`, recreate the container with:

```bash
cd ~/Ecoku && sudo docker compose up -d --force-recreate ecoku
```

`docker compose restart` does not re-read `ecoku.env`.

## site

| Field | Default | Description |
| --- | --- | --- |
| `port` | `12123` | Listening port inside the container, 1 to 65535. If you change it, update the port mapping in `compose.yaml` to match. |
| `log_path` | Empty; `/var/log/ecoku/ecoku.log` in the container | Logs always go to stdout, and you can view them with `docker compose logs`. If you set a file path, a copy is also kept in that file, rotated when a file reaches 10 MB, keeping 5 compressed old files for at most 28 days. Empty, `stdout`, `-`, or `/dev/stdout` means stdout only. |
| `trusted_proxies` | `[]` | Direct peers allowed to forward `X-Forwarded-For`, as IPs or CIDRs. Usually just the Docker gateway, such as `172.18.0.1/32`. `0.0.0.0/0` and `::/0` are forbidden. See [Reverse proxy](../self-hosting/reverse-proxy#trusted-proxies). |

Logs do not contain IP addresses, User-Agents, comment bodies, or credentials. Access logs record only the route template (such as `/api/admin/sites/:siteId`), not the actual path parameters.

## client

| Field | Default | Description |
| --- | --- | --- |
| `static_dir` | Empty; `/app/client` in the container | Directory of the browser assets. When set, Ecoku serves `ecoku-loader.js`, `ecoku.umd.js`, `ecoku.css`, and `ecoku.unstyled.css` under `/client/`, and refuses to start if any of them is missing. When empty, these files are not served. |

## rate_limit {#rate-limit}

All rate limits count per client IP, in fixed windows, with state kept in process memory and reset on restart. When a limit is exceeded, the response is `429` with a `Retry-After` header. Each operation is counted separately.

| Field | Default | Description |
| --- | --- | --- |
| `window_seconds` | `60` | Length of the counting window in seconds, shared by all operations. |
| `comment_submit` | `5` | Comments that may be submitted per window. |
| `comment_list` | `60` | Comment list reads allowed per window. Browser CORS preflights and requests with rejected origins also count. |
| `comment_delete` | `30` | Delete requests allowed per window. Soft deletes and permanent deletes are counted separately. |
| `admin_login` | `5` | Admin sign-in attempts allowed per window. |
| `notification_test` | `5` | Test notifications allowed per window. Test emails and test Telegram messages are counted separately. |

Each rate limiter tracks at most 10,000 IPs at a time. When it is full, newly seen IPs are rejected until old entries expire; the quota of IPs already tracked is never evicted.

If `trusted_proxies` is not configured correctly, all visitors behind the reverse proxy count as the same IP and share these quotas.

## notifications

| Field | Default | Description |
| --- | --- | --- |
| `encryption_key_env` | `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | Name of the environment variable holding the credential encryption master key; you rarely need to change it. It is required when you save an SMTP password, Telegram bot token, or CAPTCHA secret key in the admin console. |
| `instance_public_url` | Empty | The public URL of Ecoku, such as `https://ecoku.example.com`. You must set it before enabling email or Telegram notifications. When `admin.allowed_origins` is not set, its origin (scheme + domain + optional port) is also the origin of the admin console. The links to original posts in notifications are built from the site URL and page path, not from this address. |

## database

| Field | Default | Description |
| --- | --- | --- |
| `sqlite.path` | `./data/ecoku.bin`; `/data/ecoku.sqlite3` in the container | Path of the SQLite database file. The in-container default maps to `data/ecoku.sqlite3` on the host. |

The database runs in WAL mode, so at runtime there are `-wal` and `-shm` files in the same directory. Back up the whole `data/` directory.

## admin

| Field | Default | Description |
| --- | --- | --- |
| `enabled` | `false`; `true` in the container | Whether to enable the admin console and admin API. When disabled, neither `/admin/` nor `/api/admin/*` exists. |
| `static_dir` | `./admin`; `/app/admin` in the container | Directory of the admin console's static files. Startup fails if `index.html` or `assets/` is missing. |
| `username_env` | `ECOKU_ADMIN_USERNAME` | Name of the environment variable holding the admin username; you rarely need to change it. |
| `password_hash_env` | `ECOKU_ADMIN_PASSWORD_HASH` | Name of the environment variable holding the bcrypt hash of the admin password; you rarely need to change it. |
| `token_key_env` | `ECOKU_ADMIN_TOKEN_KEY` | Name of the environment variable holding the session signing key; you rarely need to change it. |
| `token_ttl_minutes` | `480` | Kept for compatibility. Sessions are fixed at 8 hours after sign-in. It can only be omitted or set to `480`; any other value makes startup fail. |
| `allowed_origins` | Origin of `notifications.instance_public_url` | Browser origins allowed to access the admin API, that is, the `scheme://domain[:port]` in the address bar when you open the admin console. Set it only if you open the admin console from more than one address. When the admin console is enabled, at least one of this and `instance_public_url` is required. |

When the admin console is enabled, Ecoku also checks at startup that:

- The three `*_env` fields name different environment variables, and none of their values is empty;
- The password hash is a valid bcrypt hash with a cost of at least 10 (hashes generated by `hash-password` meet this);
- The signing key is at least 32 bytes long and is not the same as the password hash or any site management key;
- `allowed_origins` does not overlap with the allowed origins of any site in `sites`. When you create or edit a site in the admin console, you also cannot use an admin origin; saving fails if you do.

## sites (optional) {#sites}

`sites` pre-populates sites **when a brand-new database is initialized for the first time**. Once the database exists, it is the source of truth for sites, and later changes to site settings in the YAML no longer take effect. Manage sites in the admin console instead. The only exception is `management_key_env`, which is read on every startup. Site entries in the YAML are still validated on every startup, and a mistake there also prevents startup. Most deployments do not need this section.

```yaml
sites:
  - id: "blog"
    site_url: "https://blog.example.com"
    name: "My Blog"
    allowed_origins:
      - "https://blog.example.com"
    management_key_env: "ECOKU_BLOG_MANAGEMENT_KEY"
    comment:
      default_sort: "newest"
      email_required: true
      website_required: false
      length_limit: 1000
```

| Field | Description |
| --- | --- |
| `id` | Site ID, 1 to 100 characters, starting with a letter or digit and containing only letters, digits, `.`, `_`, and `-`. |
| `site_url` | Canonical site URL, used to build the links to original posts in notifications. Only `http`/`https` is allowed, with no query string or fragment. If omitted, the first entry of `allowed_origins` is used. |
| `name` | Site name, up to 120 characters. If empty, the domain is shown. |
| `allowed_origins` | Origins allowed to embed the comment section. At least one. |
| `management_key_env` | Optional. Name of the environment variable holding this site's management key. The value must be at least 32 bytes, and sites cannot share one. See [REST API](./api#management-key) for what the management key is for. |
| `comment.default_sort` | `newest` (default) or `oldest`. |
| `comment.email_required` | Whether email is required. Default `true`. |
| `comment.website_required` | Whether website is required. Default `false`. |
| `comment.placeholder` | Hint text in the comment box, up to 80 characters, no line breaks. |
| `comment.length_limit` | Maximum body length, 1 to 10000. Default 1000. |
| `comment.empty_message` | Text shown when there are no comments, up to 240 characters. |

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `ECOKU_ADMIN_USERNAME` | When the admin console is enabled | Admin username, 1 to 80 characters. |
| `ECOKU_ADMIN_PASSWORD_HASH` | When the admin console is enabled | bcrypt hash of the admin password. Generate it with the `hash-password` command. See [Command line](./cli#hash-password). |
| `ECOKU_ADMIN_TOKEN_KEY` | When the admin console is enabled | Session signing key, at least 32 bytes. You can generate one with `openssl rand -hex 32`. |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | When saving credentials | A 32-byte key, Base64-encoded (with or without padding). You can generate one with `openssl rand -base64 32`. |
| `TZ` | No | Time zone for displaying comment times, as an IANA name such as `Asia/Shanghai`. If unset or the name is invalid, it falls back to the container's system time zone; if that cannot be determined, `Asia/Shanghai` is used. Setting it explicitly is recommended. |
| Site management key | No | The variable name is set by `sites[].management_key_env`, for example `ECOKU_BLOG_MANAGEMENT_KEY`. When that field is configured, the value must exist and be at least 32 bytes. |

Wrap each value in `ecoku.env` in single quotes, so Compose does not expand the `$` characters in the bcrypt hash. For an example and the commands that generate the values, see [Docker deployment](../self-hosting/docker#env).

The image already sets `GIN_MODE=release` and `ECOKU_RUNTIME=container` (which enables the "in the container" defaults above). Do not change them in `ecoku.env`.

After changing `ECOKU_ADMIN_TOKEN_KEY` or the password hash and recreating the container, all signed-in admin sessions stop working.

Do not change `ECOKU_NOTIFICATION_ENCRYPTION_KEY` casually: the credentials already stored in the database were encrypted with the old key. After you change it, Ecoku cannot decrypt them and exits with an error at startup.
