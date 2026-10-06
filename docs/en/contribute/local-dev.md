# Local development

The root `mise.toml` pins Go, Node.js, and pnpm for local development; Corepack is not used. GitHub Actions installs the matching toolchains. Container builds and Woodpecker documentation deployment use official images without installing mise. Production deployment still uses Docker Compose.

## Set up

```bash
mise install
pnpm install --frozen-lockfile
cp server/config.yaml.example server/config.yaml
mkdir -p server/data
```

Keep one-off build outputs and verification files in the Git-ignored root `tmp/` directory. The server writes its development database and persistent keys to `server/data/` according to the configuration; do not commit runtime data.

Local services use SQLite and `server/config.yaml`. When starting a new database, Ecoku automatically creates `admin`, prints a temporary password in the terminal, and saves persistent keys to `server/data/ecoku-secrets.json`. Sign in with that password and change it on first login; no administrator or notification-key environment variables are required.

Existing development databases retain their administrator account. If you previously configured legacy environment variables, complete persistent-state migration before removing them; see [legacy configuration migration](../self-hosting/upgrade#legacy-config).

## Run

```bash
(cd server && go run .)
pnpm -C packages/client dev
ECOKU_ADMIN_DEV_API_URL=http://127.0.0.1:12123 pnpm -C packages/admin dev
pnpm docs:dev
```

Run the commands you need in separate terminals.

Source runs bind only to `127.0.0.1` by default. Access the API at `http://127.0.0.1:12123`; the default port is `12123`. The database is `server/data/ecoku.bin`, with `ecoku-secrets.json` in the same directory. Source runs do not serve browser assets by default; use the Vite development servers for the client and admin console. The Docker image serves built assets. Container mode (`ECOKU_RUNTIME=container`) continues to listen on all interfaces inside the container; Compose port mappings still control host exposure.

The client development demo uses the fixed local API URL `http://127.0.0.1:12123/`. URL query parameters cannot select or override the server address.

GitHub Actions runs the full gate. Locally, run only checks directly relevant to the change and not already covered by CI.

The admin development origin (`http://localhost:5174` in the example config) must be listed in the separate `admin.allowed_origins`; the development page reaches the server through the Vite same-origin `/api` proxy. Only explicitly allowed HTTP localhost/loopback origins get a non-Secure cookie; production requires HTTPS.
