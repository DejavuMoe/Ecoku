# Docker deployment

This guide covers public releases from v0.5.4 onward, using images from GHCR. For an existing instance, read [upgrading](./upgrade) first.

This guide starts from an empty Linux host and deploys Ecoku with Docker Compose. A new deployment needs only `compose.yaml`, `app/config.yaml` and the `data/` directory. First startup creates the administrator account and persistent keys; the reset command below prints the temporary password used to sign in. You do not write these credentials into a configuration file.

## Before you start

You need:

- a Linux host with Docker Engine and Compose, with `sudo` access; Compose must support `up --wait --wait-timeout` (check `docker compose up --help`);
- a domain dedicated to Ecoku, such as `ecoku.example.com`;
- a reverse proxy that terminates public HTTPS.

You must set `instance_public_url` yourself. Ecoku never derives the admin origin from an untrusted Host or forwarding header.

The deployment directory looks like this:

```text
~/Ecoku/
├── compose.yaml
├── app/
│   └── config.yaml
└── data/
    ├── ecoku.sqlite3
    ├── ecoku.sqlite3-wal
    ├── ecoku.sqlite3-shm
    └── ecoku-secrets.json
```

Ecoku creates the files in `data/`. Back up the database and the persistent keys together; see [backup and restore](./backup).

## 1. Prepare the directories

The container runs as UID/GID `10001:10001`; only the mounted `data` directory is writable:

```bash
mkdir -p ~/Ecoku/app ~/Ecoku/data
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
```

## 2. Create compose.yaml

```yaml
services:
  ecoku:
    image: "ghcr.io/dejavumoe/ecoku:v0.5.4"
    init: true
    restart: unless-stopped
    container_name: ecoku
    environment:
      TZ: Asia/Shanghai
      ECOKU_ADMIN_LOCALE: zh-CN
    ports:
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
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

The port is bound to `127.0.0.1` only. To use another host port, change only the part before the colon, such as `"127.0.0.1:8080:12123"`; the container port stays `12123`. To change the port the container listens on, follow the notes in the [configuration template](#config) and update `site.port`, the Compose container port and the health check together. Logs go to standard output. View them with `docker compose logs`; Docker handles retention and rotation.

## 3. Create app/config.yaml {#config}

The template below lists every setting with its default, allowed values and examples. Change `instance_public_url` to Ecoku's own HTTPS URL and keep the other uncommented values at their defaults. Commented assignments are optional overrides: uncomment them only when needed, and adjust mounts or ports as their comments describe.

<div class="config-template">

<<< ../../../deploy/config.en.yaml.example{yaml}

</div>

Let the container's non-root user read the configuration:

```bash
chmod 644 ~/Ecoku/app/config.yaml
```

## 4. Start and wait for initialization {#start}

```bash
(
set -eu
cd ~/Ecoku
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d --wait --wait-timeout 120
sudo docker compose ps
)
```

After the command succeeds, the container should be `healthy`. `--wait` waits up to 120 seconds for the health check to pass. If it fails or the container is unhealthy, run `sudo docker compose logs --tail=100 ecoku`, fix the error, and retry before resetting the password.

The first start initializes SQLite, creates the administrator `admin`, and saves the session signing key and notification encryption key in `data/ecoku-secrets.json`. Restarting neither resets the administrator password nor replaces the persistent keys.

## 5. Obtain the temporary administrator password {#temporary-password}

**This step is required for a new deployment. Since v0.5.2, startup logs do not print an initial password and there is no fixed default password.** Complete [startup and the health check](#start), then run this in a terminal on the deployment host:

```bash
(
set -eu
cd ~/Ecoku
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d --wait --wait-timeout 120
)
```

Find `管理员临时密码：…` in this command's terminal output and save the temporary password after the colon. The one-off `docker compose run` container prints it; `docker compose logs ecoku` reads the service container's logs and cannot retrieve it. If you lose it, repeat this step to generate a new password and invalidate the previous password and every administrator session. Do not forward the terminal output to shared logs or tickets.

If that line is missing, fix the command error before retrying; the command group above stops on failure. If it reports `管理员账户尚未初始化`, check the deployment directory, configuration, and data mounts. A new instance must complete [step 4](#start) first. Do not delete the database or persistent keys to fix this.

An existing instance with a permanent password does not need this step when upgrading. An older instance that has not completed its initial password change does: upgrading alone does not invalidate the temporary password in its old logs.

## 6. First sign-in {#first-sign-in}

First [obtain the temporary administrator password](#temporary-password), then follow [configure HTTPS reverse proxying for the Ecoku domain](./reverse-proxy) to set up Caddy or Nginx and confirm that the public health endpoint responds. By default the container listens only on the host's loopback port and cannot be reached directly from the internet. `notifications.instance_public_url` must match the actual admin origin; replace the example domain.

Open `https://ecoku.example.com/admin/` and sign in as `admin` with the temporary password printed by the command. The console then opens the 「设置你的密码」 (Set your password) page, which you must complete first:

- keep `admin` as the username or choose your own;
- the new password needs at least 12 characters and at most 72 UTF-8 bytes;
- the new password cannot be the temporary password;
- the sites, comments, notifications and security pages stay closed until you finish.

After you save, Ecoku revokes the temporary session and opens the 「新增站点」 (New site) form on the 「站点」 (Sites) page.

If you lose the temporary or permanent password, follow the same [administrator password reset steps](../reference/cli#admin-reset-password). The username stays as it was; sign in with it and the new temporary password, then set a password again.

## Time zone and admin language {#timezone}

The Compose file above sets `TZ: Asia/Shanghai` and `ECOKU_ADMIN_LOCALE: zh-CN`:

- `TZ` sets the time zone used for timestamps in the comments and in notifications. Use an IANA name such as `Asia/Shanghai` or `Europe/Berlin`.
- `ECOKU_ADMIN_LOCALE` sets the admin console language: `zh-CN`, `zh-Hant` or `en`. An unrecognized value is reported in the startup log and falls back to `zh-CN`.

After changing either value, run `sudo docker compose up -d` to recreate the container. You do not need a separate `ecoku.env`. The comment language is not set here: it comes from 「评论区语言」 (Comment language) in the admin site settings, and the loader's `data-i18n` attribute or the SDK `i18n` option in your embed code can override it.

Existing instances can keep their original `ecoku.env`. To remove the old administrator credentials and key variables, follow [import persistent state, stop and back up, then remove legacy variables](./upgrade#legacy-config). If the time zone is still in that environment file, move `TZ` into Compose before deleting the file.

## Next steps

1. [Create the first site](./admin#sites) in the admin console to get the site ID for your embed code.
2. Follow [HTML integration](../integration/html) to embed the comments in your blog.
3. Follow [backup and restore](./backup) to back up the configuration, the database and the persistent keys.

To import Twikoo history, create the site first and then follow [Twikoo migration](./twikoo).
