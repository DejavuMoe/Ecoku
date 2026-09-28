# CAPTCHA

Ecoku では、訪問者がコメントを投稿する前と、管理者がログインする前に、CAPTCHA（人間確認）を 1 回通過するよう求めることができます。管理画面の「セキュリティ」（安全）ページで、次の 3 つから 1 つを選びます。

| 方式 | 説明 |
| --- | --- |
| 無効 | 検証ウィジェットを表示せず、[レート制限](../reference/configuration#rate-limit)だけでスパムを防ぎます。 |
| Cloudflare Turnstile | Cloudflare が提供するホスト型の検証サービスです。Cloudflare アカウントが必要です。 |
| Cap | オープンソースでセルフホストできる検証サービスです。Cap インスタンスを自分でデプロイする必要があります。 |

この設定はインスタンス全体に適用され、すべてのサイトと管理画面ログインで同じ方式を使います。

## 検証の仕組み

- ブラウザはコメントの投稿時やログイン時に使い捨ての token を付けて送り、サーバーは Turnstile または Cap に確認してから処理を続けます。この確認はブロガーの合言葉のチェックより前に行われるため、検証を通過しないと合言葉を試すことはできません。
- 確認に失敗した場合、token がない場合、検証サービスがタイムアウトしたり利用できなかったりした場合、リクエストはいずれも拒否されます。自動的に通過させることも、別の方式に切り替えることもありません。
- サーバーが確認するときに送るのは token と Secret Key だけで、訪問者の IP は付けません。
- Secret Key は `ECOKU_NOTIFICATION_ENCRYPTION_KEY` で暗号化してデータベースに保存され、管理画面には「設定済み」（已设置）とだけ表示されます。このキーを設定していないと、CAPTCHA の設定は保存できません。
- 方式を切り替えたり無効にしたりしても、もう一方の方式に入力済みの設定は保持されるため、元に戻すときに入力し直す必要はありません。

## Cloudflare Turnstile

1. Cloudflare ダッシュボードの Turnstile ページで、ウィジェット（widget）を新規作成します。
2. Hostname の一覧に、すべてのブログのドメイン（例：`blog.example.com`）と Ecoku のドメイン（例：`ecoku.example.com`。管理画面のログインページで必要です）を追加します。
3. ウィジェットのモードは必要に応じて選びます。Ecoku はウィジェットを「操作が必要な場合にのみ表示」する方式で描画し、幅は 300px を超えません。
4. Sitekey と Secret key をコピーし、管理画面の「セキュリティ」（安全）ページで Cloudflare Turnstile を選んで入力し、保存します。

公式ドキュメント：[Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)

## Cap

[Cap](https://trycap.dev/)（[GitHub](https://github.com/tiagozip/cap)）は、自分のサーバーにデプロイできるオープンソースの検証サービスです。Ecoku は Cap インスタンスから検証ウィジェットと WebAssembly ファイルを読み込み、そのインスタンスで token を確認します。

Cap インスタンスのアドレスは、**インターネットからアクセスできる HTTPS アドレス**でなければなりません。`localhost` やプライベート IP などのアドレスは保存時に拒否されます。

### Cap をデプロイする

次の例では、`~/capjs` で Docker Compose を使って Cap とその依存先の Valkey を動かします。Cap はこのマシンの `127.0.0.1:3000` だけで待ち受け、HTTPS はリバースプロキシが提供します。

```bash
mkdir -p ~/capjs/data/cap ~/capjs/data/valkey && cd ~/capjs
sudo chown -R 999:1000 data/valkey
chmod 750 data/cap data/valkey
```

`compose.yml` を書きます。

```bash
cd ~/capjs

cat <<'EOF' > compose.yml
services:
  cap:
    image: tiago2/cap:3.1.8
    restart: unless-stopped
    init: true
    stop_grace_period: 30s
    depends_on:
      valkey:
        condition: service_healthy
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      ADMIN_KEY: ${ADMIN_KEY:?ADMIN_KEY is required}
      REDIS_URL: redis://valkey:6379
      SERVER_PORT: "3000"
      CORS_ORIGIN: ${CORS_ORIGIN:?CORS_ORIGIN is required}
      ENABLE_ASSETS_SERVER: "true"
      WIDGET_VERSION: ${WIDGET_VERSION:?WIDGET_VERSION is required}
      WASM_VERSION: ${WASM_VERSION:?WASM_VERSION is required}
    volumes:
      - ./data/cap:/usr/src/app/data
    networks:
      - public
      - data
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    tmpfs:
      - /tmp:rw,noexec,nosuid,nodev,size=64m
    healthcheck:
      test:
        - CMD
        - bun
        - -e
        - "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 20s

  valkey:
    image: valkey/valkey:9.1.1-alpine
    restart: unless-stopped
    stop_grace_period: 30s
    user: "${VALKEY_UID:?VALKEY_UID is required}:${VALKEY_GID:?VALKEY_GID is required}"
    command:
      - valkey-server
      - --save
      - "60"
      - "1"
      - --appendonly
      - "yes"
      - --appendfsync
      - everysec
      - --loglevel
      - warning
      - --maxmemory-policy
      - noeviction
    volumes:
      - ./data/valkey:/data
    networks:
      - data
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    tmpfs:
      - /tmp:rw,noexec,nosuid,nodev,size=32m
    healthcheck:
      test:
        - CMD
        - valkey-cli
        - ping
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 5s

networks:
  public:
  data:
    internal: true
EOF
```

`.env` を書きます。`ADMIN_KEY` はランダムな文字列（`openssl rand -hex 32` で生成できます）に、`CORS_ORIGIN` は自分のブログと Ecoku のドメインに置き換えてください。

```bash
cd ~/capjs

cat <<'EOF' > .env
# Cap 管理パネルのログインキー
ADMIN_KEY=replace-with-a-long-random-string
# Cap を呼び出すページのオリジン：すべてのブログのドメインと Ecoku のドメインをカンマ区切りで
CORS_ORIGIN=https://blog.example.com,https://ecoku.example.com
# Cap が配信するウィジェットと WebAssembly ファイルのバージョン
WIDGET_VERSION=0.1.56
WASM_VERSION=0.0.7
VALKEY_UID=999
VALKEY_GID=1000
EOF

chmod 600 .env
sudo docker compose up -d
```

Caddy で Cap に HTTPS を提供します（例：`cap.example.com`）。

```caddyfile
cap.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

### Ecoku で Cap を有効にする

1. `https://cap.example.com` を開き、`.env` の `ADMIN_KEY` で Cap の管理パネルにログインします。
2. key を新規作成し、ブログのドメインと Ecoku のドメインを許可するホストの一覧に追加して、Site key と Secret key を控えます。
3. Ecoku の管理画面の「セキュリティ」（安全）ページで Cap を選び、次を入力します。
   - **インスタンスのアドレス**（实例地址）：`https://cap.example.com`。末尾に `/` は付けません。
   - **Site key** と **Secret key**。
4. 保存したら、記事ページと管理画面のログインページを開き、検証ウィジェットを正常に完了できることを確認します。

### コンテンツセキュリティポリシー {#csp}

Cap を有効にすると、Ecoku は管理画面の CSP を自動で調整します。Cap インスタンスのオリジン、WebAssembly、`blob:` の Worker、そして Cap 3.x のランタイム検査スクリプトに必要な `'unsafe-eval'` を許可します。Turnstile に切り替えるか検証を無効にすると、これらの許可はすぐに取り消されます。

ブログのページで独自に CSP を設定している場合は、検証ウィジェットも許可する必要があります。

| 検証方式 | ブログのページの CSP で許可が必要なもの |
| --- | --- |
| Turnstile | `script-src` と `frame-src` に `https://challenges.cloudflare.com` を追加します。 |
| Cap | `script-src` と `connect-src` に Cap インスタンスのオリジン（例：`https://cap.example.com`）を追加し、`worker-src blob:`、`frame-src 'self'` を設定して、WebAssembly（`'wasm-unsafe-eval'`）を許可します。 |

Cap の key で instrumentation（ランタイム検査）を有効にしている場合は、`script-src` にさらに `'unsafe-eval'` が必要です。`'wasm-unsafe-eval'` では代わりになりません。許可したくない場合は、Cap で instrumentation を無効にするか、Turnstile を使ってください。

ブログで nonce ベースの CSP を使っている場合は、Ecoku を読み込む前に同じ nonce で `window.CAP_SCRIPT_NONCE` と `window.CAP_CSS_NONCE` を設定してください。Cap ウィジェットが挿入するスクリプトとスタイルにその nonce が付きます。

## ログインできないときに CAPTCHA を無効にする {#disable}

検証サービスの設定を誤ったり、検証サービスにアクセスできなくなったりすると、管理者が管理画面にログインできなくなることがあります。その場合は、サーバー上でコマンドラインから検証を無効にします。

```bash
cd ~/Ecoku
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku captcha status
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```

無効にした後はユーザー名とパスワードで管理画面にログインし、「セキュリティ」（安全）ページで設定を直してから再び有効にしてください。保存済みの Sitekey と Secret key は消去されません。
