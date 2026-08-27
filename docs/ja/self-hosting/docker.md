# Docker 導入

単一コンテナの Docker Compose。データベースは SQLite。コンテナはホストの `127.0.0.1:12123` のみを待ち受け、公開 HTTPS は Caddy または Nginx に任せます。

以下の `registry.example.com` はイメージレジストリのプレースホルダです。実際のリポジトリに置き換えてください。

## ディレクトリの準備

Docker Engine、Compose v2、HTTPS ドメインが必要です。インスタンスごとに専用ディレクトリを用意します。

```bash
mkdir -p ~/Ecoku/app/logs ~/Ecoku/data
cd ~/Ecoku
touch app/config.yaml ecoku.env
```

コンテナは非 root ユーザー `10001:10001` で動作します。

```bash
sudo chown 10001:10001 app/config.yaml app/logs data
sudo chmod 640 app/config.yaml
sudo chmod 750 app/logs data
sudo chmod 600 ecoku.env
```

## Compose

イメージ版に対応するテンプレートを使います。少なくともイメージ、ポート、3 つのマウントを確認してください。

```yaml
services:
  ecoku:
    image: registry.example.com/ecoku:vX.Y.Z
    restart: unless-stopped
    env_file: ./ecoku.env
    ports:
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
      - ./app/logs:/var/log/ecoku
      - ./data:/data
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
```

テンプレートの `read_only`、`tmpfs`、能力の破棄、ヘルスチェックは残してください。`latest` は使わず、ポートを `0.0.0.0` に bind しないでください。

## 設定

`app/config.yaml` には少なくとも次を含めます。

```yaml
site:
  port: 12123
  log_path: /var/log/ecoku/ecoku.log
  trusted_proxies: []
notifications:
  encryption_key_env: ECOKU_NOTIFICATION_ENCRYPTION_KEY
  instance_public_url: https://comments.example.com
database:
  sqlite:
    path: /data/ecoku.sqlite3
admin:
  enabled: true
  allowed_origins:
    - https://comments.example.com
```

`trusted_proxies` とリバースプロキシは [リバースプロキシ](./reverse-proxy) を参照。`admin.allowed_origins` は管理画面用で、コメントサイトのオリジンとは別に設定します。

任意：YAML の `sites[]` でサイトに `management_key_env` を宣言し、`ecoku.env` に対応する変数を置きます。management key は信頼できるサーバー側自動化専用で、YAML 登録サイトにだけ有効です。管理画面だけで作ったサイトに management key はありません。キーをページやブラウザに書かないでください。

## 秘密情報

`ecoku.env`（値を公開ページや Compose に書かない）：

```dotenv
GIN_MODE=release
TZ=Asia/Shanghai
ECOKU_ADMIN_USERNAME=
ECOKU_ADMIN_PASSWORD_HASH=
ECOKU_ADMIN_TOKEN_KEY=
ECOKU_NOTIFICATION_ENCRYPTION_KEY=
```

管理者パスワードのハッシュを生成します。

```bash
export ECOKU_IMAGE=registry.example.com/ecoku:vX.Y.Z
read -rsp 'Admin password: ' ECOKU_PASSWORD; echo
printf '%s\n' "$ECOKU_PASSWORD" | sudo docker run --rm -i --entrypoint /app/ecoku-server "$ECOKU_IMAGE" hash-password
unset ECOKU_PASSWORD
```

出力を `ECOKU_ADMIN_PASSWORD_HASH` に書き込みます。他の秘密は**それぞれ**生成し、互いに異なる値にしてください。

| 変数 | 要件 | 例 |
| --- | --- | --- |
| `ECOKU_ADMIN_TOKEN_KEY` | 32 文字以上の乱数文字列 | `openssl rand -hex 32` |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | Base64 エンコードした 32 バイト | `openssl rand -base64 32` |

## 起動

```bash
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=200 ecoku
curl --fail http://127.0.0.1:12123/api/health
```

`healthy` はプロセスが応答できることだけを示します。管理画面とコメントページはリバースプロキシ経由で確認してください。
