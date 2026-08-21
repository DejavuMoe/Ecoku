# Twikoo 取り込み

登録済みでコメント数がまだ 0 のサイトに対して一度だけ。時刻、ニックネーム、非公開メール、サイト、page key、返信階層、変換後のプレーンテキストを残します。IP、UA、地域、アバター、評価、外部ユーザー ID は取り込みません。過去通知も送りません。

page key から query/fragment を落とし、絶対 URL はパスだけ残します。終了時にサイトのブロガーニックネーム+メールで `is_blogger` を埋めます。一括は 1 トランザクション。

## バックアップ

```bash
sudo docker compose down
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm

twikoo_stamp="$(date +%Y%m%d-%H%M%S)"
sudo cp --reflink=auto --preserve=mode,timestamps \
  ./data/ecoku.sqlite3 "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3"
sudo chown "$USER":"$USER" "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3"
chmod 600 "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3"
sha256sum "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3" \
  > "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3.sha256"
```

エクスポートはリポジトリとサービスディレクトリの外に置き、絶対パスで読み取り専用マウントします。

## dry-run のあと取り込み

```bash
sudo docker compose run --rm --no-deps \
  --volume <ABSOLUTE_PATH>/twikoo-comment.json:/import/twikoo-comment.json:ro \
  ecoku import-twikoo \
  --site <SITE_ID> \
  --file /import/twikoo-comment.json \
  --dry-run
```

要約がソースと一致したら本番を実行し `sudo docker compose up -d`。既にコメントがあるサイトは拒否されます。非公開メールを含むエクスポートは事後にサーバから削除。
