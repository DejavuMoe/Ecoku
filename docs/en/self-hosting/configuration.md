# Configuration Reference

Defaults below are code defaults. The sample paths `/app/client`, `/app/admin`, `/data/ecoku.sqlite3` and `ECOKU_*` variable names are explicit deployment-template values; keep your existing values when upgrading.

This guide provides a comprehensive dictionary and technical specification for `app/config.yaml` and the `ecoku.env` environment file.

`rate_limit.comment_list` controls public comment list reads per IP, defaulting to 60 requests per `window_seconds` window (60 seconds default). Both list modes (flat and nested) share the same rate-limit bucket; other operations use isolated buckets. Exceeding the quota returns HTTP 429 with a `Retry-After` header. Each rate limiter tracks up to 10,000 active IP buckets in memory, rejecting new addresses when saturated until existing entries expire. Following `trusted_proxies` rules, visitors behind an untrusted reverse proxy will share the proxy IP's single quota.

List rate-limiting admission runs before CORS checks; preflight requests (`OPTIONS`) and rejected origins count toward the quota. Rejections return before CORS headers are attached, so cross-origin browsers may report a network failure. If SQLite reconnects after an interrupted transaction, foreign key enforcement, synchronous level, and busy timeout settings are automatically reapplied.

---

## Configuration File `app/config.yaml`

Mounted into the container as read-only (`:ro`), `app/config.yaml` defines service ports, storage paths, rate limits, and module settings.

```yaml
site:
  port: 12123
  log_path: "/var/log/ecoku/ecoku.log"
  trusted_proxies:
    - "172.18.0.1/32"

client:
  static_dir: "/app/client"

rate_limit:
  window_seconds: 60
  comment_submit: 5
  comment_list: 60
  comment_delete: 30
  admin_login: 5
  notification_test: 5

notifications:
  encryption_key_env: "ECOKU_NOTIFICATION_ENCRYPTION_KEY"
  instance_public_url: "https://ecoku.example.com"

database:
  sqlite:
    path: "/data/ecoku.sqlite3"

admin:
  enabled: true
  static_dir: "/app/admin"
  username_env: "ECOKU_ADMIN_USERNAME"
  password_hash_env: "ECOKU_ADMIN_PASSWORD_HASH"
  token_key_env: "ECOKU_ADMIN_TOKEN_KEY"
  token_ttl_minutes: 480
  allowed_origins:
    - "https://ecoku.example.com"
```

### Detailed Field Specifications

#### 1. `site` Core Service
| Field | Type | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `port` | Integer | No | `12123` | Internal port the server listens on. |
| `log_path` | String | No | `""` | File path for log output. If empty, `stdout`, or `-`, logs are printed to stdout only. If a path is specified, logs are rotated internally. |
| `trusted_proxies` | List of Strings | No | `[]` | List of trusted proxy IPs or CIDRs (e.g. Docker gateway `172.18.0.1/32`). Only connections matching this list have their `X-Forwarded-For` parsed. |

#### 2. `client` Static Assets
| Field | Type | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `static_dir` | String | No | `""` | Directory path containing client SDK and loader files. |

#### 3. `rate_limit` Fixed-Window Limiting
All rate limits operate on fixed in-memory windows per process:
| Field | Type | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `window_seconds` | Integer | No | `60` | Fixed time window duration in seconds. |
| `comment_submit` | Integer | No | `5` | Maximum comment submissions per IP per window. |
| `comment_list` | Integer | No | `60` | Maximum public comment list reads per IP per window (shared between modes). |
| `comment_delete` | Integer | No | `30` | Maximum deletion requests per IP per window. |
| `admin_login` | Integer | No | `5` | Maximum admin login attempts per IP per window. |
| `notification_test` | Integer | No | `5` | Maximum test notification triggers per IP per window. |

#### 4. `notifications` Outbox & Encryption
| Field | Type | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `encryption_key_env` | String | Yes | `""` | Environment variable name holding the master encryption key. |
| `instance_public_url` | String | No | `""` | Required when enabling notifications; currently not used to build links. Article links use the site `site_url` and comment `mark`. |

#### 5. `database` Storage
| Field | Type | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `sqlite.path` | String | Yes | `./data/ecoku.bin` | Absolute path to the SQLite3 database file (hardcoded fallback `./data/ecoku.bin`, container standard `/data/ecoku.sqlite3`). |

#### 6. `admin` Management Console
| Field | Type | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `enabled` | Boolean | No | `false` | Enable the admin console. Must be set to `true` in production. |
| `static_dir` | String | No | `./admin` | Directory path containing admin UI files. |
| `username_env` | String | Yes | `""` | Env variable name for the admin username. |
| `password_hash_env` | String | Yes | `""` | Env variable name for the bcrypt password hash. |
| `token_key_env` | String | Yes | `""` | Env variable name for the HMAC Bearer token signing key. |
| `token_ttl_minutes` | Integer | No | `480` | Compatibility key: omit or set to `480` only. Fixed eight-hour absolute lifetime; no sliding renewal. |
| `allowed_origins` | List of Strings | Yes | `[]` | Exact origin list allowed to access the admin API (including protocol and port). |

#### 7. `sites` Initial Site Seed (Optional)
Used only on **first-time database initialization**. Subsequent configuration changes must be made via the admin console:
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `id` | String | Yes | Unique site ID (starts with alphanumeric, regex `^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$`). |
| `site_url` | String | Yes | Canonical site URL (e.g. `https://blog.example.com`). |
| `name` | String | No | Human-readable site name (falls back to domain name). |
| `allowed_origins` | List of Strings | Yes | Exact origins allowed to call comment endpoints. |
| `management_key_env` | String | No | Dedicated env variable name for automated comment deletion API (>= 32 chars). |
| `comment` | Object | No | Default form settings (`placeholder`, `default_sort`, `length_limit`, `empty_message`, `email_required`, `website_required`). |

---

## Environment Variables `ecoku.env`

Injected via Docker Compose `env_file`, storing secrets and sensitive credentials:

| Variable | Required | Security Constraints | Description / Generation |
| :--- | :---: | :--- | :--- |
| `GIN_MODE` | No | Fixed to `release` in production | Gin engine operational mode. |
| `TZ` | No | Standard IANA timezone string | E.g. `Asia/Shanghai`, `UTC`. |
| `ECOKU_ADMIN_USERNAME` | Yes | 1~80 characters | Admin username. |
| `ECOKU_ADMIN_PASSWORD_HASH` | Yes | Valid bcrypt hash | Generated via `ecoku-server hash-password`. |
| `ECOKU_ADMIN_TOKEN_KEY` | Yes | Minimum 32 characters | HMAC Bearer token signing key (`openssl rand -hex 32`). |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | Yes | Base64-encoded 32-byte string | AES-256-GCM master key (`openssl rand -base64 32`). |
