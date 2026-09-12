# バックアップとデータ復旧

Ecoku のすべてのデータ（サイト設定、コメント記録、暗号化認証情報、マイグレーション履歴）は、単一の SQLite3 データベースファイルに永続化されます。

---

## 1. コールドバックアップ（最も推奨・安全確実）

システムアップデート、サーバー移転、または大規模な設定変更の前には、**サービスを一時停止して行うコールドバックアップが最も確実です**。

```bash
cd ~/Ecoku

# 1. コンテナを停止し、SQLite の WAL チェックポイントを完全に完了させる
sudo docker compose down

# 2. データディレクトリ、設定ファイル、環境変数ファイルをアーカイブ
BACKUP_NAME="ecoku-backup-$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czvf "$BACKUP_NAME" data/ app/config.yaml ecoku.env compose.yaml

# 3. 権限を制限し、バックアップアーカイブを安全なオフラインまたは別ストレージへ移動
chmod 600 "$BACKUP_NAME"
mkdir -p ~/backups && mv "$BACKUP_NAME" ~/backups/

# 4. サービスを再起動
sudo docker compose up -d
```

---

## 2. ホスト側オンラインスナップショット（`VACUUM INTO`）

ホスト側に `sqlite3` コマンドラインツールがインストールされており、短時間のサービス停止も避けたい場合は、SQLite ネイティブの不可分スナップショットコマンド `VACUUM INTO` を直接実行することで、テーブルロックを保持せずに整合性のある単一ファイルバックアップをオンライン生成できます：

```bash
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)

# ホスト側で VACUUM INTO を実行してスナップショットを生成
mkdir -p ~/backups
sqlite3 ~/Ecoku/data/ecoku.sqlite3 "VACUUM INTO '$HOME/backups/backup_${BACKUP_DATE}.sqlite3'"
```

> [!NOTE]
> コンテナ環境は軽量 Alpine をベースにしており、`sqlite3` コマンドは同梱されていません。ホスト側に `sqlite3` がない場合は、前述の「コールドバックアップ」（最も確実・追加依存関係なし）を推奨します。

---

## 3. データ復旧手順（SOP）

データの破損、誤操作、またはサーバー移行が発生した場合は、以下の手順に従って正確に復旧を行ってください：

```bash
cd ~/Ecoku

# ステップ 1: コンテナの停止
sudo docker compose down

# ステップ 2: 障害現状の保全（既存の破損ディレクトリを別名退避）
mv data data_corrupted_$(date +%Y%m%d_%H%M%S)
mkdir -p data

# ステップ 3: バックアップアーカイブの展開
tar -xzvf ~/backups/ecoku-backup-YYYYMMDD_HHMMSS.tar.gz

# ステップ 4: 所有者と権限の検証・修復（必ず 10001:10001）
sudo chown -R 10001:10001 data app/config.yaml
sudo chmod 750 data
sudo chmod 640 app/config.yaml
sudo chmod 600 ecoku.env

# ステップ 5: コンテナの起動
sudo docker compose up -d

# ステップ 6: ログと稼働健全性の確認
sudo docker compose logs --tail=100 ecoku
curl -f http://127.0.0.1:12123/api/health
```

---

## 4. 復旧後検証チェックリスト

復旧作業完了後、以下の項目を確認して正常性を担保してください：

- [ ] `curl -f http://127.0.0.1:12123/api/health` が正常に応答し、`data.status` が `healthy` であること。
- [ ] 管理コンソール `/admin/` に正常にログインできること。
- [ ] サイト一覧と各種設定が保持され、ブロガーパスフレーズやバッジが正常に表示されること。
- [ ] ブログ側のコメント欄で過去のツリー構造コメントが正しく表示されること。
- [ ] テストコメントを 1 件投稿し、即座に反映されることを確認すること。
