# アップグレード手順

各リリース後、説明を [アップグレード](/ja/self-hosting/upgrades/) に追加します。実施前にその頁と根の `CHANGELOG.md` を読んでください。

## 順序

1. 対象タグ、schema、環境変数、ディレクトリ変更を確認。
2. [コールドバックアップ](/ja/self-hosting/backup)。
3. `compose.yaml` の正確なイメージタグを更新。古いファイルに `logging` が無ければ現行リポジトリから補う。
4. 新環境変数（例 `TZ`）は `ecoku.env` へ。`config.yaml` には書かない。
5. pull して起動。マイグレーションログを見て `healthy` を確認。
6. 管理ログイン、サイト、コメント時刻、投稿、返信、通知を確認。Turnstile / Cap 有効時はログインと投稿の両方。

```bash
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=200 ecoku
curl --fail http://127.0.0.1:12123/api/health
```

## Schema

マイグレーションは既存 `data/ecoku.sqlite3` 内で版ごとにトランザクション実行。成功時は `schema_migrations` 行を追加するだけ。ダウンマイグレーションはありません。新しい schema の DB は古いイメージでは動きません。アップグレード前バックアップを戻します。

| イメージ | Schema |
| --- | --- |
| `v0.1.0` – `v0.1.2` | v4 |
| `v0.1.3` – `v0.1.4` | v5 |
| `v0.1.5` – `v0.1.7` | v6 |

現行は schema v6。
