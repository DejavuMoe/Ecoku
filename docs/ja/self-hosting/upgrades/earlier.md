# より早い候補版

次の tag は古いインスタンスの Compose に残っていることがあります。アップグレード手順は常に [アップグレード](../upgrade)。スキーマをまたぐロールバックはバックアップ復元が必須です。

## v0.1.0-rc.10 / rc.9 / rc.8

Schema は rc.8 までで **v3 + v4**（ブロガー印、`turnstile_settings`）を書き込み。rc.9 は Turnstile `api.js` と `turnstile.ready()` の衝突を修正。rc.10 はコメント文言とレイアウト調整。

`ecoku.env` に `TZ='<IANA>'` を足したあと、現行 Compose の `env_file` でコンテナを作り直せばよく、`config.yaml` の変更は不要。rc.7 から rc.8 へはバックアップ必須。すでに v3/v4 の DB は rc.7 へタグだけ戻しても動きません。

## v0.1.0-rc.7

組み込みは `data-ecoku-*` に変更。シェル id は `ecoku-comments` / `ecoku-mount`。ローダーは当面旧 `#tcomment` も認識。Schema は引き続き v2。

## v0.1.0-rc.6

ログは常に stdout。`log_path` がファイルを指すときはプロセス内コピーも残す。Schema は引き続き v2。

## v0.1.0-rc.5

Schema **v1 → v2**：サイトにブロガーのニックネームとメールを追加。SDK は IndexedDB に身元を 7 日暗号化保存。管理画面に通知判定プレビューは出さない。

## v0.1.0-rc.3

ホスト配置は `app/config.yaml`、`app/logs/`、`data/` に収束。SQLite で WAL を有効化。rc.2 からのアップグレードでは `config.yaml` を `app/config.yaml` へ、旧 `data/ecoku.log` を `app/logs/ecoku.log` へ移す。

## v0.1.0-rc.2 / rc.1

rc.2 からコンテナに `/client/ecoku-loader.js` と `hash-password` を同梱。rc.1 はマルチサイト純テキストコメント、管理者、通知、Twikoo 取り込みを提供。
