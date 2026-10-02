# それ以前の候補版

::: warning 内部テスト版・使用しないでください
タグ、変更点、過去の移行上の注意のみを保存しています。公開デプロイは v0.3.0 以降を対象とし、旧イメージのデプロイはサポートしません。[現在のデプロイ手順](../docker) を利用してください。
:::

`v0.1.0-rc.1` · [v0.1.0-rc.2](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.2) · [v0.1.0-rc.3](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.3) · [v0.1.0-rc.5](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.5) · [v0.1.0-rc.6](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.6) · [v0.1.0-rc.7](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.7) · [v0.1.0-rc.8](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.8) · [v0.1.0-rc.9](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.9) · [v0.1.0-rc.10](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.10)

## v0.1.0-rc.8 ～ rc.10

- rc.8 は schema v3 と v4 を書き込みます。コメントのブロガーバッジと `turnstile_settings` テーブルです。
- rc.9 は Turnstile の `api.js` と `turnstile.ready()` の競合を修正しました。
- rc.10 はコメント欄の文言とレイアウトを調整しました。

タイムゾーンは `ecoku.env` の `TZ='<IANA 时区>'`（IANA タイムゾーン名）を読むように変わりました。追加してコンテナを作り直すだけでよく、`config.yaml` を変更する必要はありません。

rc.7 から rc.8 にアップグレードする前には、必ずバックアップを取ってください。v3/v4 が書き込まれたデータベースは、そのまま rc.7 に戻せません。

## v0.1.0-rc.7

埋め込みコードが `data-ecoku-*` 属性を使うようになり、外側の ID は `ecoku-comments` / `ecoku-mount` に変わりました。ローダーは当面、古い `#tcomment` も認識します。スキーマは v2 のままです。

## v0.1.0-rc.6

ログは常に stdout に出力されます。`log_path` がファイルを指している場合は、そこにも 1 部保存します。スキーマは v2 のままです。

## v0.1.0-rc.5

schema v1 → v2：サイトにブロガーのニックネームとメールアドレスを追加しました。SDK は訪問者情報を IndexedDB に暗号化して 7 日間保存します。

## v0.1.0-rc.3

ホストのディレクトリを `app/config.yaml`、`app/logs/`、`data/` に整理し、SQLite で WAL を有効にしました。rc.2 からアップグレードする場合は、`config.yaml` を `app/config.yaml` に、古い `data/ecoku.log` を `app/logs/ecoku.log` に移動してください。

## v0.1.0-rc.1 / rc.2

- rc.1 は、マルチサイトの純テキストコメント、管理画面、通知、Twikoo のインポートを提供しました。
- rc.2 から、コンテナに `/client/ecoku-loader.js` と `hash-password` コマンドが内蔵されています。
