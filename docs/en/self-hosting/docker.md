# Docker Deployment

Ecoku runs as a hardened single container listening on `127.0.0.1:12123`. A host-level reverse proxy (Caddy / Nginx) terminates HTTPS.

---

## 1. Directory Structure & Permissions

Ecoku runs as non-root user `10001:10001` with a read-only root filesystem:

```bash
mkdir -p ~/Ecoku/app/logs ~/Ecoku/data
cd ~/Ecoku
touch app/config.yaml ecoku.env

# Assign permissions to UID/GID 10001
sudo chown -R 10001:10001 app/logs data app/config.yaml
sudo chmod 750 app/logs data
sudo chmod 640 app/config.yaml
sudo chmod 600 ecoku.env
```

---

## 2. Docker Compose Configuration

Create `~/Ecoku/compose.yaml`:

```yaml
services:
  ecoku:
    image: registry.example.com/ecoku:v0.1.8
    container_name: ecoku
    restart: unless-stopped
    read_only: true
    user: "10001:10001"
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    env_file:
      - ./ecoku.env
    ports:
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
      - ./app/logs:/var/log/ecoku
      - ./data:/data
    tmpfs:
      - /tmp:rw,noexec,nosuid,size=64m
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:12123/api/health | grep -q 'ok' || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

---

## 3. Configuration File `app/config.yaml`

```yaml
site:
  port: 12123
  log_path: "/var/log/ecoku/ecoku.log"
  trusted_proxies: []

client:
  static_dir: "/app/client"

rate_limit:
  window_seconds: 60
  comment_submit: 5
  comment_delete: 30
  admin_login: 5
  notification_test: 5

notifications:
  encryption_key_env: "ECOKU_NOTIFICATION_ENCRYPTION_KEY"
  instance_public_url: "https://comments.example.com"

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
    - "https://comments.example.com"
```

---

## 4. Secrets in `ecoku.env`

```dotenv
GIN_MODE=release
TZ=Asia/Shanghai
ECOKU_ADMIN_USERNAME=admin
ECOKU_ADMIN_PASSWORD_HASH=
ECOKU_ADMIN_TOKEN_KEY=
ECOKU_NOTIFICATION_ENCRYPTION_KEY=
```

### Key Generation

1. **Admin Bcrypt Password Hash**:
   ```bash
   export ECOKU_IMAGE=registry.example.com/ecoku:v0.1.8
   read -rsp 'Admin password: ' ECOKU_PASSWORD; echo
   printf '%s\n' "$ECOKU_PASSWORD" | sudo docker run --rm -i --entrypoint /app/ecoku-server "$ECOKU_IMAGE" hash-password
   unset ECOKU_PASSWORD
   ```
2. **Admin Token Key**: `openssl rand -hex 32`
3. **Master Encryption Key**: `openssl rand -base64 32`

---

## 5. Launch & Verify

```bash
sudo docker compose pull
sudo docker compose up -d
sudo docker compose logs --tail=100 ecoku
curl -f http://127.0.0.1:12123/api/health
```
