# バックアップと復元

Ecoku の状態はすべてデプロイ先のディレクトリにあります。完全なバックアップには次の 4 つが含まれます。

| パス | 内容 |
| --- | --- |
| `data/` | SQLite データベースと、実行時の `-wal`、`-shm` ファイル。サイト、コメント、通知と CAPTCHA の設定はすべてここにあります。 |
| `ecoku.env` | 管理者の認証情報と暗号化マスターキー。マスターキーがないと、データベースに保存済みの SMTP、Telegram、CAPTCHA の認証情報を復号できず、サービスは起動を拒否します。 |
| `app/config.yaml` | インスタンスの設定。 |
| `compose.yaml` | 使用中のイメージのバージョンが記録されています。復元時は同じバージョンで起動する必要があります。 |

`app/logs/` はログのコピーにすぎないので、バックアップは不要です。

`ecoku.env` にはシークレットが含まれます。バックアップファイルは自分で管理できる場所にだけ保存してください。

## 停止してのコールドバックアップ {#cold-backup}

推奨する方法です。まずサービスを停止し、4 つを 1 つのアーカイブにまとめ、検証してから起動します。停止中はコメント欄を読み込めませんが、通常は数秒で終わります。

以下をまとめてコピーして実行します。どこかの手順が失敗すると中断し、サービスは停止したままになります。原因を調べてから手動で起動してください。

```bash
(
set -eu
umask 077
cd "$HOME/Ecoku"
install -d -m 700 "$HOME/backups"
sudo docker compose down
archive="$HOME/backups/ecoku-$(date +%Y%m%d_%H%M%S).tar.gz"
[ ! -e "$archive" ]
sudo tar -czf - data/ app/config.yaml ecoku.env compose.yaml > "$archive"
contents=$(tar -tzf "$archive")
for required in data/ecoku.sqlite3 app/config.yaml ecoku.env compose.yaml; do
  printf '%s\n' "$contents" | grep -Fx "$required" > /dev/null
done
printf 'Verified backup: %s\n' "$archive"
sudo docker compose up -d
)
```

このスクリプトは次のことを行います。

- `~/backups/` に `ecoku-日付_時刻.tar.gz` を作成します。ディレクトリとファイルは現在のユーザーだけが読めます。
- UID 10001 が所有するデータファイルを `sudo` で読み取ります。
- 残っている可能性のある WAL ファイルも含め、`data/` ディレクトリ全体をまとめてアーカイブします。
- 最後に、アーカイブを読み取れるか、必要なファイルがそろっているかを確認します。これはアーカイブが完全であることを示すだけで、復元を試したことにはなりません。

## オンラインスナップショット

サービスを止めたくない場合は、ホストの `sqlite3` コマンドで、稼働中のデータベースの一貫したスナップショットを取れます。先に sqlite3 をインストールしておく必要があります（Debian/Ubuntu：`sudo apt install sqlite3`）。

```bash
(
set -eu
umask 077
cd "$HOME/Ecoku"
install -d -m 700 "$HOME/backups"
snapshot=$(mktemp -d "$HOME/backups/ecoku-snapshot-XXXXXXXX")
sudo sh -c 'umask 077; cd "$1"; sqlite3 "$2" ".backup database.sqlite3"' sh "$snapshot" "$PWD/data/ecoku.sqlite3"
sudo tar -czf - app/config.yaml ecoku.env compose.yaml > "$snapshot/config.tar.gz"
printf 'Snapshot: %s\n' "$snapshot"
)
```

結果は 1 つのディレクトリで、データベースのスナップショット `database.sqlite3`（所有者 root、権限 600）と設定のアーカイブ `config.tar.gz` が入っています。形式はコールドバックアップと異なり、後述の復元スクリプトにはそのまま使えません。スナップショットの取得中に設定を変更すると、データベースと設定が食い違うことがあります。両者を厳密に一致させる必要がある場合は、コールドバックアップを使ってください。

スナップショットから復元するときは、まずサービスを停止し、残っている WAL ファイルを削除してから、コンテナのユーザーを所有者にしてデータベースを戻します（`snapshot=` はスナップショットのディレクトリに書き換えてください）。

```bash
cd ~/Ecoku
snapshot="$HOME/backups/ecoku-snapshot-XXXXXXXX"
sudo docker compose down
sudo rm -f data/ecoku.sqlite3-wal data/ecoku.sqlite3-shm
sudo install -o 10001 -g 10001 -m 600 "$snapshot/database.sqlite3" data/ecoku.sqlite3
sudo docker compose up -d
```

設定も復元する場合は、起動する前に `config.tar.gz` を展開し、後述の復元スクリプトに従って所有者と権限を直してください。

## コールドバックアップから復元する {#restore}

復元すると、現在のデータベースと設定がバックアップ時点の状態に置き換わり、バックアップ後に投稿されたコメントや設定の変更は失われます。

まずスクリプト内の `archive=` を、復元するアーカイブのパスに書き換えます。スクリプトは元のデプロイ先のディレクトリで実行します。新しいホストで復元する場合は、先に [Docker デプロイ](./docker)の手順 1 で `~/Ecoku` を作成してください。スクリプトは次のことを行います。

1. アーカイブに必要なファイルが含まれているか確認します。
2. サービスを停止します。
3. 必要なときに取り戻せるよう、現在の `data/`、設定、環境ファイルを `recovery-before-日付_時刻/` に移動します。
4. アーカイブを展開し、所有者と権限を直します。
5. サービスを起動し、ヘルスチェック API を確認します。

```bash
(
set -eu
umask 077
cd "$HOME/Ecoku"
archive="$HOME/backups/ecoku-YYYYMMDD_HHMMSS.tar.gz"
contents=$(tar -tzf "$archive")
for required in data/ecoku.sqlite3 app/config.yaml ecoku.env compose.yaml; do
  printf '%s\n' "$contents" | grep -Fx "$required" > /dev/null
done
sudo docker compose down
saved="recovery-before-$(date +%Y%m%d_%H%M%S)"
mkdir -m 700 "$saved"
for item in data app/config.yaml ecoku.env compose.yaml; do
  [ ! -e "$item" ] || sudo mv "$item" "$saved/"
done
sudo tar -xzf "$archive" --no-same-owner
sudo chown -R 10001:10001 data
sudo chmod 750 data
sudo install -d -o 10001 -g 10001 -m 750 app/logs
sudo chown "$(id -u):$(id -g)" app app/config.yaml ecoku.env compose.yaml
chmod 755 app
chmod 644 app/config.yaml
chmod 600 ecoku.env
sudo docker compose up -d
curl --fail --silent --show-error --retry 15 --retry-delay 2 --retry-all-errors \
  http://127.0.0.1:12123/api/health
)
```

`data/` ディレクトリ全体が置き換わるので、古い WAL ファイルが復元後のデータベースに混ざることはありません。`compose.yaml` もバックアップから戻るため、サービスはバックアップ時点のイメージのバージョンで起動します。

ヘルスチェック API が正常でも、プロセスが動いていることしかわかりません。復元後は、管理画面にログインできること、サイトの設定が正しいこと、記事ページで過去のコメントが見られることも確認してください。

復元するのは信頼できる出所のアーカイブだけにしてください。
