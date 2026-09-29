# Docker deployment

This page starts from an empty Linux host and brings up an Ecoku instance with Docker Compose. When you are done, the service is reachable only on the local machine at `127.0.0.1:12123`. You set up public HTTPS in the next step, [Reverse proxy](./reverse-proxy).

## Before you start

You need:

- A Linux host with Docker Engine and Compose v2 (the `docker compose` command), and `sudo` access.
- A domain dedicated to Ecoku, such as `ecoku.example.com`. You reach the admin console through it, and your blog loads the comment section script from it. It cannot be the same as your blog's domain. See `admin.allowed_origins` below for why.
- Caddy or Nginx running on this host to terminate HTTPS.

In the commands on this page, `ecoku.example.com` and `blog.example.com` are placeholders. Replace them with your own domains. The image is the current release, `git.via.moe/dejavu/ecoku:v0.2.7`.

After deployment, the directory layout looks like this:

```text
~/Ecoku/
├── compose.yaml        # Container definition
├── ecoku.env           # Admin credentials, secrets, time zone (mode 600)
├── app/
│   ├── config.yaml     # Instance config (mounted read-only)
│   └── logs/           # Copy of the log file
└── data/
    └── ecoku.sqlite3   # All data: sites, comments, settings
```

## 1. Create the directories

The container runs as UID/GID `10001:10001` with a read-only root file system. Only the mounted `app/logs` and `data` directories are writable. Create the deployment directory and `app/` with your own account, so editing the config later does not need `sudo`; hand `app/logs` and `data` to the container user:

```bash
mkdir -p ~/Ecoku/app && cd ~/Ecoku
sudo install -d -o 10001 -g 10001 -m 750 app/logs data
```

## 2. Write compose.yaml

```bash
cd ~/Ecoku

cat <<'EOF' > compose.yaml
services:
  ecoku:
    image: "git.via.moe/dejavu/ecoku:v0.2.7"
    init: true
    restart: unless-stopped
    container_name: ecoku
    env_file:
      - ./ecoku.env
    ports:
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
      - ./app/logs:/var/log/ecoku
      - ./data:/data
    deploy:
      resources:
        limits:
          memory: 384M
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
    read_only: true
    tmpfs:
      - /tmp:rw,noexec,nosuid,nodev,size=16m
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--output-document=-", "http://127.0.0.1:12123/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    stop_grace_period: 30s
EOF
```

Keep two things exactly as shown:

- **Bind the port to `127.0.0.1` only.** Writing `12123:12123` makes Docker open the port on every network interface, so anyone can bypass the reverse proxy and reach Ecoku directly, and rate limiting stops working.
- **Pin the image to an exact version.** Do not use `latest`. To upgrade, change this line. To roll back, change it back to the old version. See [Upgrade](./upgrade).

The other options tighten the container's permissions: `read_only` and `tmpfs` let the container write only to `/tmp` (16 MB) and the mounted directories; `cap_drop: ALL` and `no-new-privileges` drop all Linux capabilities; `healthcheck` requests `/api/health` inside the container every 30 seconds.

## 3. Write app/config.yaml

```bash
cd ~/Ecoku

cat <<'EOF' > app/config.yaml
site:
  port: 12123
  # Logs always go to stdout; this also keeps a copy in a file, rotated in-process
  log_path: "/var/log/ecoku/ecoku.log"
  # Leave empty for now; fill in the Docker gateway after setting up the reverse proxy (see "Reverse proxy")
  trusted_proxies: []

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
EOF

chmod 644 app/config.yaml
```

`config.yaml` holds no passwords or keys, so keep it owned by you with mode `644`: the container mounts it read-only and reads it through the other-users read permission, and later edits do not need `sudo`.

You only need to change two values for your environment:

- `notifications.instance_public_url`: the public URL of Ecoku. You must set it before you enable email or Telegram notifications. Otherwise saving notification settings in the admin console fails.
- `admin.allowed_origins`: the origin (scheme + domain + optional port) shown in the browser's address bar when you open the admin console. It **must not overlap with the allowed origins of any site**; when you save a site, the admin console rejects an origin identical to it. This is why Ecoku needs its own domain.

The config file does not hold any passwords or secrets. It only names the environment variables; the actual values go into `ecoku.env` in the next step. Unknown fields cause startup to fail. See the [Configuration reference](../reference/configuration) for what every field means.

