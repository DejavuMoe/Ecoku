# Docker deployment

This guide covers public releases from v0.3.1, using GHCR images. For an existing instance, read [upgrading](./upgrade) first.

A new Docker deployment needs `compose.yaml`, `app/config.yaml`, and `data/`. Ecoku creates the administrator password, session signing key, and notification encryption key on the first start.

## Before you start

You need a Linux host with Docker Engine and Compose v2, a separate domain such as `ecoku.example.com`, and a reverse proxy that terminates public HTTPS. Set `instance_public_url` yourself; Ecoku never derives the trusted admin origin from an untrusted Host or forwarding header.

```text
~/Ecoku/
├── compose.yaml
├── app/config.yaml
└── data/
    ├── ecoku.sqlite3
    ├── ecoku.sqlite3-wal
    ├── ecoku.sqlite3-shm
    └── ecoku-secrets.json
```

Ecoku creates the files in `data/`. Back up the database and the persistent secrets together.

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
    image: "ghcr.io/dejavumoe/ecoku:v0.3.1"
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

The container port remains `12123`. To change the host port, change only the part before the colon, such as `"127.0.0.1:8080:12123"`. Logs go to standard output; view them with `docker compose logs`, and let Docker control retention and rotation.

## 3. Create app/config.yaml {#config}

This template collects supported settings, defaults, allowed values and examples from the current implementation. Replace `instance_public_url` with Ecoku’s own HTTPS URL; the other active values are defaults. Commented assignments are optional overrides. Uncomment only when needed and adjust mounts or ports as documented.

<div class="config-template">

<<< ../../../deploy/config.en.yaml.example{yaml}

</div>

Allow the container’s non-root user to read the configuration:

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

On the first start Ecoku initializes SQLite, creates the `admin` account, prints a one-time random temporary password, and writes the session signing key and notification encryption key to `data/ecoku-secrets.json`. Restarting does not generate another password or replace the keys. Anyone who can read Docker logs can see the temporary password; change it after signing in.

Check the health endpoint:

```bash
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

## 5. First sign-in

Before opening the console, follow [configure HTTPS reverse proxying for the Ecoku domain](./reverse-proxy) to set up Caddy or Nginx and check the public health endpoint. The container’s published port is bound to host loopback by default and cannot be opened directly from the internet.

Open `https://ecoku.example.com/admin/`. Sign in as `admin` with the temporary password from the first-start log. You must then set a permanent password:

- keep `admin` or choose another username;
- use at least 12 characters and no more than 72 UTF-8 bytes;
- do not reuse the temporary password;
- no sites, comments, notifications, or security settings are available before this step.

After saving, Ecoku revokes the temporary session and opens the existing **Sites** page directly in **Create site** mode.

If the temporary password is lost, stop the service and reset it locally:

```bash
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d
```

The command prints a new temporary password and revokes all administrator sessions.

## Time zone {#timezone}

The Compose file above sets `TZ: Asia/Shanghai` and `ECOKU_ADMIN_LOCALE: zh-CN`. The first controls comment and notification timestamps; the second controls the admin language and accepts `zh-Hant` or `en`. Recreate the container after changing it. Set the site comment language in the admin site’s 「评论区语言」 field; the SDK `i18n` option overrides the site default. No separate `ecoku.env` is needed.

Existing instances can keep their original `ecoku.env`. To remove old administrator credentials and key variables, follow [import persistent state, stop and back up, then remove legacy variables](./upgrade#legacy-config). If the time zone is still in that environment file, move `TZ` into Compose before deleting the file.

## Next steps

1. [Create the first site](./admin#sites) in the console to obtain its site ID.
2. Follow [HTML integration](../integration/html) to embed comments in your blog.
3. Follow [backup and restore](./backup) to back up configuration, the database, and persistent keys.

To import Twikoo history, create the site first and then follow [Twikoo migration](./twikoo).
