# よくある質問

## コンテナが unhealthy、または再起動を繰り返す

`sudo docker compose logs --tail=200 ecoku`。マイグレーション失敗、設定検証、管理静的ファイル欠損が典型。[アップグレード](/ja/self-hosting/upgrades/) と `CHANGELOG.md` を照合。

## 未知 schema / チェックサム不一致

古いイメージで新しい DB を開いた、または `schema_migrations` を手で変えた。停止し、アップグレード前バックアップで丸ごと戻す。イメージだけ戻さない。

## 全員が同じレート制限バケット

`trusted_proxies` が空、またはプロキシが `X-Forwarded-For` を**連結**している。[リバースプロキシ](/ja/self-hosting/reverse-proxy) のトポロジ 1。`0.0.0.0/0` は使わない。

## CORS がコメント送信を拒否

ページ Origin がサイトの `allowed_origins` に無い。管理オリジンと公開オリジンは別。

## Turnstile のログイン / 投稿失敗

セキュリティ頁、Sitekey/Secret、`ECOKU_NOTIFICATION_ENCRYPTION_KEY`。Siteverify 失敗はフォールバックしません。

## Cap のログイン / 投稿失敗

Cap の健全性、Key CORS、`/assets/widget.js`、WASM、Siteverify。消費済みトークンは再求解。入れないときは [管理画面](/ja/self-hosting/admin#ログイン復旧) の `captcha disable`。

`instr_timeout` と `/redeem` 429：管理 CSP が現行イメージか確認（`v0.1.6` から Cap 時のみ `'unsafe-eval'`）。Caddy に緩い第二 CSP を足さない。

## コンソール aborting clearance redemption

Cloudflare Pre-clearance がオンだが CF プロキシ配下ではない。コンソールで切る。ウィジェットの Siteverify は可能。

## バックアップから戻しても異常

WAL/SHM ありのまま、または本体だけコピーした。停止しサイドカーが無いことを確認してから取る。

## コメント時刻が違う

`TZ` 未設定、または `ecoku.env` 変更後にコンテナを作り直していない。IANA 名を書いて `docker compose up -d`。未設定は `Asia/Shanghai`。

## ブロガーバッジが無い

履歴が未埋め。パスフレーズを再保存。ニックネームとメールが履歴と一致している必要あり。

## management key は削除できるが一覧できない

仕様：所属サイトの墓碑削除のみ。一覧/詳細は管理者ログイン。

## ホスト CSP {#ホスト-csp}

Turnstile：`https://challenges.cloudflare.com` を `script-src` / `frame-src` / `connect-src` に許可。

Cap：インスタンス Origin を `script-src` と `connect-src`。`worker-src blob:`。`'wasm-unsafe-eval'`。instrumentation 有効時は `'unsafe-eval'`。`*` や広い `unsafe-inline` で代用しない。
