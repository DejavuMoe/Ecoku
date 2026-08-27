# バックアップと復元

本番のデータベースパスは `data/ecoku.sqlite3`（ほかに WAL / SHM）です。コンテナを止めると WAL チェックポイントが完了します。バックアップには設定と秘密情報も含めてください。

## コールドバックアップ

インスタンスディレクトリで：

```bash
cd ~/Ecoku
sudo docker compose down

backup_stamp="$(date +%Y%m%d-%H%M%S)"
backup_dir="./backups/$backup_stamp"
mkdir -p "$backup_dir"
sudo cp --preserve=mode,timestamps data/ecoku.sqlite3 "$backup_dir/"
sudo cp --preserve=mode,timestamps app/config.yaml "$backup_dir/"
sudo cp --preserve=mode,timestamps ecoku.env "$backup_dir/"
sudo cp --preserve=mode,timestamps compose.yaml "$backup_dir/"
sudo sha256sum "$backup_dir"/*

sudo docker compose up -d
```

バックアップディレクトリと秘密ファイルは管理者だけが読めるようにしてください。長期保管ではバックアップディレクトリ全体を管理下のストレージへコピーし、SQLite ファイルだけをコピーしないでください。

## 復元

先に停止し、現状の別バックアップを残してから復元します。

```bash
cd ~/Ecoku
sudo docker compose down

backup_file="./backups/YYYYMMDD-HHMMSS/ecoku.sqlite3" # 実際のパスに変更
test -f "$backup_file"
sudo cp --preserve=mode,timestamps "$backup_file" ./data/ecoku.sqlite3
sudo rm -f ./data/ecoku.sqlite3-wal ./data/ecoku.sqlite3-shm
sudo chown 10001:10001 ./data/ecoku.sqlite3

sudo docker compose up -d
sudo docker compose ps
curl --fail http://127.0.0.1:12123/api/health
```

設定や秘密も壊れている場合は、同じバックアップディレクトリから `app/config.yaml`、`ecoku.env`、`compose.yaml` を戻してから起動してください。復元後は管理画面、サイト、コメント、通知テストを確認します。
