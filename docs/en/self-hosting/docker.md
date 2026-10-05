# Docker deployment

This guide covers public releases from v0.3.4 onward, using images from GHCR. For an existing instance, read [upgrading](./upgrade) first.

This guide starts from an empty Linux host and deploys Ecoku with Docker Compose. A new deployment needs only three things: `compose.yaml`, `app/config.yaml` and `data/`. The administrator's temporary password, the session signing key and the notification encryption key are all generated on the first start; you do not write them into any configuration file.

## Before you start

You need:

- a Linux host with Docker Engine, Compose v2 and `sudo` access;
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
    image: "ghcr.io/dejavumoe/ecoku:v0.3.4"
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

The port is bound to `127.0.0.1` only. To use another host port, change only the part before the colon, such as `"127.0.0.1:8080:12123"`; the container port is always `12123`. Logs go to standard output. View them with `docker compose logs`; Docker handles retention and rotation.

## 3. Create app/config.yaml {#config}

The template below lists every setting with its default, allowed values and examples. Change `instance_public_url` to Ecoku's own HTTPS URL and keep the other uncommented values at their defaults. Commented assignments are optional overrides: uncomment them only when needed, and adjust mounts or ports as their comments describe.

<div class="config-template">

<<< ../../../deploy/config.en.yaml.example{yaml}

</div>

Let the container's non-root user read the configuration:

```bash
chmod 644 ~/Ecoku/app/config.yaml
```

## 4. Start

```bash
cd ~/Ecoku
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
```

On the first start, Ecoku:

1. initializes the SQLite database and runs the migrations;
2. creates the administrator `admin`;
3. generates a one-time random temporary password and prints it to the log;
4. saves the session signing key and the notification encryption key in `data/ecoku-secrets.json`.

The log line reads `Ecoku 首次启动管理员账户：admin；临时密码：…；请登录后台后立即修改密码`. The temporary password is generated only when the account is first created. Restarting does not generate a new password or replace the persistent keys. Anyone who can read the Docker logs can see the temporary password; it stops working once you set your own password on first sign-in.

Check the health endpoint:

```bash
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

## 5. First sign-in

Before opening the admin console, follow [configure HTTPS reverse proxying for the Ecoku domain](./reverse-proxy) to set up Caddy or Nginx, and confirm that the public health endpoint responds. By default the container listens only on the host's loopback port and cannot be reached directly from the internet.

Open `https://ecoku.example.com/admin/` and sign in as `admin` with the temporary password from the first-start log. The console then opens the 「设置你的密码」 (Set your password) page, which you must complete first:

- keep `admin` as the username or choose your own;
- the new password needs at least 12 characters and at most 72 UTF-8 bytes;
- the new password cannot be the temporary password;
- the sites, comments, notifications and security pages stay closed until you finish.

After you save, Ecoku revokes the temporary session and opens the 「新增站点」 (New site) form on the 「站点」 (Sites) page.

If you lose the temporary or permanent password, stop the service and run the reset command on the host:

```bash
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d
```

The command prints `管理员临时密码：…` and signs out every administrator session. The username stays as it was; sign in with it and the new temporary password, then set a password again.

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
