# Local development

Production is Docker Compose. Locally, use a SQLite file and `server/config.yaml`.

## Requirements

- Go 1.26+ (same as CI)
- Node.js 20.19+ / 22.12+ / 24+ and pnpm 11.3+
- Optional: [air](https://github.com/air-verse/air)

```bash
pnpm install --frozen-lockfile
cp server/config.yaml.example server/config.yaml
mkdir -p server/data
```

Point `client.static_dir` / `admin.static_dir` at the matching `dist` trees. Set `admin.enabled: true` to debug admin. Include `http://localhost:5173` in `admin.allowed_origins` and `http://localhost:3000` in the site’s `allowed_origins`.

## Environment

```bash
export ECOKU_ADMIN_USERNAME="dev-admin"
export ECOKU_ADMIN_PASSWORD_HASH="<bcrypt hash>"
export ECOKU_ADMIN_TOKEN_KEY="<32+ bytes hex>"
export ECOKU_NOTIFICATION_ENCRYPTION_KEY="<base64 32-byte key>"
```

```bash
printf 'your-password\n' | go run ./server hash-password
openssl rand -hex 32
openssl rand -base64 32
```

## Run

```bash
pnpm -C packages/client build
pnpm -C packages/admin build
cd server && go run .
# or: air
```

Default `http://127.0.0.1:12123`. Delete `server/data/` to reset.

Comments: `pnpm -C packages/client dev` (`http://localhost:3000`).

Admin:

```bash
export ECOKU_ADMIN_DEV_API_URL="http://127.0.0.1:12123"
pnpm -C packages/admin dev
```

Docs site: `pnpm docs:dev`.

CI owns the default gate. Local extras: `pnpm -C packages/<pkg> test`, `go test -count=1 ./...`, and approved prototype tests under `designs/**/*.test.mjs`.
