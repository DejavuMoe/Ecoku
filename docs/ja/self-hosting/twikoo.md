# Twikoo 取り込み

一度きりの取り込みです。対象サイトは管理画面で作成済みで、コメント数がゼロである必要があります。時刻、ニックネーム、非公開メール、ウェブサイト、page key、返信関係を保持し、本文はプレーンテキストにします。IP、UA、地域、アバター、評価、外部ユーザー ID は取り込まず、過去分の通知も送りません。

page key はクエリとフラグメントを落とし、絶対 URL はパスだけ残します。単一トランザクションで書き込み、エクスポート上限は約 64 MB。壊れた親コメントはルートに降格し、結果に報告します。取り込み後、サイトのブロガーニックネーム+メールで `is_blogger` を埋め戻します。

## バックアップ

取り込み前に [バックアップと復元](./backup) に従い停止コールドバックアップを取ります。残留 WAL/SHM がないことを確認：

```bash
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm
```

## ドライランと取り込み

エクスポートファイルをサービスディレクトリの外に置き、絶対パスで読み取り専用マウントします。

```bash
sudo docker compose run --rm --no-deps \
  --volume <ABSOLUTE_PATH>/twikoo-comment.json:/import/twikoo-comment.json:ro \
  ecoku import-twikoo \
  --site <SITE_ID> \
  --file /import/twikoo-comment.json \
  --dry-run
```

問題なければ `--dry-run` を外して一度実行し、その後：

```bash
sudo docker compose up -d
```

対象サイトに既にコメントがある場合は取り込みを拒否します。受入後、非公開メールを含む元のエクスポートを削除してください。
