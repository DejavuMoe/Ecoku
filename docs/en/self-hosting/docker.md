# Docker deployment

::: warning Unreleased deployment flow
This page describes the next version. Before upgrading v0.2.8, read [upgrade and legacy configuration migration](./upgrade#unreleased-config). Existing deployments may keep their old `ecoku.env` and Compose file; remove the old environment variables only after the migration has completed and the new login works.
:::

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
    image: "git.via.moe/dejavu/ecoku:v0.2.8"
    init: true
    restart: unless-stopped
    container_name: ecoku
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

```yaml
notifications:
  instance_public_url: "https://ecoku.example.com"
```

```bash
chmod 644 ~/Ecoku/app/config.yaml
```

After configuring the reverse proxy, add `site.trusted_proxies` if you need rate limits to use the visitor address; see [Reverse proxy](./reverse-proxy#trusted-proxies). Everything else has a default.

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

## Time zone

A new deployment does not need `ecoku.env`. To set the display time zone for comments and notifications, add this optional environment entry to the Compose service:

```yaml
    environment:
      TZ: Asia/Shanghai
```

Existing deployments may keep their old `ecoku.env`. Its administrator credentials and keys are imported into persistent state during the upgrade; see [upgrade](./upgrade#unreleased-config).

## Next steps

1. [Configure the reverse proxy](./reverse-proxy) for `https://ecoku.example.com`.
2. Create the first site in **Sites**.
3. [Embed the comment client](../integration/html).

To import Twikoo history, create the site first and then follow [Twikoo migration](./twikoo).
