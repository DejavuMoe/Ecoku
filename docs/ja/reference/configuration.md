# 設定リファレンス

`app/config.yaml` の全フィールド、既定値、選択肢、用途、例を以下のコメント付きテンプレートにまとめています。Docker デプロイページも同じテンプレートを参照し、別のフィールド表を探す必要はありません。

## 完全な設定テンプレート {#template}

テンプレートをコピーし `instance_public_url` を変更します。他の有効な値は既定値で、コメント内の代入は必要に応じて有効にします。トップレベルの節は一度だけ記述し、`site:` や `admin:` を重複させないでください。管理機能は常に有効で、セッション期間は固定です。

<div class="config-template">

<<< ../../../deploy/config.ja.yaml.example{yaml}

</div>

## 変更を反映する {#reload}

保存後、Compose のディレクトリでコンテナを再作成してログを確認します。マウントした YAML を編集するだけではサービスに反映されません。

```bash
sudo docker compose up -d --force-recreate ecoku
sudo docker compose logs --tail=100 ecoku
```

YAML ドキュメントは一つだけ使えます。未知の項目、不正な値、重複する項目は起動時に拒否されます。ログの指摘を修正して再起動してください。

## レート制限の動作 {#rate-limit}

各 `rate_limit` 項目の既定値、単位、例はテンプレートに記載しています。IP ごとに計数し、超過時に `429` と `Retry-After` を返します。再起動で計数はリセットされます。`0` は無効化ではなく既定値への復帰です。プロキシ配下では `site.trusted_proxies` も設定し、全訪問者がプロキシ IP の制限枠を共有しないようにしてください。

## ログ {#logs}

既定では標準出力に記録し、`docker compose logs` で確認します。保持とローテーションは Docker が管理します。`site.log_path` に実際のパスを指定すると、標準出力に加えてファイルにも記録するため、書き込み可能なマウントが必要です。値はテンプレートを参照してください。

## 環境変数 {#env}

新規デプロイに `ecoku.env` は不要です。Compose の `TZ: Asia/Shanghai` がコメントと通知の表示時刻を決めます。変更する場合はこの行を編集してください。`TZ` は YAML 設定項目ではありません。

テンプレートの `*_env` はプロセスが読む環境変数名であり、秘密の値ではありません。手動で渡す場合は Compose の `environment` または `env_file` に値を指定します。既定では管理者と永続キーを自動作成するため注入不要です。イメージの `GIN_MODE=release` と `ECOKU_RUNTIME=container` は上書きしないでください。

## 初期化と永続データ {#legacy}

`sites` の初期データは新規 DB 作成時だけ取り込み、既存サイトを上書きしません。その後のサイト編集や SMTP、Telegram、CAPTCHA、Smoji は管理画面で設定します。DB と同じディレクトリの `ecoku-secrets.json` を一緒にバックアップしてください。パスを変えてもデータは移動しません。
