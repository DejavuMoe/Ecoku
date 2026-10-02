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
install -d -m 700 backups
sudo docker compose stop ecoku
archive="backups/ecoku-$(date +%Y%m%d_%H%M%S).tar.gz"
set -- data/ app/config.yaml compose.yaml
if [ -f ecoku.env ]; then set -- "$@" ecoku.env; fi
sudo tar -czf - "$@" > "$archive"
tar -tzf "$archive" >/dev/null
printf 'Verified backup: %s\n' "$archive"
sudo docker compose up -d
)
```

`ecoku.env` が存在する場合は自動で含めます。SQLite 本体だけでなく `data/` 全体を保存してください。`Verified backup` は書き込みと一覧取得の成功を示し、復元テスト済みという意味ではありません。失敗時は停止したままなので、修正して再試行するか `sudo docker compose up -d ecoku` で再開してください。

## 復元 {#restore}

復元前にサービスを停止し、現在の `data/` を別の場所に退避してから 1 つの完全なバックアップを展開します。稼働中の DB を上書きしたり、新しい WAL と古い DB を混在させたりしないでください。

サービスを停止し、`data/`、`app/config.yaml`、`compose.yaml` 全体を戻します。旧インスタンスでは `ecoku.env` も戻します。

```bash
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
sudo chmod 600 data/ecoku-secrets.json
sudo docker compose up -d
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

異なるバージョンの `ecoku-secrets.json` を混ぜたり、対応する WAL を失ったまま SQLite 本体だけを戻したりしないでください。復元後にログイン、サイト数、過去のコメント、通知設定を確認します。

`ecoku-secrets.json` はデータベースと同じく機密です。Git や公開ディレクトリに置かないでください。キー移行後は、停止したバックアップを取ってから古い環境変数を削除します。
