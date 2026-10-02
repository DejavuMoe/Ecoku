# ローカル開発

ローカル開発用の Go、Node.js、pnpm はリポジトリ直下の `mise.toml` で固定し、Corepack は使用しません。CI とコンテナビルドは、同じバージョンの公式 Node/Go イメージを直接使用し、mise はインストールしません。本番デプロイは引き続き Docker Compose を使用します。

## セットアップ

```bash
mise install
pnpm install --frozen-lockfile
cp server/config.yaml.example server/config.yaml
mkdir -p server/data
```

マシン固有のビルド成果物、実行データ、一時的なリリース検証は、Git が無視するルートの `tmp/` に置き、ソースディレクトリには書き込まないでください。

ローカルサービスは SQLite ファイルと `server/config.yaml` を使用します。管理画面は常に有効なので、サーバーを起動する前に管理者の認証情報を現在の shell に設定してください。コミットはしないでください。下の例のログインパスワードは `local-dev-password` です。

```bash
export ECOKU_ADMIN_USERNAME=admin
export ECOKU_ADMIN_PASSWORD_HASH="$(printf '%s\n' 'local-dev-password' | (cd server && go run . hash-password))"
export ECOKU_ADMIN_TOKEN_KEY="$(openssl rand -hex 32)"
```

管理画面で SMTP パスワード、Telegram Bot Token、CAPTCHA のシークレットキーを保存する場合は、`ECOKU_NOTIFICATION_ENCRYPTION_KEY` も設定します（`openssl rand -base64 32` で生成できます）。

## 起動

```bash
(cd server && go run .)
pnpm -C packages/client dev
ECOKU_ADMIN_DEV_API_URL=http://127.0.0.1:12123 pnpm -C packages/admin dev
pnpm docs:dev
```

必要なコマンドを別々のターミナルで実行してください。

サーバーは `http://127.0.0.1:12123` で待ち受け、データベースは `server/data/ecoku.bin` に保存します。ソースからの実行は API のみを提供します。コメント欄と管理画面にはそれぞれ Vite 開発サーバーを使い、Docker イメージはビルド済みの静的ページを提供します。

完全な検証は Woodpecker が実行します。ローカルでは、現在の変更に直接関係し、CI がカバーしない検証だけを実行します。

開発用管理画面のオリジン（設定例では `http://localhost:5174`）は独立した `admin.allowed_origins` に書く必要があり、開発画面は Vite の同一オリジン `/api` プロキシ経由でサーバーにアクセスします。明示的な HTTP localhost/ループバックのみ非 Secure Cookie を使い、本番は HTTPS が必要です。
