# Docker デプロイ

このページでは、何も入っていない Linux ホストから始めて、Docker Compose で Ecoku インスタンスを 1 つ起動します。用意するファイルは `compose.yaml`、`app/config.yaml`、`ecoku.env` の 3 つだけです。完了した時点では、サービスはこのマシンの `127.0.0.1:12123` からしかアクセスできません。インターネット向けの HTTPS は次の[リバースプロキシ](./reverse-proxy)で設定します。

## 始める前に

必要なもの：

- Docker Engine と Compose v2（`docker compose` コマンド）が入った Linux ホストと、`sudo` 権限。
- Ecoku 専用のドメイン（例：`ecoku.example.com`）。管理画面はこのドメインでアクセスし、ブログはこのドメインからコメント欄のスクリプトを読み込みます。ブログと同じドメインは使えません。理由は[手順 3](#config) を参照してください。
- HTTPS を終端するための、このホスト上で動く Caddy または Nginx。

このページに出てくる `ecoku.example.com` と `blog.example.com` はプレースホルダーです。自分のドメインに置き換えてください。イメージは現在のリリースバージョン `git.via.moe/dejavu/ecoku:v0.2.7` を使います。

デプロイ後のディレクトリ構成は次のとおりです。

```text
~/Ecoku/
├── compose.yaml        # コンテナ定義
├── ecoku.env           # 管理者の認証情報、シークレット、タイムゾーン（権限 600）
├── app/
│   ├── config.yaml     # インスタンス設定（読み取り専用でマウント）
│   └── logs/           # ログファイルのコピー
└── data/
    └── ecoku.sqlite3   # すべてのデータ：サイト、コメント、設定
```

## 1. ディレクトリを用意する

コンテナは UID/GID `10001:10001` で動作し、ルートファイルシステムは読み取り専用です。書き込めるのはマウントした `app/logs` と `data` だけです。デプロイ先のディレクトリと `app/` は自分のアカウントで作成するので、あとで設定を編集するときに `sudo` は不要です。`app/logs` と `data` は所有者をコンテナのユーザーにします。

```bash
mkdir -p ~/Ecoku/app && cd ~/Ecoku
sudo install -d -o 10001 -g 10001 -m 750 app/logs data
```

## 2. compose.yaml を作成する

`~/Ecoku` に次の内容で `compose.yaml` を作成します。

```yaml
services:
  ecoku:
    image: "git.via.moe/dejavu/ecoku:v0.2.7"
    init: true
    restart: unless-stopped
    container_name: ecoku
    env_file:
      - ./ecoku.env
    ports:
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
      - ./app/logs:/var/log/ecoku
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

コンテナ内のポート、ディレクトリ、ログ、データベースのパスはイメージに固定されており、上のマウントと対応しています。ホスト側の場所を変えたい場合は、コロンの前だけを変更します。たとえばポートを `"127.0.0.1:8080:12123"` に、データを `/srv/ecoku-data:/data` にします。

次の 2 か所は変更しないでください。

- **ポートは `127.0.0.1` にだけバインドします。**`12123:12123` と書くと、Docker がすべてのネットワークインターフェースでポートを開き、外部からリバースプロキシを経由せずに直接アクセスできてしまいます。レート制限も効かなくなります。
- **イメージには正確なバージョン番号を書きます。**`latest` は使わないでください。アップグレードするときはこの行を変更し、ロールバックするときは旧バージョン番号に戻します。詳しくは[アップグレード](./upgrade)を参照してください。

そのほかのオプションはコンテナの権限を絞るためのものです。`read_only` と `tmpfs` により、コンテナが書き込めるのは `/tmp`（16 MB）とマウントしたディレクトリだけになります。`cap_drop: ALL` と `no-new-privileges` はすべての Linux capability を取り除きます。`healthcheck` は 30 秒ごとにコンテナ内の `/api/health` にリクエストします。

## 3. app/config.yaml を作成する {#config}

`app/config.yaml` を作成します。書く必要があるのは Ecoku の公開 URL だけです。

```yaml
notifications:
  instance_public_url: "https://ecoku.example.com"
```

続いて権限を設定します。

```bash
chmod 644 ~/Ecoku/app/config.yaml
```

`instance_public_url` には 2 つの役割があります。

- 管理画面は、このアドレス（スキーム + ドメイン + 任意のポート）から送られたリクエストだけを受け付けます。つまり、管理画面を開いたときにブラウザのアドレスバーに表示されるオリジンです。これは**どのサイトの許可オリジンとも重複してはいけません**。管理画面でサイトを保存するときも、これと同じオリジンは拒否されます。Ecoku に専用ドメインが必要なのはこのためです。
- メールまたは Telegram の通知を有効にする前に必ず設定してください。設定していないと、管理画面で通知設定を保存するときに失敗します。

リバースプロキシを設定した後は、ここに `site.trusted_proxies` も追加します。[リバースプロキシ](./reverse-proxy#trusted-proxies)を参照してください。レート制限の回数などほかのフィールドにはデフォルト値があるので、必要になったら[設定リファレンス](../reference/configuration)に従って追加します。フィールド名を間違えると起動に失敗します。

`config.yaml` にはパスワードやシークレットが含まれないので、自分のアカウントの所有のまま権限 `644` にしておけば十分です。コンテナはこれを読み取り専用でマウントし、あとで変更するときも `sudo` は不要です。

## 4. ecoku.env を作成する {#env}

`ecoku.env` を次の形式で作成します。bcrypt ハッシュに含まれる `$` が Compose に変数として展開されないよう、各値はシングルクォートで囲みます。

```ini
TZ='Asia/Shanghai'
ECOKU_ADMIN_USERNAME='admin'
ECOKU_ADMIN_PASSWORD_HASH='$2a$10$...'
ECOKU_ADMIN_TOKEN_KEY='...'
ECOKU_NOTIFICATION_ENCRYPTION_KEY='...'
```

続いて、自分だけが読み書きできるように権限を設定します。

```bash
chmod 600 ~/Ecoku/ecoku.env
```

| 変数 | 設定する値 |
| --- | --- |
| `TZ` | コメントと通知の表示タイムゾーン。`Asia/Shanghai`、`Asia/Tokyo` のような IANA 名を指定します。 |
| `ECOKU_ADMIN_USERNAME` | 管理画面のログインユーザー名。1～80 文字。 |
| `ECOKU_ADMIN_PASSWORD_HASH` | 管理画面パスワードの bcrypt ハッシュ。平文のパスワードは書きません。下のコマンドで生成します。 |
| `ECOKU_ADMIN_TOKEN_KEY` | 管理者セッションの署名キー。32 文字以上。下のコマンドで生成します。変更すると、ログイン中のすべてのセッションが無効になります。 |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | データベース内の SMTP パスワード、Telegram Bot Token、CAPTCHA の Secret Key を暗号化します。Base64 でエンコードした 32 バイト。下のコマンドで生成します。 |

パスワードハッシュを生成します。入力は表示されません。出力された `$2a$10$...` の全体を `ECOKU_ADMIN_PASSWORD_HASH` に書きます。

```bash
read -rsp '管理者パスワード: ' P; echo
printf '%s\n' "$P" | sudo docker run --rm -i git.via.moe/dejavu/ecoku:v0.2.7 hash-password
unset P
```

2 つのキーを生成します。それぞれ 1 回実行し、出力を対応する変数に書きます。

```bash
openssl rand -hex 32      # ECOKU_ADMIN_TOKEN_KEY
openssl rand -base64 32   # ECOKU_NOTIFICATION_ENCRYPTION_KEY
```

::: danger マスターキーはデータベースと一緒にバックアップしてください
管理画面で SMTP、Telegram、CAPTCHA の認証情報を保存した後は、`ECOKU_NOTIFICATION_ENCRYPTION_KEY` がそれらを復号する唯一の鍵になります。キーを失ったり変更したりすると、Ecoku は起動時に復号できず、実行を拒否します。[バックアップ](./backup)では、`ecoku.env` を `data/` と同じアーカイブに入れる必要があります。
:::

## 5. 起動して確認する

```bash
cd ~/Ecoku
sudo docker compose config --quiet   # 構文を確認します。何も出力されなければ正常です
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
```

初回起動時、Ecoku は `data/ecoku.sqlite3` にデータベースを作成し、最新のスキーマまで初期化します。ログに `Server starting on :12123` が出れば、サービスは待ち受けを開始しています。

ホスト上でヘルスチェック API を確認します。

```bash
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

正常なら次のように返ります。

```json
{"code":200,"message":"Success","data":{"status":"healthy","timestamp":1790000000}}
```

ヘルスチェック API が示すのは、プロセスがリクエストに応答していることだけです。コンテナが再起動を繰り返す場合は、まず `docker compose logs` を確認してください。設定の誤り、空の環境変数、ディレクトリ権限の誤りは、いずれもログに原因が書かれます。よくあるケースは[よくある質問](./faq)を参照してください。

## 次のステップ

1. [リバースプロキシを設定](./reverse-proxy)し、インターネットから `https://ecoku.example.com` にアクセスできるようにします。
2. `https://ecoku.example.com/admin/` を開いて[管理画面にログイン](./admin)し、最初のサイトを登録します。
3. コメント欄を[ブログのページに埋め込み](../integration/html)ます。

Twikoo から過去のコメントを移行する場合は、手順 2 でサイトを登録した後、誰かが新しいコメントを投稿する前に済ませてください。[Twikoo からの移行](./twikoo)を参照してください。
