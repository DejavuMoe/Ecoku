# Docker deployment

This page starts from an empty Linux host and brings up an Ecoku instance with Docker Compose. You only prepare three files: `compose.yaml`, `app/config.yaml` and `ecoku.env`. When you are done, the service is reachable only on the local machine at `127.0.0.1:12123`. You set up public HTTPS in the next step, [Reverse proxy](./reverse-proxy).

## Before you start

You need:

- A Linux host with Docker Engine and Compose v2 (the `docker compose` command), and `sudo` access.
- A domain dedicated to Ecoku, such as `ecoku.example.com`. You reach the admin console through it, and your blog loads the comment section script from it. It cannot be the same as your blog's domain. See [step 3](#config) for why.
- Caddy or Nginx running on this host to terminate HTTPS.

On this page, `ecoku.example.com` and `blog.example.com` are placeholders. Replace them with your own domains. The image is the current release, `git.via.moe/dejavu/ecoku:v0.2.8`.

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

## 1. Prepare the directories

The container runs as UID/GID `10001:10001` with a read-only root file system. Only the mounted `app/logs` and `data` directories are writable. Create the deployment directory and `app/` with your own account, so editing the config later does not need `sudo`; hand `app/logs` and `data` to the container user:

```bash
mkdir -p ~/Ecoku/app && cd ~/Ecoku
sudo install -d -o 10001 -g 10001 -m 750 app/logs data
```

## 2. Create compose.yaml

Create `compose.yaml` in `~/Ecoku` with this content:

```yaml
services:
  ecoku:
    image: "git.via.moe/dejavu/ecoku:v0.2.8"
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
```

The port, directories, log file and database path inside the container are fixed in the image and match the mounts above. To use a different location on the host, change only the part before the colon, for example `"127.0.0.1:8080:12123"` for the port or `/srv/ecoku-data:/data` for the data.

Keep two things exactly as shown:

- **Bind the port to `127.0.0.1` only.** Writing `12123:12123` makes Docker open the port on every network interface, so anyone can bypass the reverse proxy and reach Ecoku directly, and rate limiting stops working.
- **Pin the image to an exact version.** Do not use `latest`. To upgrade, change this line. To roll back, change it back to the old version. See [Upgrade](./upgrade).

The other options tighten the container's permissions: `read_only` and `tmpfs` let the container write only to `/tmp` (16 MB) and the mounted directories; `cap_drop: ALL` and `no-new-privileges` drop all Linux capabilities; `healthcheck` requests `/api/health` inside the container every 30 seconds.

## 3. Create app/config.yaml {#config}

Create `app/config.yaml`. It only needs the public URL of Ecoku:

```yaml
notifications:
  instance_public_url: "https://ecoku.example.com"
```

Then set its mode:

```bash
chmod 644 ~/Ecoku/app/config.yaml
```

`instance_public_url` is used for two things:

- The admin console only accepts requests from this address (scheme + domain + optional port), that is, the origin in the browser's address bar when you open the admin console. It **must not overlap with the allowed origins of any site**; when you save a site, the admin console rejects an origin identical to it. This is why Ecoku needs its own domain.
- You must set it before you enable email or Telegram notifications. Otherwise saving notification settings in the admin console fails.

After you set up the reverse proxy, add `site.trusted_proxies` here as well; see [Reverse proxy](./reverse-proxy#trusted-proxies). Rate limits and the other fields have defaults; add them only when you need them, following the [Configuration reference](../reference/configuration). A misspelled field name makes startup fail.

`config.yaml` holds no passwords or keys, so keep it owned by you with mode `644`: the container mounts it read-only, and later edits do not need `sudo`.

## 4. Create ecoku.env {#env}

Create `ecoku.env` in the format below. Wrap every value in single quotes so Compose does not expand the `$` characters in the bcrypt hash as variables:

```ini
TZ='Asia/Shanghai'
ECOKU_ADMIN_USERNAME='admin'
ECOKU_ADMIN_PASSWORD_HASH='$2a$10$...'
ECOKU_ADMIN_TOKEN_KEY='...'
ECOKU_NOTIFICATION_ENCRYPTION_KEY='...'
```

Then make it readable and writable only by you:

```bash
chmod 600 ~/Ecoku/ecoku.env
```

| Variable | What to enter |
| --- | --- |
| `TZ` | Time zone for comments and notifications, as an IANA name such as `Asia/Shanghai` or `Asia/Tokyo`. |
| `ECOKU_ADMIN_USERNAME` | Admin sign-in username, 1 to 80 characters. |
| `ECOKU_ADMIN_PASSWORD_HASH` | bcrypt hash of the admin password, never the plain password. Generate it with the command below. |
| `ECOKU_ADMIN_TOKEN_KEY` | Signing key for admin sessions, at least 32 characters. Generate it with the command below. Changing it invalidates all signed-in sessions. |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | Encrypts the SMTP password, Telegram bot token, and CAPTCHA secret key stored in the database; 32 bytes, Base64-encoded. Generate it with the command below. |

Generate the password hash. The password is not echoed while you type it; put the whole `$2a$10$...` output into `ECOKU_ADMIN_PASSWORD_HASH`:

```bash
read -rsp 'Admin password: ' P; echo
printf '%s\n' "$P" | sudo docker run --rm -i git.via.moe/dejavu/ecoku:v0.2.8 hash-password
unset P
```

Generate the two keys. Run each command once and paste its output into the matching variable:

```bash
openssl rand -hex 32      # ECOKU_ADMIN_TOKEN_KEY
openssl rand -base64 32   # ECOKU_NOTIFICATION_ENCRYPTION_KEY
```

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
