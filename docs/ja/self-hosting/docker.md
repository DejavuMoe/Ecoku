# Docker 導入

本番は Docker Compose + SQLite3 のみ。リポジトリ根の `compose.yaml` と `deploy/` を正とします。ドキュメントに合わせるためにポートやマウントを変えないでください。

## 前提

Linux、Docker Engine、Compose v2、OpenSSL、サーバを指す HTTPS ホスト名。イメージは正確なタグ：

```text
git.via.moe/dejavu/ecoku:<VERSION>
```

`latest` は使いません。一般運用ユーザー配下の例：

```bash
mkdir -p ~/Ecoku/app/logs ~/Ecoku/data ~/Ecoku/backups
cd ~/Ecoku
chmod 700 ./backups
```

```text
Ecoku/
├── app/
│   ├── config.yaml
│   └── logs/
├── backups/
├── compose.yaml
├── data/
└── ecoku.env
```

コンテナは UID/GID `10001:10001`。アップグレード時も `data/` はそのまま残します。

## テンプレート

デプロイする Git タグから `compose.yaml` と `deploy/config.yaml.example` をコピー。サービスポートは `127.0.0.1:12123`。公開インターネットはローカルリバースプロキシだけに当てます。3 つの bind マウントと `env_file: ./ecoku.env` を維持。

`app/config.yaml` では公開 URL と管理オリジンだけ変えます。

```yaml
notifications:
  instance_public_url: "https://comments.example.com"

admin:
  allowed_origins:
    - "https://comments.example.com"
```

残りは例のまま。訪問者単位の制限は [リバースプロキシ](/ja/self-hosting/reverse-proxy) を参照。

## 初回管理者

パスワードは argv、シェル履歴、ログに出しません。

```bash
ECOKU_IMAGE='git.via.moe/dejavu/ecoku:<VERSION>'

set +x
umask 077

read -rp 'Ecoku 管理者ユーザー名: ' ECOKU_ADMIN_USERNAME
read -rsp '管理者パスワード（表示されません）: ' ECOKU_PASSWORD_FIRST
echo
read -rsp 'もう一度: ' ECOKU_PASSWORD_SECOND
echo

test -n "$ECOKU_ADMIN_USERNAME" || { echo 'username required'; exit 1; }
test -n "$ECOKU_PASSWORD_FIRST" || { echo 'password required'; exit 1; }
test "$ECOKU_PASSWORD_FIRST" = "$ECOKU_PASSWORD_SECOND" || {
  echo 'passwords do not match'
  unset ECOKU_PASSWORD_FIRST ECOKU_PASSWORD_SECOND
  exit 1
}

ECOKU_ADMIN_PASSWORD_HASH="$(
  printf '%s\n' "$ECOKU_PASSWORD_FIRST" |
    sudo docker run --rm -i --entrypoint /app/ecoku-server \
      "$ECOKU_IMAGE" hash-password
)" || exit 1

ECOKU_ADMIN_TOKEN_KEY="$(openssl rand -hex 32)"
ECOKU_NOTIFICATION_ENCRYPTION_KEY="$(openssl rand -base64 32)"

{
  printf "GIN_MODE='release'\n"
  printf "TZ='Asia/Shanghai'\n"
  printf "ECOKU_ADMIN_USERNAME='%s'\n" "$ECOKU_ADMIN_USERNAME"
  printf "ECOKU_ADMIN_PASSWORD_HASH='%s'\n" "$ECOKU_ADMIN_PASSWORD_HASH"
  printf "ECOKU_ADMIN_TOKEN_KEY='%s'\n" "$ECOKU_ADMIN_TOKEN_KEY"
  printf "ECOKU_NOTIFICATION_ENCRYPTION_KEY='%s'\n" "$ECOKU_NOTIFICATION_ENCRYPTION_KEY"
} > ecoku.env

unset ECOKU_PASSWORD_FIRST ECOKU_PASSWORD_SECOND ECOKU_ADMIN_PASSWORD_HASH
unset ECOKU_ADMIN_TOKEN_KEY ECOKU_NOTIFICATION_ENCRYPTION_KEY ECOKU_IMAGE
```

`TZ` は IANA 名。未設定時は `Asia/Shanghai`。`app/config.yaml` には書かない。bcrypt 内の `$` を Compose が展開しないよう、値は単引用符。

```bash
sudo chown "$USER":10001 ./app/config.yaml
sudo chmod 0640 ./app/config.yaml
sudo chown "$USER":"$USER" ./ecoku.env
sudo chmod 0600 ./ecoku.env
sudo chown -R 10001:10001 ./app/logs ./data
sudo chmod 0750 ./app/logs ./data
sudo docker compose config --quiet
```

## 起動

```bash
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku

curl --fail http://127.0.0.1:12123/api/health
curl --fail --head http://127.0.0.1:12123/client/ecoku-loader.js
```

状態は `healthy` 必須。空 DB は全マイグレーションを順に実行。未知版やチェックサム不一致は起動を拒否します。

`/api/health` はプロセスが応答できることだけを示し、マイグレーション完了の証明ではありません。

次は [リバースプロキシ](/ja/self-hosting/reverse-proxy)、その後 [管理画面](/ja/self-hosting/admin) でサイトを作成します。
