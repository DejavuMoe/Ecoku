# Docker デプロイ

::: info アップグレードと設定移行
このページは v0.2.9 のデプロイ手順です。v0.2.8 を更新する前に[アップグレードと旧設定の移行](./upgrade#legacy-config)を確認してください。既存のインスタンスは古い `ecoku.env` と Compose をそのまま使えます。新しいログインを確認してから古い環境変数を削除します。
:::

新規デプロイに必要なのは `compose.yaml`、`app/config.yaml`、`data/` だけです。Ecoku は初回起動時に管理者パスワード、セッション署名キー、通知暗号化マスターキーを自動生成します。

## 始める前に

Docker Engine と Compose v2 が入った Linux ホスト、`ecoku.example.com` のような専用ドメイン、公開 HTTPS を終端するリバースプロキシを用意します。`instance_public_url` は自分で設定してください。Ecoku は信頼できない Host や転送ヘッダーから管理画面のオリジンを推測しません。

```text
~/Ecoku/
├── compose.yaml
├── app/config.yaml
└── data/
    ├── ecoku.sqlite3
    ├── ecoku.sqlite3-wal
    ├── ecoku.sqlite3-shm
    └── ecoku-secrets.json
```

`data/` のファイルは Ecoku が作成します。データベースと永続キーを一緒にバックアップしてください。

## 1. ディレクトリを準備する

コンテナは UID/GID `10001:10001` で動作し、書き込めるのはマウントした `data` だけです。

```bash
mkdir -p ~/Ecoku/app ~/Ecoku/data
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
```

## 2. compose.yaml を作成する

```yaml
services:
  ecoku:
    image: "git.via.moe/dejavu/ecoku:v0.2.9"
    init: true
    restart: unless-stopped
    container_name: ecoku
    ports:
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
      - ./data:/data
    deploy:
      resources:
        limits:
          memory: 384M
    read_only: true
    tmpfs:
      - /tmp:rw,noexec,nosuid,nodev,size=16m
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--output-document=-", "http://127.0.0.1:12123/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    stop_grace_period: 30s
```

コンテナ内のポートは `12123` 固定です。ホスト側を変える場合はコロンの前だけを変更します。例：`"127.0.0.1:8080:12123"`。ログは標準出力に出力し、`docker compose logs` で確認します。保存とローテーションは Docker が管理します。

## 3. app/config.yaml を作成する {#config}

```yaml
notifications:
  instance_public_url: "https://ecoku.example.com"
```

```bash
chmod 644 ~/Ecoku/app/config.yaml
```

リバースプロキシ設定後、訪問者のアドレスでレート制限する場合は `site.trusted_proxies` を追加します。[リバースプロキシ](./reverse-proxy#trusted-proxies)を参照してください。それ以外はデフォルトで動作します。

## 4. 起動する

```bash
cd ~/Ecoku
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
```

初回起動時に SQLite を初期化し、`admin` を作成し、一度だけ使えるランダムな仮パスワードをログに出力します。セッション署名キーと通知暗号化マスターキーは `data/ecoku-secrets.json` に保存します。再起動しても仮パスワードやキーは変わりません。Docker ログを読める人は仮パスワードを見られるため、ログイン後に変更してください。

```bash
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

## 5. 初回ログイン

`https://ecoku.example.com/admin/` を開き、ユーザー名 `admin` と初回ログの仮パスワードでログインします。その後、必ず正式なパスワードを設定します。

- `admin` を維持するか、別のユーザー名に変更できます。
- 12 文字以上、UTF-8 で 72 バイト以下にします。
- 仮パスワードは再利用できません。
- 設定が終わるまでサイト、コメント、通知、セキュリティ画面には進めません。

保存すると仮セッションを無効にし、既存の「站点」（サイト）画面を「新增站点」（サイト追加）状態で開きます。

仮パスワードを失った場合はサービスを停止して本機でリセットします。

```bash
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d
```

新しい仮パスワードが表示され、すべての管理者セッションが無効になります。

## タイムゾーン

新規デプロイでは `ecoku.env` は不要です。コメントと通知の表示タイムゾーンを指定する場合は Compose サービスに追加します。

```yaml
    environment:
      TZ: Asia/Shanghai
```

既存インスタンスは古い `ecoku.env` を使い続けられます。アップグレード時に管理者認証情報とキーを永続状態へ取り込みます。[アップグレード](./upgrade#legacy-config)を参照してください。

## 次の手順

1. [リバースプロキシを設定](./reverse-proxy)して `https://ecoku.example.com` を公開する。
2. 「站点」（サイト）で最初のサイトを作成する。
3. [コメントクライアントを埋め込む](../integration/html)。

Twikoo の履歴を移行する場合は、先にサイトを作成してから[Twikoo 移行](./twikoo)を実行してください。
