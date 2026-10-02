# よくある質問

問題が起きたら、まずコンテナのログを確認してください。起動時のエラーのほとんどは、ここに原因が書かれています。

```bash
cd ~/Ecoku
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
```

## デプロイと起動

### コンテナが再起動を繰り返し、ログに permission denied と出る

コンテナは UID/GID `10001:10001` で動作し、`app/config.yaml` を読めること、`data/` に書き込めることが必要です。所有者と権限を直してから再起動します。

```bash
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
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

（公開サイトのオリジンを管理画面のオリジンと共用できない、という意味です。）サイトの許可オリジンが管理画面のオリジンと重複しています。管理画面のオリジンはデフォルトで `notifications.instance_public_url` から取り、`admin.allowed_origins` を書いている場合はそちらが優先されます。管理画面には独立したオリジンを使う必要があり、通常は `https://ecoku.example.com` のような Ecoku 自身のドメインです。

### ログに「无法解密 … 凭据」と出る

（… の認証情報を復号できない、という意味です。）データベースに SMTP、Telegram、CAPTCHA の認証情報が保存されていますが、`ECOKU_NOTIFICATION_ENCRYPTION_KEY` がないか、保存時と異なっています。バックアップから元の `ecoku.env` を探し出し、このキーを戻してください。キーを取り戻せない場合は、以前のバックアップからインスタンス全体を復元するしかありません。

### 設定を変更しても反映されない

新規デプロイでは `ecoku.env` を使いません。`app/config.yaml` または Compose を変更した後は、コンテナを作り直してください。

```bash
cd ~/Ecoku && sudo docker compose up -d --force-recreate ecoku
```
