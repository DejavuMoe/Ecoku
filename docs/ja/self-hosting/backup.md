# バックアップと復元

新規デプロイでは次をバックアップします。

| パス | 内容 |
| --- | --- |
| `data/` | SQLite、`-wal`、`-shm`、`ecoku-secrets.json`。サイト、コメント、通知、CAPTCHA、管理者アカウントが含まれます。 |
| `app/config.yaml` | インスタンス設定。 |
| `compose.yaml` | イメージのバージョンとマウント。 |

旧インスタンスで `ecoku.env` を使っている場合は、移行が終わるまで一緒にバックアップしてください。

## コールドバックアップ {#cold-backup}

```bash
(
set -eu
umask 077
cd "$HOME/Ecoku"
install -d -m 700 "$HOME/backups"
sudo docker compose down
archive="$HOME/backups/ecoku-$(date +%Y%m%d_%H%M%S).tar.gz"
sudo tar -czf - data/ app/config.yaml compose.yaml ${ECOKU_BACKUP_ENV:-} > "$archive"
printf 'Verified backup: %s\n' "$archive"
sudo docker compose up -d
)
```

旧インスタンスではアーカイブ前に `ECOKU_BACKUP_ENV=ecoku.env` を設定します。新規デプロイでは設定しません。`data/` 全体をまとめ、SQLite の本体だけをコピーしないでください。

## 復元 {#restore}

サービスを停止し、`data/`、`app/config.yaml`、`compose.yaml` 全体を戻します。旧インスタンスでは `ecoku.env` も戻します。

```bash
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
sudo docker compose up -d
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

異なるバージョンの `ecoku-secrets.json` を混ぜたり、対応する WAL を失ったまま SQLite 本体だけを戻したりしないでください。復元後にログイン、サイト数、過去のコメント、通知設定を確認します。

`ecoku-secrets.json` はデータベースと同じく機密です。Git や公開ディレクトリに置かないでください。キー移行後は、停止したバックアップを取ってから古い環境変数を削除します。
