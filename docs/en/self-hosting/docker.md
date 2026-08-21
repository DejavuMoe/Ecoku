# Docker

Production is Docker Compose + SQLite3 only. Treat the repo-root `compose.yaml` and `deploy/` templates as source of truth. Do not change ports or mounts “to match the docs”.

## Requirements

Linux, Docker Engine, Compose v2, OpenSSL, and an HTTPS hostname pointing at the server. Pin the image tag:

```text
git.via.moe/dejavu/ecoku:<VERSION>
```

Do not use `latest`. Suggested layout under a regular ops user:

```bash
mkdir -p ~/Ecoku/app/logs ~/Ecoku/data ~/Ecoku/backups
cd ~/Ecoku
chmod 700 ./backups
```

```text
Ecoku/
├── app/
│   ├── config.yaml
│   └── logs/
├── backups/
├── compose.yaml
├── data/
└── ecoku.env
```

The container runs as UID/GID `10001:10001`. Keep `data/` intact across upgrades.

## Templates

Copy `compose.yaml` and `deploy/config.yaml.example` from the Git tag you deploy. The service port is bound to `127.0.0.1:12123`; the public internet should only reach a local reverse proxy. Keep the three bind mounts (`./app/config.yaml`, `./app/logs`, `./data`) and `env_file: ./ecoku.env`.

In `app/config.yaml` change only the public URL and admin origins:

```yaml
notifications:
  instance_public_url: "https://comments.example.com"

admin:
  allowed_origins:
    - "https://comments.example.com"
```

Leave the rest as in the example. Rate limits default to the container’s direct peer address. For per-visitor limits see [Reverse proxy](/en/self-hosting/reverse-proxy).

## First admin

Passwords never appear in argv, shell history, or logs:

```bash
ECOKU_IMAGE='git.via.moe/dejavu/ecoku:<VERSION>'

set +x
umask 077

read -rp 'Ecoku admin username: ' ECOKU_ADMIN_USERNAME
read -rsp 'Admin password (input hidden): ' ECOKU_PASSWORD_FIRST
echo
read -rsp 'Repeat password: ' ECOKU_PASSWORD_SECOND
echo

test -n "$ECOKU_ADMIN_USERNAME" || { echo 'username required'; exit 1; }
test -n "$ECOKU_PASSWORD_FIRST" || { echo 'password required'; exit 1; }
test "$ECOKU_PASSWORD_FIRST" = "$ECOKU_PASSWORD_SECOND" || {
  echo 'passwords do not match'
  unset ECOKU_PASSWORD_FIRST ECOKU_PASSWORD_SECOND
  exit 1
}

ECOKU_ADMIN_PASSWORD_HASH="$(
  printf '%s\n' "$ECOKU_PASSWORD_FIRST" |
    sudo docker run --rm -i --entrypoint /app/ecoku-server \
      "$ECOKU_IMAGE" hash-password
)" || exit 1

ECOKU_ADMIN_TOKEN_KEY="$(openssl rand -hex 32)"
ECOKU_NOTIFICATION_ENCRYPTION_KEY="$(openssl rand -base64 32)"

{
  printf "GIN_MODE='release'\n"
  printf "TZ='Asia/Shanghai'\n"
  printf "ECOKU_ADMIN_USERNAME='%s'\n" "$ECOKU_ADMIN_USERNAME"
  printf "ECOKU_ADMIN_PASSWORD_HASH='%s'\n" "$ECOKU_ADMIN_PASSWORD_HASH"
  printf "ECOKU_ADMIN_TOKEN_KEY='%s'\n" "$ECOKU_ADMIN_TOKEN_KEY"
  printf "ECOKU_NOTIFICATION_ENCRYPTION_KEY='%s'\n" "$ECOKU_NOTIFICATION_ENCRYPTION_KEY"
} > ecoku.env

unset ECOKU_PASSWORD_FIRST ECOKU_PASSWORD_SECOND ECOKU_ADMIN_PASSWORD_HASH
unset ECOKU_ADMIN_TOKEN_KEY ECOKU_NOTIFICATION_ENCRYPTION_KEY ECOKU_IMAGE
```

`TZ` is an IANA name for comment timestamps; unset falls back to `Asia/Shanghai`. Do not put `TZ` in `app/config.yaml`. Quote env values so Compose does not interpolate `$` inside bcrypt hashes.

```bash
sudo chown "$USER":10001 ./app/config.yaml
sudo chmod 0640 ./app/config.yaml
sudo chown "$USER":"$USER" ./ecoku.env
sudo chmod 0600 ./ecoku.env
sudo chown -R 10001:10001 ./app/logs ./data
sudo chmod 0750 ./app/logs ./data
sudo docker compose config --quiet
```

## Start

```bash
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku

curl --fail http://127.0.0.1:12123/api/health
curl --fail --head http://127.0.0.1:12123/client/ecoku-loader.js
```

Status must be `healthy`. An empty database runs every migration in order; unknown versions or checksum mismatches refuse to start.

Follow logs with `sudo docker compose logs -f ecoku`. `/api/health` only means the process can answer, not that migrations finished.

Next: [reverse proxy](/en/self-hosting/reverse-proxy), then create a site in [admin](/en/self-hosting/admin).
