# REST API リファレンス

---

## 1. 公開エンドポイント

### ヘルスチェック `GET /api/health`
レスポンス：`{"status":"ok"}`

### コメント一覧取得 `GET /api/comment/list`
- クエリパラメータ：`siteId`, `key`, `page`, `pageSize`, `sort`
- 既定モードの成功レスポンスは `data.data`、ルート数 `total`、到達可能なコメント数 `commentTotal`、`page/pageSize/pageCount`、`formConfig`、`timeZone` を維持します。
- 完全スレッドモードは **200 ノード、子孫 16 階層**（ルートは深さ 0）まで。件数集計で調べる ID と親の組は同一サイト/ページの **10,000 件**までです。超過時は **422** を返し、部分ツリーや概算件数を成功として返しません。記事全体が上限を超えると `pageSize=1` でも失敗します。現行 SDK は既存の読み込み失敗表示を使い、モードを自動変更しません。
- 必要な分だけ読む場合は `parentId=0` でルート、正の親 ID でその直接の子だけを取得します。同一サイト/ページの墓標も含みます。`afterId`（既定 0）で **ID 昇順**のカーソルページングを行い、`pageSize` は既定 10、最大 100。`page/sort` とは併用できません。子孫展開と総数集計は行わず、レスポンスの `data` はコメント配列 `data` と `parentId/pageSize/hasMore/nextAfterId/formConfig/timeZone` を含みます。`hasMore=true` の場合だけ `nextAfterId` で続けます。親が存在しないか範囲外なら 404、不正なパラメーターは 400 です。

```http
GET /api/comment/list?siteId=blog&key=/posts/example/&parentId=0&pageSize=20
GET /api/comment/list?siteId=blog&key=/posts/example/&parentId=101&afterId=120&pageSize=20
```

両モードともエスケープとエンベロープを含む JSON 全体は **1 MiB** までです。超過時は 422 となり、`pageSize` を減らして再試行できます。一覧処理は **同時 4 件**、データベース読み取り期限は **2 秒**。満杯なら 503 / `Retry-After: 1`、期限切れなら 503 を返します。集計と子孫の取得は同じ SQLite スナップショットを使います。[読み取り頻度制限](../self-hosting/configuration.md)は既定で IP ごとに 60 秒間に 60 回、超過時は 429 / `Retry-After` です。

### コメント投稿 `POST /api/comment/submit`
- JSON リクエストボディ：
  ```json
  {
    "siteId": "blog",
    "pageKey": "/posts/hello-world/",
    "pageTitle": "こんにちは世界",
    "parent": 0,
    "username": "田中",
    "email": "tanaka@example.com",
    "url": "https://example.com",
    "comment": "純テキストのコメント本文",
    "captchaToken": "0.xxxxxx"
  }
  ```

---

## 2. 管理用エンドポイント

`Authorization: Bearer {TOKEN}` ヘッダーが必要です。

- `POST /api/admin/login`：管理者認証。
- `GET /api/admin/sites`：サイト一覧。
- `DELETE /api/admin/sites/:siteId/comments/:commentId`：墓標ソフトデリート。
- `DELETE /api/admin/sites/:siteId/comments/:commentId/permanent`：子孫を持たない墓標の完全削除。
