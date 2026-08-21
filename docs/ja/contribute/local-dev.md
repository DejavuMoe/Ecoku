# ローカル開発

本番は Docker Compose。ローカルは SQLite ファイルと `server/config.yaml`。

## 前提

- Go 1.26+（CI と同じ）
- Node.js 20.19+ / 22.12+ / 24+ と pnpm 11.3+
- 任意：[air](https://github.com/air-verse/air)

```bash
pnpm install --frozen-lockfile
cp server/config.yaml.example server/config.yaml
mkdir -p server/data
```

`client.static_dir` / `admin.static_dir` を対応する `dist` へ。管理を試すなら `admin.enabled: true`。`admin.allowed_origins` に `http://localhost:5173`、サイトの `allowed_origins` に `http://localhost:3000`。

## 環境変数

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

## 起動

```bash
pnpm -C packages/client build
pnpm -C packages/admin build
cd server && go run .
# または air
```

既定は `http://127.0.0.1:12123`。`server/data/` を消すとリセット。

コメント：`pnpm -C packages/client dev`。

管理：

```bash
export ECOKU_ADMIN_DEV_API_URL="http://127.0.0.1:12123"
pnpm -C packages/admin dev
```

文書サイト：`pnpm docs:dev`。

既定の門は Woodpecker。ローカルは CI がカバーしない箇所だけ：`pnpm -C packages/<pkg> test`、`go test -count=1 ./...`、承認済みプロトタイプの `designs/**/*.test.mjs`。
