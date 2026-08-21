# より前の候補版

古い `compose.yaml` に残っていることがあります。常に：コールドバックアップ → 正確なタグ → `pull && up -d`。schema を跨ぐ戻しはバックアップ必須。

## v0.1.0-rc.10 / rc.9 / rc.8

rc.8 が schema **v3 + v4**（ブロガーバッジ、`turnstile_settings`）。rc.9 は Turnstile ログイン枠が出ない不具合を修正。`TZ` は `ecoku.env` のみ。v3/v4 の DB は rc.7 では動きません。

## v0.1.0-rc.7

markup が `data-ecoku-*`、id は `ecoku-comments` / `ecoku-mount`。ローダーは当分 `#tcomment` も認識。schema は v2。ブログ partial はこのイメージ公開後にデプロイ。

## v0.1.0-rc.6

ログは常に stdout。`log_path` はプロセス内ファイル複製も残す。schema は v2。

## v0.1.0-rc.5

Schema **v1 → v2**。サイトにブロガーニックネームとメール。SDK は IndexedDB に 7 日暗号化。管理画面から通知判定プレビューを削除。

## v0.1.0-rc.3

配置が `app/config.yaml`、`app/logs/`、`data/` に収束。WAL 有効。rc.2 からは `config.yaml` を `app/config.yaml` へ、`data/ecoku.log` を `app/logs/ecoku.log` へ移動。

Git に `v0.1.0-rc.4` タグはあるが、対応する CHANGELOG 節はない。

## v0.1.0-rc.2 / rc.1

rc.2 で `/client/ecoku-loader.js` と `hash-password`。rc.1 が最初の CI 候補。
