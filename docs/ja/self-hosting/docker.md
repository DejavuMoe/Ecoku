# Docker デプロイ

この手順は v0.3.0 以降の公開版と GHCR イメージを対象とします。既存環境では先に [アップグレード](./upgrade) を確認してください。

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
    image: "ghcr.io/dejavumoe/ecoku:v0.3.0"
    init: true
    restart: unless-stopped
    container_name: ecoku
    environment:
      TZ: Asia/Shanghai
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

現在の実装で有効な項目、既定値、選択肢、例をまとめたテンプレートです。`instance_public_url` を Ecoku 自体の HTTPS URL に変更し、それ以外の有効な値は既定のまま使えます。コメント内の代入は任意の上書き設定です。必要な場合だけ有効にし、記載に従ってマウントやポートも変更してください。

<div class="config-template">

<<< ../../../deploy/config.ja.yaml.example{yaml}

</div>

コンテナの非 root ユーザーから設定を読み取れるようにします：

```bash
chmod 644 ~/Ecoku/app/config.yaml
```

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

管理画面を開く前に、[Ecoku ドメインの HTTPS リバースプロキシ設定](./reverse-proxy)に従って Caddy または Nginx を設定し、公開ヘルスエンドポイントへのアクセスを確認してください。公開ポートは既定でホストのループバックにだけバインドされ、インターネットから直接は開けません。

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

## タイムゾーン {#timezone}

上記の Compose には、コメントと通知の表示時刻用に `TZ: Asia/Shanghai` が設定済みです。変更する場合は `services.ecoku.environment.TZ` を `Europe/Berlin` などに書き換え、`sudo docker compose up -d` でコンテナを再作成してください。別途 `ecoku.env` を作る必要はありません。

既存のインスタンスは元の `ecoku.env` を引き続き使えます。古い管理者認証情報とキー変数を削除する場合は、[永続状態への取り込み、停止・バックアップ、旧変数の削除](./upgrade#legacy-config)に従ってください。タイムゾーンも旧環境ファイルにある場合は、削除前に `TZ` を Compose に移してください。

## 次の手順

1. 管理画面で[最初のサイトを作成](./admin#sites)し、接続に使うサイト ID を取得します。
2. [HTML 接続手順](../integration/html)に従い、ブログにコメント欄を埋め込みます。
3. [バックアップと復元](./backup)に従い、設定、データベース、永続キーをバックアップします。

Twikoo の履歴を移行する場合は、先にサイトを作成してから[Twikoo 移行](./twikoo)を実行してください。
