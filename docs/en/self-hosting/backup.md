# Backup & restore

The production database path is `data/ecoku.sqlite3` (plus WAL / SHM). Stopping the container checkpoints the WAL. Backups must include configuration and secrets as well.

## Cold backup

In the instance directory:

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

Backup directories and secret files should be readable only by administrators. For long-term retention, copy the whole backup directory to controlled storage—do not copy only the SQLite file.

## Restore

Stop the service, keep a separate copy of the current state, then restore:

```bash
cd ~/Ecoku
sudo docker compose down

backup_file="./backups/YYYYMMDD-HHMMSS/ecoku.sqlite3" # change to the real path
test -f "$backup_file"
sudo cp --preserve=mode,timestamps "$backup_file" ./data/ecoku.sqlite3
sudo rm -f ./data/ecoku.sqlite3-wal ./data/ecoku.sqlite3-shm
sudo chown 10001:10001 ./data/ecoku.sqlite3

sudo docker compose up -d
sudo docker compose ps
curl --fail http://127.0.0.1:12123/api/health
```

If configuration or secrets are also damaged, restore `app/config.yaml`, `ecoku.env`, and `compose.yaml` from the same backup directory before starting. After restore, check the admin UI, sites, comments, and a notification test.
