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

Local services use SQLite and `server/config.yaml`. When starting a new database, Ecoku automatically creates `admin` and saves persistent keys to `server/data/ecoku-secrets.json`, without printing a password in the startup log. After the first startup completes, stop the service with Ctrl+C, run `(cd server && go run . admin reset-password)` to obtain a temporary password from the command output, and start the service again. Sign in with that password and change it on first login; no administrator or notification-key environment variables are required.

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

## Image migration checks {#image-migration}

Run the following checks in Linux with Go, Docker and Python 3 available.

These commands build a local candidate and test temporary volumes or bind directories. They do not publish images or access production data:

```bash
docker build -t ecoku:distroless-migration .
sh scripts/verify-image.sh ecoku:distroless-migration
previous=ghcr.io/dejavumoe/ecoku:v0.5.7@sha256:81962c68bf134c0d9fcbc9b5bc0c189b6c886f0f2e5a81fc5fed91b0f8bac847
docker pull "$previous"
sh scripts/verify-image.sh ecoku:distroless-migration "$previous"
```

The script checks the non-root identity, read-only root, certificates, time zones, assets, admin login and graceful shutdown. The second run creates temporary comments and encrypted notification credentials in v0.5.7, adds a comment after upgrading, rolls back and compares existing data, schema and persistent keys. It removes its containers, volumes and temporary directories on exit. The root Compose file has been updated to v0.6.1 and uses the built-in binary healthcheck probe; local candidate validations use the new probe as well.

## Documentation diagrams {#documentation-diagrams}

The diagrams in Introduction and Reverse proxy use local SVGs in `docs/public/diagrams/`. Mermaid runs neither during the build nor in the browser. File names combine the diagram name, locale, and `light` / `dark`; both theme variants share the same nodes, edges, and canvas dimensions, and the page theme controls which is displayed.

To change a diagram, edit or re-export its SVGs and update all three languages, both themes, and the alternative text in Markdown. Keep SVGs self-contained, without external fonts, images, or scripts. Use `pnpm docs:dev` to check labels, edges, theme switching, and horizontal scrolling with the keyboard or touch on narrow screens.

`node docs/.vitepress/diagrams.test.mjs` checks asset references, alternative text, and consistency between theme variants across the six pages. It also rejects leftover Mermaid code blocks. This check is part of the documentation build.
