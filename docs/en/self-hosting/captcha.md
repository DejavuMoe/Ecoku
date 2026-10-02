# CAPTCHA

Ecoku can require visitors to pass a CAPTCHA before posting a comment, and the admin to pass one before signing in. Choose one of three modes on the **Security** (安全) page of the admin console:

| Mode | Description |
| --- | --- |
| Off (关闭) | No verification widget is shown. Spam is held back only by [rate limits](../reference/configuration#rate-limit). |
| Cloudflare Turnstile | A hosted verification service from Cloudflare. Requires a Cloudflare account. |
| Cap | An open-source verification service you can self-host. Requires you to deploy your own Cap instance. |

This setting applies to the whole instance. All sites and admin sign-in use the same mode.

## How verification works

- When the browser submits a comment or signs in, it attaches a one-time token. The server verifies it with Turnstile or Cap before processing the request any further. Verification happens before the blogger passphrase is checked, so nobody can probe the passphrase without passing verification.
- If verification fails, the token is missing, or the verification service times out or is unavailable, the request is rejected. It is never let through automatically, and Ecoku does not fall back to the other mode.
- When verifying, the server sends only the token and the secret key. It does not include the visitor's IP address.
- Secret keys are encrypted with the notification master key in `data/ecoku-secrets.json` before storage in the database. The master key is generated on first startup. The admin console only shows 「已设置，输入新值以更换」 (set; enter a new value to replace it). Back up the database and key file together.
- When you switch modes or turn verification off, the settings already entered for the other mode are kept, so you do not have to enter them again when you switch back.

## Cloudflare Turnstile

1. On the Turnstile page of the Cloudflare dashboard, create a new widget.
2. Add all of your blog domains (such as `blog.example.com`) to the Hostname list, plus the Ecoku domain (such as `ecoku.example.com`, needed for the admin sign-in page).
3. Choose the widget mode you prefer. Ecoku renders the widget so that it appears only when interaction is needed, at no more than 300px wide.
4. Copy the Sitekey and Secret key. On the **Security** (安全) page of the admin console, select Cloudflare Turnstile, enter them, and save.

Official documentation: [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)

## Cap

[Cap](https://trycap.dev/) ([GitHub](https://github.com/tiagozip/cap)) is an open-source verification service that you can deploy on your own server. Ecoku loads the verification widget and WebAssembly files from your Cap instance, and verifies tokens against it.

The Cap instance URL must be a **publicly reachable HTTPS URL**. Addresses such as `localhost` or private-network IPs are rejected when you save.

### Deploy Cap

The example below runs Cap and the Valkey server it depends on with Docker Compose in `~/capjs`. Cap listens only on `127.0.0.1:3000` on the local machine, and a reverse proxy provides HTTPS.

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

### Enable Cap in Ecoku

1. Open `https://cap.example.com` and sign in to the Cap admin panel with the `ADMIN_KEY` from `.env`.
2. Create a new key, add your blog domains and the Ecoku domain to its list of allowed hosts, and note the Site key and Secret key.
3. On the **Security** (安全) page of the Ecoku admin console, select Cap and fill in:
   - **Instance URL** (实例地址): `https://cap.example.com`, with no trailing `/`;
   - **Site key** and **Secret key**.
4. After saving, open a post and the admin sign-in page, and confirm that the verification widget completes normally.

### Content Security Policy {#csp}

When Cap is enabled, Ecoku adjusts the admin console's CSP automatically: it allows the Cap instance's origin, WebAssembly, `blob:` workers, and the `'unsafe-eval'` needed by the Cap 3.x runtime instrumentation script. When you switch to Turnstile or turn verification off, these allowances are withdrawn immediately.

If your blog pages set their own CSP, you must also allow the verification widget there:

| Mode | Your blog page's CSP must allow |
| --- | --- |
| Turnstile | Add `https://challenges.cloudflare.com` to `script-src` and `frame-src`. |
| Cap | Add the Cap instance origin (such as `https://cap.example.com`) to `script-src` and `connect-src`, plus `worker-src blob:` and `frame-src 'self'`, and allow WebAssembly (`'wasm-unsafe-eval'`). |

If the Cap key has instrumentation (runtime detection) enabled, `script-src` also needs `'unsafe-eval'`; `'wasm-unsafe-eval'` cannot replace it. If you do not want to allow it, turn off instrumentation in Cap, or use Turnstile instead.

If your blog uses a nonce-based CSP, set `window.CAP_SCRIPT_NONCE` and `window.CAP_CSS_NONCE` to the same nonce before loading Ecoku. The scripts and styles that the Cap widget inserts will carry it.

## Turn off verification when you cannot sign in {#disable}

If the verification service is misconfigured or unreachable, the admin may be unable to sign in. In that case, turn verification off from the command line on the server:

```bash
cd ~/Ecoku
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku captcha status
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```

After turning it off, sign in with your username and password, fix the settings on the **Security** (安全) page, and enable verification again. The saved Sitekey and Secret key are not cleared.