## 4. Generate ecoku.env {#env}

`ecoku.env` holds the admin credentials and two secret keys. The script below is safe to run more than once: existing entries are skipped, not overwritten; the password is not echoed while you type it; and every value is wrapped in single quotes so Compose does not expand the `$` characters in the bcrypt hash as variables.

```bash
cd ~/Ecoku
touch ecoku.env && chmod 600 ecoku.env

grep -q '^GIN_MODE=' ecoku.env || echo "GIN_MODE='release'" >> ecoku.env
grep -q '^TZ=' ecoku.env || echo "TZ='Asia/Shanghai'" >> ecoku.env
grep -q '^ECOKU_ADMIN_USERNAME=' ecoku.env || echo "ECOKU_ADMIN_USERNAME='admin'" >> ecoku.env

# Admin password: entered interactively; only the bcrypt hash is saved
if ! grep -q '^ECOKU_ADMIN_PASSWORD_HASH=' ecoku.env; then
  read -rsp 'Admin password: ' ADMIN_PASS; echo
  HASH=$(printf '%s\n' "$ADMIN_PASS" | sudo docker run --rm -i "git.via.moe/dejavu/ecoku:v0.2.7" hash-password)
  unset ADMIN_PASS
  if [ -n "$HASH" ]; then
    echo "ECOKU_ADMIN_PASSWORD_HASH='$HASH'" >> ecoku.env
  else
    echo 'Failed to generate the password hash; run this block again' >&2
  fi
fi

# Admin session signing key: 64 hexadecimal characters
grep -q '^ECOKU_ADMIN_TOKEN_KEY=' ecoku.env || \
  echo "ECOKU_ADMIN_TOKEN_KEY='$(openssl rand -hex 32)'" >> ecoku.env

# Credential encryption master key: 32 bytes, Base64-encoded
grep -q '^ECOKU_NOTIFICATION_ENCRYPTION_KEY=' ecoku.env || \
  echo "ECOKU_NOTIFICATION_ENCRYPTION_KEY='$(openssl rand -base64 32)'" >> ecoku.env
```

What each variable does:

| Variable | Description |
| --- | --- |
| `TZ` | Comment times are displayed in this time zone. Use an IANA name, such as `Asia/Tokyo`. |
| `ECOKU_ADMIN_USERNAME` | Admin sign-in username, 1 to 80 characters. |
| `ECOKU_ADMIN_PASSWORD_HASH` | bcrypt hash of the admin password, generated by the `hash-password` command built into the image. |
| `ECOKU_ADMIN_TOKEN_KEY` | Signing key for admin sessions, at least 32 bytes. Changing it invalidates all signed-in sessions. |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | Encrypts the SMTP password, Telegram bot token, and CAPTCHA secret key stored in the database. |

::: danger Back up the master key together with the database
Once you have saved SMTP, Telegram, or CAPTCHA credentials in the admin console, `ECOKU_NOTIFICATION_ENCRYPTION_KEY` is the only key that can decrypt them. If the key is lost or changed, Ecoku refuses to start because it cannot decrypt them. When you [back up](./backup), `ecoku.env` must be in the same archive as `data/`.
:::

## 5. Start and check

```bash
cd ~/Ecoku
sudo docker compose config --quiet   # Checks the syntax; no output means it is fine
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
```

On first start, Ecoku creates the database at `data/ecoku.sqlite3` and initializes it to the latest schema. When `Server starting on :12123` appears in the log, the service is listening.

Check the health endpoint on the host:

```bash
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

A healthy instance returns:

```json
{"code":200,"message":"Success","data":{"status":"healthy","timestamp":1790000000}}
```

The health endpoint only tells you that the process is answering requests. If the container keeps restarting, look at `docker compose logs` first. Config errors, empty environment variables, and wrong directory permissions are all explained in the log. See the [FAQ](./faq) for common cases.

## Next steps

1. [Set up the reverse proxy](./reverse-proxy) so that `https://ecoku.example.com` is reachable from the internet.
2. Open `https://ecoku.example.com/admin/`, [sign in to the admin console](./admin), and register your first site.
3. [Embed the comment section in your blog pages](../integration/html).

If you are migrating existing comments from Twikoo, do it after you register the site in step 2 and before anyone posts a new comment. See [Migrate from Twikoo](./twikoo).
