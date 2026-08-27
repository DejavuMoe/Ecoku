# よくある質問

## `/api/health` は正常なのにページが開けない

ヘルスチェックはプロセスが応答できることだけを示します。リバースプロキシが `/`、`/api/`、`/admin/`、`/client/` を転送しているか確認してください。

```bash
sudo docker compose ps
sudo docker compose logs --tail=200 ecoku
```

詳しくは [リバースプロキシ](./reverse-proxy)。

## 全訪問者が 1 つのレート制限バケットを共有する

`trusted_proxies: []` のとき、またはプロキシが `X-Forwarded-For` を上書きではなく**追記**しているときに多いです。[リバースプロキシ](./reverse-proxy#クライアントアドレスとレート制限) に従い Docker ゲートウェイ `/32` を設定し、`0.0.0.0/0`、`::/0`、CDN 網段は入れないでください。

## CORS エラーが出る

サイトの Allowed origins にはコメントページの完全な Origin、管理画面には管理ページの Origin を入れます。プロトコル・ドメイン・ポートは完全一致。パスや `*` は使えません。

## 管理者ログインできない

ユーザー名、bcrypt ハッシュ、`ECOKU_ADMIN_TOKEN_KEY`、管理の Allowed origins を確認してください。ボット対策に阻まれている場合は [ログイン復旧](./admin#検証でログインできないときの復旧) を参照。

## Turnstile または Cap の検証に失敗する

インスタンスが検証サービスに届くこと、キーが対になっていること、CORS に必要な Origin があること、ブラウザが Widget / WASM / Siteverify を読めることを確認してください。token は一度きりで、失敗後は再求解が必要です。

## アップグレード後にデータベース版が非対応と出る

データベースを削除したり `schema_migrations` を手で書き換えたりしないでください。バックアップを残し、[アップグレード](./upgrade) のイメージとスキーマ表を照合してください。順序どおりのその場アップグレードのみ対応し、ダウングレード移行はありません。

## タイムゾーンの変え方

`ecoku.env` の `TZ` を IANA 名（例：`Asia/Singapore`）にし、次を実行：

```bash
sudo docker compose up -d --force-recreate
```

## 厳しい CSP が検証コンポーネントを阻む

Turnstile には Cloudflare Origin、Cap にはインスタンス Origin・WASM・Blob Worker が必要で、instrumentation には `'unsafe-eval'` も要ることがあります。[ボット対策](./admin#ボット対策) を参照。
