# Docker Deployment

Ecoku runs as a hardened single container listening on `127.0.0.1:12123`. A host-level reverse proxy (Caddy / Nginx) terminates HTTPS.

> [!NOTE]
> `git.via.moe/dejavu/ecoku:v0.1.9` is the official release image. `ecoku.example.com` is a placeholder—replace it with your real domain.

---

## 1. Directory Structure & Permissions

Ecoku runs as non-root user `10001:10001` with a read-only root filesystem. On standard Linux systems, use `sudo install -d` to create directories and assign the required ownership and permissions in a single command:

```bash
# Enter deployment directory
mkdir -p ~/Ecoku && cd ~/Ecoku

# Create logs and data directories with UID/GID 10001 and 750 permissions
sudo install -d -o 10001 -g 10001 -m 750 app/logs data
```

---

## 2. Docker Compose Configuration

Write `compose.yaml` using `cat <<'EOF'`:

```bash
cd ~/Ecoku

cat <<'EOF' > compose.yaml
services:
  ecoku:
    image: "git.via.moe/dejavu/ecoku:v0.1.9"
    init: true
    restart: unless-stopped
    container_name: ecoku
    env_file:
      - ./ecoku.env
    ports:
      # Bind to local loopback only; do NOT expose 0.0.0.0
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

> [!IMPORTANT]
> - Never use floating tags like `latest` in production. Always specify an exact semantic version tag (e.g. `v0.1.9`).
> - Always bind the port to `127.0.0.1:12123` so requests must pass through your reverse proxy.

---

## 3. Configuration File `app/config.yaml`

Write the configuration file using `cat <<'EOF'` and set read-only permissions for the container:

```bash
cd ~/Ecoku

cat <<'EOF' > app/config.yaml
site:
  port: 12123
  # Logs always go to stdout; specify a file path to additionally keep rotated log files
  log_path: "/var/log/ecoku/ecoku.log"
  # Trusted reverse proxy IP or CIDR. When proxying via Caddy on host, set Docker gateway (e.g. 172.18.0.1/32).
  # An empty list means all visitors share one rate limit bucket. Never use 0.0.0.0/0.
  trusted_proxies: []

client:
  static_dir: "/app/client"

rate_limit:
  window_seconds: 60
  comment_submit: 5      # Comment submission rate limit (req/window)
  comment_delete: 30     # Comment deletion rate limit
  admin_login: 5         # Admin login rate limit
  notification_test: 5   # Notification test rate limit

notifications:
  # Environment variable name containing the master encryption key
  encryption_key_env: "ECOKU_NOTIFICATION_ENCRYPTION_KEY"
  # Public canonical URL of this instance (used for reply links in notifications)
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
  token_ttl_minutes: 480 # Admin session duration (8 hours)
  allowed_origins:
    # Exact allowed origin for the admin console
    - "https://ecoku.example.com"
EOF

# Ensure container non-root user (10001) has read permission
sudo chown 10001:10001 app/config.yaml
sudo chmod 640 app/config.yaml
```

---

## 4. Secrets Generation in `ecoku.env`

Create `ecoku.env`. The following idempotent script generates cryptographically strong random keys and appends them to your environment file without terminal echo. Special characters (such as `$` in bcrypt hashes and base64 characters) are enclosed in single quotes to prevent shell interpolation:

```bash
cd ~/Ecoku

# 1. Create sensitive environment file with restricted permissions (read/write for owner only)
touch ecoku.env
chmod 600 ecoku.env

# 2. Write general defaults (skipped if already present)
grep -q "^GIN_MODE=" ecoku.env || echo "GIN_MODE='release'" >> ecoku.env
grep -q "^TZ=" ecoku.env || echo "TZ='Asia/Shanghai'" >> ecoku.env
grep -q "^ECOKU_ADMIN_USERNAME=" ecoku.env || echo "ECOKU_ADMIN_USERNAME='admin'" >> ecoku.env

# 3. Interactively enter admin password and generate bcrypt hash (silent input, skipped if already set)
if ! grep -q "^ECOKU_ADMIN_PASSWORD_HASH=" ecoku.env; then
  read -rsp 'Enter admin password: ' ADMIN_PASS; echo
  HASH=$(printf '%s\n' "$ADMIN_PASS" | sudo docker run --rm -i --entrypoint /app/ecoku-server "git.via.moe/dejavu/ecoku:v0.1.9" hash-password)
  unset ADMIN_PASS
  echo "ECOKU_ADMIN_PASSWORD_HASH='$HASH'" >> ecoku.env
fi

# 4. Generate 64-character hex admin token key (silent, skipped if already set)
if ! grep -q "^ECOKU_ADMIN_TOKEN_KEY=" ecoku.env; then
  echo "ECOKU_ADMIN_TOKEN_KEY='$(openssl rand -hex 32)'" >> ecoku.env
fi

# 5. Generate 32-byte base64 master encryption key (silent, skipped if already set)
if ! grep -q "^ECOKU_NOTIFICATION_ENCRYPTION_KEY=" ecoku.env; then
  echo "ECOKU_NOTIFICATION_ENCRYPTION_KEY='$(openssl rand -base64 32)'" >> ecoku.env
fi
```

---

## 5. Launch & Verify

```bash
cd ~/Ecoku

# Validate Compose syntax
sudo docker compose config --quiet

# Pull image and start in background
sudo docker compose pull
sudo docker compose up -d

# Check status and logs
sudo docker compose ps
sudo docker compose logs --tail=100 -f ecoku
```

### Health Check

```bash
curl -fail http://127.0.0.1:12123/api/health
# Expected output: {"status":"ok"}
```

Next, configure your [Reverse Proxy](/en/self-hosting/reverse-proxy) to terminate HTTPS, or visit the [Admin Console](/en/self-hosting/admin) to register sites and set up your blogger passphrase.

---

## 6. Historical Data Import (Optional)

If you previously used Twikoo, you can migrate historical comments into Ecoku after completing this initial deployment.

> [!IMPORTANT]
> - **Initial Deployment Only**: The Twikoo import command (`import-twikoo`) **only supports target sites that have zero comments**.
> - If comments have already been submitted to the target site, the system strictly rejects import to preserve tree relationships, foreign key integrity, and ID continuity.
> - See [Twikoo Import](/en/self-hosting/twikoo) for details on the import workflow and dry-run verification.
