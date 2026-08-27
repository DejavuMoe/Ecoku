# 备份与恢复

生产库路径为 `data/ecoku.sqlite3`（另有 WAL / SHM）。停掉容器后会完成 WAL 检查点。备份须同时包含配置与密钥。

## 冷备份

在实例目录：

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

备份目录与密钥文件仅管理员可读。长期留存时复制整个备份目录到受控存储，不要只拷贝 SQLite 文件。

## 恢复

先停服并另留一份现状备份，再恢复：

```bash
cd ~/Ecoku
sudo docker compose down

backup_file="./backups/YYYYMMDD-HHMMSS/ecoku.sqlite3" # 改为实际路径
test -f "$backup_file"
sudo cp --preserve=mode,timestamps "$backup_file" ./data/ecoku.sqlite3
sudo rm -f ./data/ecoku.sqlite3-wal ./data/ecoku.sqlite3-shm
sudo chown 10001:10001 ./data/ecoku.sqlite3

sudo docker compose up -d
sudo docker compose ps
curl --fail http://127.0.0.1:12123/api/health
```

若配置或密钥也损坏，从同一备份目录恢复 `app/config.yaml`、`ecoku.env` 与 `compose.yaml` 后再启动。恢复后检查管理端、站点、评论与通知测试。
