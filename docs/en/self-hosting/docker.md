# Docker installation

These are the full production installation steps. Compared with the [quick start](../guide/quick-start), they add resource limits, configuration notes and troubleshooting. For an instance that is already running, see [Upgrading](./upgrade).

<div class="page-meta">
<div>

**You will**

- Run Ecoku with Docker Compose
- Get a temporary administrator password and sign in for the first time

</div>
<div>

**Before you start**

- A Linux host with Docker Engine and Compose v2.17+, and `sudo` access
- A domain used only by Ecoku, not shared with your blog
- Caddy or Nginx on the same host

</div>
</div>

When you're done, the deployment directory looks like this:

```text
~/Ecoku/
├── compose.yaml
├── app/
│   └── config.yaml
└── data/                  # created and written by Ecoku
    ├── ecoku.sqlite3
    ├── ecoku.sqlite3-wal
    ├── ecoku.sqlite3-shm
    └── ecoku-secrets.json
```

<div class="steps">

### Create the directories

The container runs as UID/GID `10001:10001`. Only `data/` needs to be writable:

```bash
mkdir -p ~/Ecoku/app ~/Ecoku/data
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
```

### Write compose.yaml

```yaml
services:
  ecoku:
    image: "ghcr.io/dejavumoe/ecoku:v0.6.3"
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
      test: ["CMD", "/app/ecoku-server", "healthcheck"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    stop_grace_period: 30s
```

- Pin an exact image version. Don't use `latest`.
- The port is bound to `127.0.0.1` only; outside traffic goes through the reverse proxy. To change the host port, change only the part before the colon.
- For `TZ` and `ECOKU_ADMIN_LOCALE`, see [Time zone and admin language](#timezone).

### Write app/config.yaml {#config}

A new deployment needs only one line:

```yaml
notifications:
  instance_public_url: "https://ecoku.example.com"
```

Replace the URL with Ecoku's own HTTPS URL (not your blog's), then let the container read the file:

```bash
chmod 644 ~/Ecoku/app/config.yaml
```

Every other setting has a default. For all options, see [Configuration file](../reference/configuration).

### Start {#start}

```bash
cd ~/Ecoku
sudo docker compose pull
sudo docker compose up -d --wait --wait-timeout 120
sudo docker compose ps
```

The last command should show `healthy`. The first start creates the database, the administrator account `admin`, and `data/ecoku-secrets.json`, which holds the keys.

If it doesn't become `healthy`, run `sudo docker compose logs --tail=100 ecoku` to see why. For common cases, see the [FAQ](../reference/faq#deploy).

### Get the temporary administrator password {#temporary-password}

Ecoku has no default password and never prints a password in its logs. Stop the service and generate a temporary password with a one-off command:

```bash
cd ~/Ecoku
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d --wait --wait-timeout 120
```

Find `管理员临时密码：…` (temporary administrator password) in the output and note what follows the colon. This line appears only in this command's terminal; `docker compose logs` can't show it. If you lose it, run the command again.

::: details It says 「管理员账户尚未初始化」 (administrator account not initialized)
The database the command opened has no account yet. Check that the current directory, `config.yaml` and `data/` belong to this instance. A new instance must finish the start step above first. Don't delete the database or `ecoku-secrets.json`.
:::

### Set up HTTPS

Set up Caddy or Nginx as described in [Reverse proxy and HTTPS](./reverse-proxy), and confirm that `https://ecoku.example.com/api/health` opens.

### First sign-in {#first-sign-in}

Open `https://ecoku.example.com/admin/`. The username is `admin` and the password is the temporary password from above.

After signing in, set a permanent password first: at least 12 characters, no more than 72 UTF-8 bytes, and different from the temporary password. You can change the username at the same time. After you save, the **New site** form opens; continue with [Site settings](../admin/sites).

</div>

## Time zone and admin language {#timezone}

Both are set under `environment` in `compose.yaml`. After changing them, run `sudo docker compose up -d` to apply.

| Variable | Purpose | Values |
| --- | --- | --- |
| `TZ` | Time zone for times shown in the comment section, the admin console and notifications | An IANA time zone name, such as `Asia/Shanghai` or `Europe/Berlin`. Defaults to `Asia/Shanghai`. |
| `ECOKU_ADMIN_LOCALE` | Admin console language | `zh-CN`, `zh-Hant` or `en`. Unrecognized values fall back to `zh-CN`. |

The comment section language is set separately for each site in the admin console; see [Site settings](../admin/sites).

## Next steps

<div class="cards">
<Card title="Register a site" link="/admin/sites" icon="globe">Add your blog in the admin console and get a site ID.</Card>
<Card title="Set up backups" link="/self-hosting/backup" icon="database">Back up the database and the key file together.</Card>
</div>
