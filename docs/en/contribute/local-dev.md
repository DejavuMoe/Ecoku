# Local development

The root `mise.toml` pins Go, Node.js, and pnpm for local development; Corepack is not used. CI and container builds use matching official Node/Go images directly, without installing mise. Production deployment still uses Docker Compose.

## Set up

```bash
mise install
pnpm install --frozen-lockfile
cp server/config.yaml.example server/config.yaml
mkdir -p server/data
```

Keep machine-local build outputs, runtime data, and one-off release checks in the root `tmp/` directory, which Git ignores; do not write them into source directories.

Local services use a SQLite file and `server/config.yaml`. The admin console is always enabled, so export the admin credentials in the current shell before starting the server; never commit them. The sign-in password below is `local-dev-password`:

```bash
export ECOKU_ADMIN_USERNAME=admin
export ECOKU_ADMIN_PASSWORD_HASH="$(printf '%s\n' 'local-dev-password' | (cd server && go run . hash-password))"
export ECOKU_ADMIN_TOKEN_KEY="$(openssl rand -hex 32)"
```

To save an SMTP password, Telegram bot token, or CAPTCHA secret key in the admin console, also export `ECOKU_NOTIFICATION_ENCRYPTION_KEY` (generate one with `openssl rand -base64 32`).

## Run

```bash
(cd server && go run .)
pnpm -C packages/client dev
ECOKU_ADMIN_DEV_API_URL=http://127.0.0.1:12123 pnpm -C packages/admin dev
pnpm docs:dev
```

Run the commands you need in separate terminals.

The server listens at `http://127.0.0.1:12123` and stores its database at `server/data/ecoku.bin`. Source runs serve the API only; use the Vite development servers for the comment client and admin console. The Docker image serves the built assets.

Woodpecker runs the full gate. Locally, run only checks directly relevant to the change and not already covered by CI.

The admin development origin (`http://localhost:5174` in the example config) must be listed in the separate `admin.allowed_origins`; the development page reaches the server through the Vite same-origin `/api` proxy. Only explicitly allowed HTTP localhost/loopback origins get a non-Secure cookie; production requires HTTPS.
