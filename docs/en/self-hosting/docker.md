# Docker

Single-container Docker Compose with SQLite. The container listens only on host `127.0.0.1:12123`; public HTTPS goes to Caddy or Nginx.

`registry.example.com` below is a placeholder for the image registry; replace it with your real repository.

## Prepare directories

You need Docker Engine, Compose v2, and an HTTPS domain. Use a dedicated directory per instance:

```bash
mkdir -p ~/Ecoku/app/logs ~/Ecoku/data
cd ~/Ecoku
touch app/config.yaml ecoku.env
```

The container runs as non-root user `10001:10001`:

```bash
sudo chown 10001:10001 app/config.yaml app/logs data
sudo chmod 640 app/config.yaml
sudo chmod 750 app/logs data
sudo chmod 600 ecoku.env
```

## Compose

Use the template that matches the image version. At minimum, check the image, port, and three mounts:

```yaml
services:
  ecoku:
    image: registry.example.com/ecoku:vX.Y.Z
    restart: unless-stopped
    env_file: ./ecoku.env
    ports:
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
      - ./app/logs:/var/log/ecoku
      - ./data:/data
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
```

Keep `read_only`, `tmpfs`, dropped capabilities, and the health check from the template. Do not use `latest`, and do not bind the port to `0.0.0.0`.

## Configuration

`app/config.yaml` must at least include:

```yaml
site:
  port: 12123
  log_path: /var/log/ecoku/ecoku.log
  trusted_proxies: []
notifications:
  encryption_key_env: ECOKU_NOTIFICATION_ENCRYPTION_KEY
  instance_public_url: https://comments.example.com
database:
  sqlite:
    path: /data/ecoku.sqlite3
admin:
  enabled: true
  allowed_origins:
    - https://comments.example.com
```

`trusted_proxies` and the reverse proxy are covered in [Reverse proxy](./reverse-proxy). `admin.allowed_origins` is for the admin UI and is separate from comment-site origins.

Optional: declare `management_key_env` for a site under YAML `sites[]`, and set the matching variable in `ecoku.env`. Management keys are only for trusted server-side automation and only apply to YAML-registered sites; sites created only in the admin UI have no management key. Never put a key in the page or browser.

## Secrets

`ecoku.env` (do not put values in public pages or Compose):

```dotenv
GIN_MODE=release
TZ=Asia/Shanghai
ECOKU_ADMIN_USERNAME=
ECOKU_ADMIN_PASSWORD_HASH=
ECOKU_ADMIN_TOKEN_KEY=
ECOKU_NOTIFICATION_ENCRYPTION_KEY=
```

Generate the admin password hash:

```bash
export ECOKU_IMAGE=registry.example.com/ecoku:vX.Y.Z
read -rsp 'Admin password: ' ECOKU_PASSWORD; echo
printf '%s\n' "$ECOKU_PASSWORD" | sudo docker run --rm -i --entrypoint /app/ecoku-server "$ECOKU_IMAGE" hash-password
unset ECOKU_PASSWORD
```

Write the output to `ECOKU_ADMIN_PASSWORD_HASH`. Generate the other secrets **separately**, and keep them distinct:

| Variable | Requirement | Example |
| --- | --- | --- |
| `ECOKU_ADMIN_TOKEN_KEY` | Random string of at least 32 characters | `openssl rand -hex 32` |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | Base64-encoded 32 bytes | `openssl rand -base64 32` |

## Start

```bash
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=200 ecoku
curl --fail http://127.0.0.1:12123/api/health
```

`healthy` only means the process can respond. Verify the admin UI and comment pages through the reverse proxy afterward.
