# CAPTCHA

CAPTCHA confirms that a human is acting before a visitor posts a comment and before you sign in to the admin console. Choose one of three modes on the **Security** page of the admin console; it applies to all sites and to admin sign-in at the same time:

| Mode | Description |
| --- | --- |
| Off | No verification widget is shown; only [rate limits](../reference/configuration#rate-limit) hold back spam |
| Cloudflare Turnstile | Cloudflare's hosted service; requires a Cloudflare account |
| Cap | An open-source, self-hosted verification service; you deploy your own instance |

If verification fails or isn't completed, or the verification service times out or is unavailable, the request is rejected, never let through automatically. So when the verification service has problems, you can't sign in to the admin console either; in that case, see [Turn off verification](#disable).

When verifying with the service, Ecoku sends only the token and the Secret Key, without the visitor IP. The Secret Key is stored encrypted in the database and is never shown again in the admin console. When you switch modes, the other mode's settings are kept.

## Cloudflare Turnstile

1. On the Turnstile page of the Cloudflare dashboard, create a new widget.
2. Add all of your blog domains to Hostname, plus the Ecoku domain (needed for the admin sign-in page).
3. Copy the Sitekey and Secret key. On the **Security** page of the Ecoku admin console, select Cloudflare Turnstile, enter them and save.
4. Open a post and the admin sign-in page, and confirm that verification completes.

Ecoku shows the widget only when interaction is needed; in the comment section it is no more than 300px wide. See the [Cloudflare Turnstile documentation](https://developers.cloudflare.com/turnstile/).

## Cap

[Cap](https://trycap.dev/) ([GitHub](https://github.com/tiagozip/cap)) is an open-source verification service. Ecoku loads the widget and WebAssembly files from your Cap instance and verifies tokens against it.

The Cap URL must be a publicly reachable HTTPS URL. `localhost` and private-network IPs can't be saved. A domain that resolves to a private address can be saved, but Ecoku won't connect to it, so verification always fails.

### Deploy Cap

If you don't have a Cap instance yet, you can deploy one with Docker Compose using the example below.

:::: details Deploy Cap with Docker Compose

The example below runs Cap and the Valkey server it depends on with Docker Compose in `~/capjs`. Cap listens only on local `127.0.0.1:3000`, and a reverse proxy provides HTTPS.

```bash
mkdir -p ~/capjs/data && cd ~/capjs
sudo install -d -o 1000 -g 1000 -m 750 data/cap
sudo install -d -o 999 -g 1000 -m 750 data/valkey
```

Write `compose.yml`:

```bash
cd ~/capjs

cat <<'EOF' > compose.yml
services:
  cap:
    image: tiago2/cap:3.1.8
    restart: unless-stopped
    init: true
    stop_grace_period: 30s
    depends_on:
      valkey:
        condition: service_healthy
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      ADMIN_KEY: ${ADMIN_KEY:?ADMIN_KEY is required}
      REDIS_URL: redis://valkey:6379
      SERVER_PORT: "3000"
      CORS_ORIGIN: ${CORS_ORIGIN:?CORS_ORIGIN is required}
      ENABLE_ASSETS_SERVER: "true"
      WIDGET_VERSION: ${WIDGET_VERSION:?WIDGET_VERSION is required}
      WASM_VERSION: ${WASM_VERSION:?WASM_VERSION is required}
    volumes:
      - ./data/cap:/usr/src/app/data
    networks:
      - public
      - data
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    tmpfs:
      - /tmp:rw,noexec,nosuid,nodev,size=64m
    healthcheck:
      test:
        - CMD
        - bun
        - -e
        - "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 20s

  valkey:
    image: valkey/valkey:9.1.1-alpine
    restart: unless-stopped
    stop_grace_period: 30s
    user: "${VALKEY_UID:?VALKEY_UID is required}:${VALKEY_GID:?VALKEY_GID is required}"
    command:
      - valkey-server
      - --save
      - "60"
      - "1"
      - --appendonly
      - "yes"
      - --appendfsync
      - everysec
      - --loglevel
      - warning
      - --maxmemory-policy
      - noeviction
    volumes:
      - ./data/valkey:/data
    networks:
      - data
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    tmpfs:
      - /tmp:rw,noexec,nosuid,nodev,size=32m
    healthcheck:
      test:
        - CMD
        - valkey-cli
        - ping
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 5s

networks:
  public:
  data:
    internal: true
EOF
```

Write `.env`. Replace `ADMIN_KEY` with a random string (you can generate one with `openssl rand -hex 32`), and replace `CORS_ORIGIN` with your blog and Ecoku domains:

```bash
cd ~/capjs

cat <<'EOF' > .env
# Sign-in key for the Cap admin panel
ADMIN_KEY=replace-with-a-long-random-string
# Origins of pages that call Cap: all blog domains and the Ecoku domain, comma-separated
CORS_ORIGIN=https://blog.example.com,https://ecoku.example.com
# Versions of the widget and WebAssembly files served by Cap
WIDGET_VERSION=0.1.56
WASM_VERSION=0.0.7
VALKEY_UID=999
VALKEY_GID=1000
EOF

chmod 600 .env
sudo docker compose up -d
```

Use Caddy to provide HTTPS for Cap, for example at `cap.example.com`:

```caddyfile
cap.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

**Cap's admin page is public too.** This Caddy configuration proxies all of Cap, including its admin page. In addition to Cap's own `ADMIN_KEY`, add another layer of access control to the admin page and admin API, based on the routes of the Cap version you deploy. Visitors need access to the widget, WebAssembly and challenge endpoints, and the Ecoku server needs access to the token verification endpoint, so don't lock down the whole domain.

::::

### Enable Cap in Ecoku

1. Open `https://cap.example.com` and sign in to the Cap admin panel with the `ADMIN_KEY` from `.env`.
2. Create a new key, add your blog domains and the Ecoku domain to its allowed hosts, and note the Site key and Secret key.
3. On the **Security** page of the Ecoku admin console, select Cap, fill in the instance URL `https://cap.example.com`, the Site key and the Secret key, and save.
4. Refresh the admin console, then open a post and the admin sign-in page, and confirm that verification completes.

## CSP for blog pages {#csp}

The Ecoku admin console's CSP allows the selected verification service automatically; it takes effect after you refresh the admin console.

If your blog pages set their own CSP, allow the verification widget there:

| Mode | Your blog's CSP must allow |
| --- | --- |
| Turnstile | Add `https://challenges.cloudflare.com` to `script-src` and `frame-src` |
| Cap | Add the Cap instance origin to `script-src` and `connect-src`, plus `worker-src blob:`, `frame-src 'self'` and `'wasm-unsafe-eval'` |

If the Cap key has instrumentation (runtime detection) enabled, `script-src` also needs `'unsafe-eval'`. If you don't want to allow it, turn off instrumentation in Cap or use Turnstile instead.

If your blog uses a nonce-based CSP, set `window.CAP_SCRIPT_NONCE` and `window.CAP_CSS_NONCE` to the same nonce before loading Ecoku.

## Turn off verification when you can't sign in {#disable}

If the verification service is misconfigured or unreachable, you may be unable to sign in to the admin console. Turn verification off from the command line on the deployment host:

```bash
(
set -eu
cd ~/Ecoku
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d --wait --wait-timeout 120 ecoku
)
```

Then sign in with your username and password, fix the settings on the **Security** page and enable verification again. The saved Sitekey and Secret key are not cleared.
