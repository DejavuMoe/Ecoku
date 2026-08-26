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

ローカルサービスは SQLite ファイルと `server/config.yaml` を使用します。必要に応じて管理画面を有効化し、許可 Origin を調整してください。秘密値は設定例の名前と要件に従って現在の shell にだけ設定し、コミットしないでください。

初回起動前に、少なくともサンプルサイトの管理キーを設定します。

```bash
export ECOKU_EXAMPLE_SITE_MANAGEMENT_KEY="$(openssl rand -hex 32)"
```

## 起動

```bash
(cd server && go run .)
pnpm -C packages/client dev
ECOKU_ADMIN_DEV_API_URL=http://127.0.0.1:12123 pnpm -C packages/admin dev
pnpm docs:dev
```

必要なコマンドを別々のターミナルで実行してください。

サーバーの既定値は `http://127.0.0.1:12123`、コメント画面は `http://localhost:3000` です。Go から静的ファイルを配信する場合は、対象パッケージを先にビルドしてください。

完全な検証は Woodpecker が実行します。ローカルでは、現在の変更に直接関係し、CI がカバーしない検証だけを実行します。
