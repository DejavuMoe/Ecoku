# Docker 導入

Ecoku はシングルコンテナの Docker Compose 構成で動作し、`127.0.0.1:12123` でリクエストを待ち受けます。HTTPS はリバースプロキシ（Caddy / Nginx）で終端します。

> [!NOTE]
> `git.via.moe/dejavu/ecoku:v0.2.1` は公式リリースイメージです。`ecoku.example.com` はプレースホルダーですので、実際のドメインに置き換えてください。

---

## 1. ディレクトリと権限

Ecoku コンテナは非 root ユーザー `10001:10001`、読み取り専用ルートファイルシステムで実行されます。主要な Linux 環境では、`sudo install -d` を使用して、1 つのコマンドでディレクトリを作成し、必要な所有権と権限を設定できます。

```bash
# デプロイ先ディレクトリに移動
mkdir -p ~/Ecoku && cd ~/Ecoku

# logs と data ディレクトリを一度に作成し、UID/GID 10001 と 750 権限を設定
sudo install -d -o 10001 -g 10001 -m 750 app/logs data
```

---

## 2. Compose 設定の記述

`cat <<'EOF'` を使用して `compose.yaml` を作成します：

```bash
cd ~/Ecoku

cat <<'EOF' > compose.yaml
services:
  ecoku:
    image: "git.via.moe/dejavu/ecoku:v0.2.1"
    init: true
    restart: unless-stopped
    container_name: ecoku
    env_file:
      - ./ecoku.env
    ports:
      # ローカルループバックのみにバインドし、0.0.0.0 には公開しない
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
      - ./app/logs:/var/log/ecoku
      - ./data:/data
    deploy:
      resources:
        limits:
          memory: 384M
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
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
EOF
```

> [!IMPORTANT]
> - 本番環境では `latest` などの変動タグを**絶対に使用しないでください**。必ず具体的なセマンティックバージョニングタグ（例：`v0.2.1`）を指定してください。
> - リバースプロキシを経由させるため、コンテナポートは必ず `127.0.0.1:12123` にバインドしてください。

---

## 3. 設定ファイル `app/config.yaml`

`cat <<'EOF'` を使用して設定ファイルを作成し、コンテナからの読み取り権限を設定します：

```bash
cd ~/Ecoku

cat <<'EOF' > app/config.yaml
site:
  port: 12123
  # ログは常に stdout に出力されます。通常のファイルパスを指定すると、プロセス内でローテーション保存も行われます
  log_path: "/var/log/ecoku/ecoku.log"
  # 信頼するリバースプロキシの IP または CIDR。ホストの Caddy から転送する場合は Docker ゲートウェイ（例: 172.18.0.1/32）を指定します
  # 空リストの場合は全訪問者で 1 つのレート制限バケットを共有します。0.0.0.0/0 は禁止です
  trusted_proxies: []

client:
  static_dir: "/app/client"

rate_limit:
  window_seconds: 60
  comment_submit: 5      # コメント投稿レート制限（回/ウィンドウ）
  comment_list: 60       # コメント一覧取得レート制限（回/ウィンドウ）
  comment_delete: 30     # コメント削除レート制限
  admin_login: 5         # 管理者ログインレート制限
  notification_test: 5   # 通知テスト送信レート制限

notifications:
  # データベース暗号化マスターキーの環境変数名
  encryption_key_env: "ECOKU_NOTIFICATION_ENCRYPTION_KEY"
  # インスタンスの公開正規 URL（通知メール内の返信リンクに使用）
  instance_public_url: "https://ecoku.example.com"

database:
  sqlite:
    path: "/data/ecoku.sqlite3"

admin:
  enabled: true
  static_dir: "/app/admin"
  username_env: "ECOKU_ADMIN_USERNAME"
  password_hash_env: "ECOKU_ADMIN_PASSWORD_HASH"
  token_key_env: "ECOKU_ADMIN_TOKEN_KEY"
  token_ttl_minutes: 480 # 管理者セッション有効期間（8 時間）
  allowed_origins:
    # 管理画面へのアクセスを許可する正確な Origin
    - "https://ecoku.example.com"
EOF

# コンテナ内の非 root ユーザー（10001）が読み取れるように所有権と権限を設定
sudo chown 10001:10001 app/config.yaml
sudo chmod 640 app/config.yaml
```

---

