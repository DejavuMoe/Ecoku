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

Local services use a SQLite file and `server/config.yaml`. Enable admin and adjust allowed origins when needed. Export secrets only in the current shell, following the names and requirements in the config example; never commit them.

Before the first start, set at least the example site's management key:

```bash
export ECOKU_EXAMPLE_SITE_MANAGEMENT_KEY="$(openssl rand -hex 32)"
```

## Run

```bash
(cd server && go run .)
pnpm -C packages/client dev
ECOKU_ADMIN_DEV_API_URL=http://127.0.0.1:12123 pnpm -C packages/admin dev
pnpm docs:dev
```

Run the commands you need in separate terminals.

The server defaults to `http://127.0.0.1:12123`; the comment client defaults to `http://localhost:3000`. Build a package first when Go needs to serve its static files.

Woodpecker runs the full gate. Locally, run only checks directly relevant to the change and not already covered by CI.
