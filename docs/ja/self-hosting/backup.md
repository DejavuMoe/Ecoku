# バックアップと復元

## 1. 停止して取得するバックアップ

コードブロック全体を実行します。コマンドが失敗すると処理が止まり、サービスは停止したままです。原因を解決してから再起動してください。ボリューム外のバックアップは作成時からアクセスを制限し、UID 10001 のファイルは sudo で読み取ります。残っている WAL/SHM を含め data 全体を保存します。停止成功だけでは checkpoint 完了を保証できません。検査はアーカイブと必須ファイルの確認であり、復元訓練の代わりにはなりません。

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

## 2. オンラインスナップショット

ホストに sqlite3 が必要です。スナップショットは root 所有・600、ディレクトリは 700 です。設定アーカイブと復号鍵も必ず保存してください。取得中は設定を変更せず、厳密な整合性が必要なら停止バックアップを使います。このスナップショットは下の復元手順用アーカイブとは異なります。

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

## 3. 停止バックアップの復元

信頼できるアーカイブを選び、ファイル名を置き換えます。現在の data と設定を退避して全体を復元し、古い WAL の混入を防ぎます。元のイメージ tag と復号鍵も復元します。その後、管理ログイン、サイト設定、既存コメントと許可された新規投稿を確認してください。health はプロセスの応答のみを示します。

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
sudo mv data app/config.yaml ecoku.env compose.yaml "$saved/"
sudo tar -xzf "$archive" --no-same-owner
sudo chown -R 10001:10001 data app/config.yaml
sudo chmod 750 data
sudo chmod 640 app/config.yaml
sudo chown "$(id -u):$(id -g)" ecoku.env compose.yaml
chmod 600 ecoku.env
sudo docker compose up -d
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
)
```
