# よくある質問

問題が起きたら、まずコンテナのログを確認してください。起動時のエラーのほとんどは、ここに原因が書かれています。

```bash
cd ~/Ecoku
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
```

## デプロイと起動

### コンテナが再起動を繰り返し、ログに permission denied と出る

コンテナは UID/GID `10001:10001` で動作し、`app/config.yaml` を読めること、`data/` と `app/logs/` に書き込めることが必要です。所有者と権限を直してから再起動します。

```bash
cd ~/Ecoku
sudo chown -R 10001:10001 data app/logs
sudo chmod 750 data app/logs
sudo chown "$(id -u):$(id -g)" app app/config.yaml
chmod 644 app/config.yaml
sudo docker compose up -d
```

`app/config.yaml` にはシークレットが含まれないので、自分のアカウントの所有で問題ありません。あとで編集するときに `sudo` は不要です。

### app/config.yaml を編集しようとすると権限が足りないと表示される {#config-permission}

以前のデプロイ手順では、`app/` と `app/config.yaml` の所有者を root または UID 10001 にしていました。これらを自分のアカウントに戻すだけでよく、コンテナを作り直す必要はありません。

```bash
cd ~/Ecoku
sudo chown "$(id -u):$(id -g)" app app/config.yaml
chmod 755 app
chmod 644 app/config.yaml
```

### コンテナが再起動を繰り返し、ログに config.yaml is a directory と出る

起動前に `app/config.yaml` が存在しなかったため、Docker がその場所に空のディレクトリを作成しました。サービスを停止し、このディレクトリを削除してから、[Docker デプロイ](./docker)の手順 3 に従って設定ファイルを書き直して起動します。

```bash
cd ~/Ecoku
sudo docker compose down
sudo rmdir app/config.yaml
```

### サイトの保存時に「公开站点来源不能复用管理端来源」と表示される

（公開サイトのオリジンを管理画面のオリジンと共用できない、という意味です。）サイトの許可オリジンが管理画面のオリジンと重複しています。管理画面のオリジンはデフォルトで `notifications.instance_public_url` から取り、`admin.allowed_origins` を書いている場合はそちらが優先されます。管理画面には独立したオリジンを使う必要があり、通常は `https://ecoku.example.com` のような Ecoku 自身のドメインです。`app/config.yaml` に `sites` を書いている場合は、同じ競合があると起動時に「管理员来源 … 不能复用公开站点来源」（管理者オリジンを公開サイトのオリジンと共用できない）と出ます。

### ログに「无法解密 … 凭据」と出る

（… の認証情報を復号できない、という意味です。）データベースに SMTP、Telegram、CAPTCHA の認証情報が保存されていますが、`ECOKU_NOTIFICATION_ENCRYPTION_KEY` がないか、保存時と異なっています。バックアップから元の `ecoku.env` を探し出し、このキーを戻してください。キーを取り戻せない場合は、以前のバックアップからインスタンス全体を復元するしかありません。

### ecoku.env を変更したのに反映されない

`docker compose restart` では `env_file` は読み直されません。`ecoku.env` や `app/config.yaml` を変更した後は、次のコマンドでコンテナを作り直してください。

```bash
cd ~/Ecoku && sudo docker compose up -d --force-recreate ecoku
```

## コメント欄

### ページにコメント欄が表示されない

ローダーは必要な属性が見つからないと、何も表示せずに黙ってスキップします。次を確認してください。

- 外側の要素に `data-ecoku-comments` があり、内側に `data-ecoku-mount`、`data-ecoku-loader`、`data-ecoku-status`、`data-ecoku-retry` の 4 つの要素があり、構造が[埋め込みの例](../integration/html)と同じであること。
- `data-server-url`、`data-site-id`、`data-page-key` の 3 つの属性すべてに値があること。
- ブラウザの開発者ツールの「ネットワーク」パネルで、`ecoku-loader.js` と `ecoku.umd.js` が正常に読み込まれていること。

### コメント欄に「コメントは一時的に利用できません」（评论暂时不可用）と表示される、または権限がないと表示される