## 4. 環境変数と秘密鍵の生成 `ecoku.env`

`ecoku.env` ファイルを作成します。以下のスクリプトを実行することで、暗号学的に安全なランダムキーを自動生成し、環境変数に追加できます。

この処理は**冪等性**を備えています。各項目が既に存在する場合は自動的にスキップされ、重複実行しても上書きされません。ランダムキーはターミナルに**エコーされません**。パスワードハッシュは非表示の対話型入力で生成されます。環境変数の値に特殊文字（bcrypt の `$` や Base64 文字など）が含まれていても、自動的にシングルクォートで囲まれるため、シェルや Compose による誤展開を防止します：

```bash
cd ~/Ecoku

# 1. 秘密環境変数ファイルを作成し、安全な権限（所有者のみ読み書き可能）を設定
touch ecoku.env
chmod 600 ecoku.env

# 2. 汎用デフォルト変数を書き込み（既に存在する場合はスキップ）
grep -q "^GIN_MODE=" ecoku.env || echo "GIN_MODE='release'" >> ecoku.env
grep -q "^TZ=" ecoku.env || echo "TZ='Asia/Shanghai'" >> ecoku.env
grep -q "^ECOKU_ADMIN_USERNAME=" ecoku.env || echo "ECOKU_ADMIN_USERNAME='admin'" >> ecoku.env

# 3. 管理者パスワードを対話型で入力し、Bcrypt ハッシュを生成して書き込み（入力非表示、既に存在する場合はスキップ）
if ! grep -q "^ECOKU_ADMIN_PASSWORD_HASH=" ecoku.env; then
  read -rsp '管理者パスワードを入力: ' ADMIN_PASS; echo
  HASH=$(printf '%s\n' "$ADMIN_PASS" | sudo docker run --rm -i --entrypoint /app/ecoku-server "git.via.moe/dejavu/ecoku:v0.2.1" hash-password)
  unset ADMIN_PASS
  echo "ECOKU_ADMIN_PASSWORD_HASH='$HASH'" >> ecoku.env
fi

# 4. 64 文字の 16 進数管理者 Token 署名キーを自動生成（エコーなし、既に存在する場合はスキップ）
if ! grep -q "^ECOKU_ADMIN_TOKEN_KEY=" ecoku.env; then
  echo "ECOKU_ADMIN_TOKEN_KEY='$(openssl rand -hex 32)'" >> ecoku.env
fi

# 5. 32 バイト Base64 マスター暗号化キーを自動生成（通知・認証情報の暗号化用、エコーなし、既に存在する場合はスキップ）
if ! grep -q "^ECOKU_NOTIFICATION_ENCRYPTION_KEY=" ecoku.env; then
  echo "ECOKU_NOTIFICATION_ENCRYPTION_KEY='$(openssl rand -base64 32)'" >> ecoku.env
fi
```

---

## 5. 起動と検証

```bash
cd ~/Ecoku

# Compose 設定の構文を検証
sudo docker compose config --quiet

# イメージを取得してバックグラウンドで起動
sudo docker compose pull
sudo docker compose up -d

# コンテナの状態とログを確認
sudo docker compose ps
sudo docker compose logs --tail=100 -f ecoku
```

### ヘルスチェックの検証

```bash
curl -fail http://127.0.0.1:12123/api/health
# 期待される出力: {"code":200,"message":"success","data":{"status":"healthy","timestamp":...}}
```

次に、フロントエンドの [リバースプロキシ](/ja/self-hosting/reverse-proxy) を設定して HTTPS を終端し、公開転送を行ってください。または [管理画面設定](/ja/self-hosting/admin) でサイトとブロガー身元を登録してください。

---

## 6. 過去コメントのインポート（任意）

以前に Twikoo を使用していた場合、初期デプロイ完了後に既存のコメントを Ecoku に移行できます。

> [!IMPORTANT]
> - **初期デプロイ直後のみ対応**：Twikoo インポートコマンド（`import-twikoo`）は、**登録済みかつコメントが 0 件の初期ターゲットサイトに対してのみ実行可能**です。
> - ターゲットサイトに既に新しいコメントが投稿されている場合、ツリー関係・親子参照整合性・コメント ID の連続性を保護するため、システムは**インポートを拒否**します。
> - 詳細な移行手順や検証方法については、[Twikoo コメントインポート](/ja/self-hosting/twikoo) を参照してください。
