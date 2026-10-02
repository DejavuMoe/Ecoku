# ローカル開発

ローカル開発用の Go、Node.js、pnpm はリポジトリ直下の `mise.toml` で固定し、Corepack は使用しません。CI とコンテナビルドは、同じバージョンの公式 Node/Go イメージを直接使用し、mise はインストールしません。本番デプロイは引き続き Docker Compose を使用します。

## セットアップ

```bash
mise install
pnpm install --frozen-lockfile
cp server/config.yaml.example server/config.yaml
mkdir -p server/data
```

一時的なビルド成果物と検証ファイルは、Git が無視するルートの `tmp/` に置きます。開発用 DB と永続キーは設定に従って `server/data/` に保存されます。実行データはコミットしないでください。

ローカルでは SQLite と `server/config.yaml` を使います。新しい DB の初回起動時に `admin` を自動作成し、仮パスワードを端末に出力して、永続キーを `server/data/ecoku-secrets.json` に保存します。仮パスワードで管理画面にログインし、初回に変更してください。管理者認証情報や通知暗号化キーの環境変数を事前に設定する必要はありません。

既存の開発 DB では元の管理者アカウントを維持します。旧環境変数を使っていた場合は、永続状態への移行を終えてから削除してください。[旧設定の移行](../self-hosting/upgrade#legacy-config) を参照してください。

## 起動

```bash
(cd server && go run .)
pnpm -C packages/client dev
ECOKU_ADMIN_DEV_API_URL=http://127.0.0.1:12123 pnpm -C packages/admin dev
pnpm docs:dev
```

必要なコマンドを別々のターミナルで実行してください。

API はローカルの `http://127.0.0.1:12123` でアクセスでき、既定のポートは `12123` です。DB は `server/data/ecoku.bin`、永続キーは同じディレクトリの `ecoku-secrets.json` です。ソース実行では既定でブラウザ用の静的ファイルを配信しないため、コメント欄と管理画面は各 Vite 開発サーバーを使います。Docker イメージはビルド済みファイルを配信します。

完全な検証は Woodpecker が実行します。ローカルでは、現在の変更に直接関係し、CI がカバーしない検証だけを実行します。

開発用管理画面のオリジン（設定例では `http://localhost:5174`）は独立した `admin.allowed_origins` に書く必要があり、開発画面は Vite の同一オリジン `/api` プロキシ経由でサーバーにアクセスします。明示的な HTTP localhost/ループバックのみ非 Secure Cookie を使い、本番は HTTPS が必要です。