ほとんどの場合、記事ページのオリジンが登録されていません。管理画面の「サイト管理」（站点）で、ブラウザのアドレスバーにある `スキーム://ドメイン[:ポート]` をそのサイトの許可オリジンに追加してください。`www` ありと `www` なしは別のオリジンです。

### 訪問者に「投稿が多すぎます」（提交过于频繁）が頻繁に表示される

Ecoku をリバースプロキシの背後に置いているのに `trusted_proxies` を設定していないため、すべての訪問者が同じ IP として扱われ、1 分あたり 5 回の投稿枠を共有しています。[リバースプロキシ](./reverse-proxy#trusted-proxies)の手順で Docker ゲートウェイのアドレスを設定し、リバースプロキシが `X-Forwarded-For` を上書き方式で設定していることを確認してください。

### ある記事だけコメントの読み込みに失敗し、ほかの記事は正常

その記事の議論が、1 回の読み込みの上限（コメント 200 件、16 階層、1 MiB）を超えている可能性があります。埋め込みコードで `data-page-size` を小さくしてみてください。1 つのスレッド自体が大きすぎる場合は小さくしても効果がないので、管理画面で一部のコメントを削除する必要があります。詳しくは[スレッドとページング](../guide/concepts#threads)を参照してください。

### ブログのリンク形式を変えたら、古いコメントが消えた

コメントはページキーごとに保存されています。リンク形式が変わると、埋め込みコードが生成するページキーも変わります。データはデータベースに残っているので、`data-page-key` を元の生成方法に戻せば再び表示されます。

### コメントの日時のタイムゾーンが違う

タイムゾーンは `ecoku.env` の `TZ`（例：`TZ='Asia/Tokyo'`）で決まります。変更後はコンテナを作り直す必要があります（上記参照）。

## 管理画面

### ログインできない

次の順に確認してください。

1. HTTPS で管理画面にアクセスしていること。HTTP を使えるのは `localhost` と `127.0.0.1` だけです。
2. アドレスバーのオリジンが `notifications.instance_public_url`（または別途書いた `admin.allowed_origins`）と完全に一致していること（ポートを含む）。
3. ユーザー名とパスワードが正しいこと。ログインのリクエストは同じ IP から 1 分あたり 5 回まで（成功したものも数えます）で、超えた場合は表示に従って待ちます。[`trusted_proxies`](./reverse-proxy#trusted-proxies) を設定していない場合は、全員がこの 1 つの枠を共有します。
4. CAPTCHA の検証ウィジェットを正常に完了できること。検証サービスに問題がある場合は、`captcha disable` で一時的に無効にします。[CAPTCHA](./captcha#disable) を参照してください。

### 管理者パスワードを忘れた

パスワードハッシュを生成し直し、`ecoku.env` の `ECOKU_ADMIN_PASSWORD_HASH` の値を置き換えて（両側のシングルクォートは残してください。消すとハッシュ内の `$` が Compose に展開されます）、コンテナを作り直します。

```bash
cd ~/Ecoku
read -rsp '新密码: ' P; echo
printf '%s\n' "$P" | sudo docker run --rm -i git.via.moe/dejavu/ecoku:v0.2.8 hash-password
unset P
```

変更すると、ログイン中のすべてのセッションが無効になります。

## 通知と CAPTCHA

### テストメールの送信に失敗する

[通知](./notifications#troubleshooting)を参照してください。

### Cap の設定を保存するとアドレスが無効と表示される

Cap インスタンスのアドレスは、インターネットからアクセスできる HTTPS アドレスで、ユーザー名とパスワード、クエリー文字列、`#` フラグメントは付けられません。`localhost`、`127.0.0.1`、プライベート IP はいずれも拒否されます。

### Cap を有効にしたら、ブラウザのコンソールに CSP エラーが出る

エラーがブログのページで出ている場合は、ブログ独自の CSP が Cap を許可していません。Cap インスタンスのオリジン、`worker-src blob:`、WebAssembly の権限を追加する必要があります。詳しくは [CAPTCHA · コンテンツセキュリティポリシー](./captcha#csp)を参照してください。管理画面の CSP は Ecoku が自動で調整するので、手動での対応は不要です。
