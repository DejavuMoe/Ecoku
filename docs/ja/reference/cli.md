# コマンドライン

イメージのエントリーポイントは `/app/ecoku-server` です。引数なしで実行するとサービスを起動し、次のサブコマンドを付けると 1 回限りのタスクを実行して終了します。サブコマンド名を書き間違えてもエラーにはならず、通常どおりサービスが起動するので、実行前に綴りを確認してください。

デプロイ先のディレクトリで `docker compose run` を使うと、同じ設定とマウントでサブコマンドを実行できます。

```bash
cd ~/Ecoku
sudo docker compose run --rm --no-deps ecoku <サブコマンド> [引数]
```

`hash-password` 以外のサブコマンドは、いずれも `app/config.yaml` を読み込んでデータベースを開きます。データベースのバージョンが現在のイメージより低い場合は、先にマイグレーションも実行します。稼働中のインスタンスと同時にデータベースに書き込まないよう、先に `sudo docker compose stop ecoku` でサービスを停止してから実行してください。

## admin reset-password {#admin-reset-password}

永続管理者アカウントの新しい仮パスワードを生成します。先に実行中のサービスを停止してください。

```bash
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d
```

コマンドは仮パスワードを表示し、すべての管理者セッションを無効にします。次回ログイン後にユーザー名と正式なパスワードを設定します。

## captcha status

現在の CAPTCHA の設定を表示します。

```bash
sudo docker compose run --rm --no-deps ecoku captcha status
```

たとえば次のような 1 行を出力します。

```text
provider=turnstile turnstile_secret_set=true cap_secret_set=false
```

## captcha disable {#captcha-disable}

CAPTCHA を無効にします。検証サービスの設定ミスで管理者が管理画面にログインできなくなった場合に使います。

```bash
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```

保存済みの Turnstile と Cap の設定とキーはすべて残るので、管理画面にログインした後、「セキュリティ」（安全）ページでそのまま修正して再び有効にできます。すでに無効になっている場合は `CAPTCHA 已处于关闭状态`（CAPTCHA はすでに無効です）と出力し、何も変更しません。

## import-twikoo

Twikoo の JSON エクスポートを、コメントが 1 件もないサイトにインポートします。

まず `--dry-run` を付けて事前チェックします。

```bash
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json --dry-run
```

結果を確認したら、`--dry-run` を外して本番のインポートを行います。

```bash
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json
```

| 引数 | 説明 |
| --- | --- |
| `--site` | 対象のサイト ID。管理画面で登録済みで、コメントが 1 件もない（削除済みのものも含む）必要があります。 |
| `--file` | コンテナ内のエクスポートファイルのパス。ファイルは先に `data/` ディレクトリに置く必要があり（方法は [Twikoo からの移行](../self-hosting/twikoo)を参照）、コンテナ内のパスは `/data/...` になります。 |
| `--dry-run` | インポートを最後まで実行してからロールバックし、統計だけを出力します。コメントは保存しません。 |

成功すると最後の行に統計を出力します（行頭に日時が付きます）。事前チェックでは「预检通过」（事前チェック成功）、本番のインポートでは「完成」（完了）と表示されます。例：

```text
Twikoo 导入预检通过：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
Twikoo 导入完成：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
```

（各項目は、コメント、ルートコメント、返信、ページ、メールアドレス、Web サイト、親レコードの欠落の件数です。）

詳しい手順、フィールドの対応、注意点は [Twikoo からの移行](../self-hosting/twikoo)を参照してください。

::: details 内部テスト設定：パスワードハッシュ

## hash-password {#hash-password}

標準入力からパスワードを 1 行読み取り、旧インスタンスの `ECOKU_ADMIN_PASSWORD_HASH` に使う bcrypt ハッシュ（cost 10）を出力します。新規インスタンスは初回起動時に管理者を自動作成するため、このコマンドは不要です。設定を読み込まず、データベースにもアクセスしないので、サービスの稼働中でも実行できます。

```bash
read -rsp '管理者パスワード: ' P; echo
printf '%s\n' "$P" | sudo docker run --rm -i ghcr.io/dejavumoe/ecoku:v0.3.0 hash-password
unset P
```

パスワードは空にできず、UTF-8 で 72 バイト（bcrypt の上限）を超えることもできません。超えた場合、コマンドはエラーで終了します。

出力を `ecoku.env` に書くときは、シングルクォートで囲んでください。

```bash
ECOKU_ADMIN_PASSWORD_HASH='$2a$10$...'
```

その後、コンテナを作り直して反映させます。

:::
