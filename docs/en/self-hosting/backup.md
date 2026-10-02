# Backup and restore

All of Ecoku's state lives in the deployment directory. A complete backup contains four items:

| Path | Contents |
| --- | --- |
| `data/` | The SQLite database, plus the `-wal` and `-shm` files created at runtime. Sites, comments, notification settings, and verification settings are all here. |
| `ecoku.env` | Admin credentials and the encryption master key. Without the master key, the SMTP, Telegram, and verification credentials saved in the database cannot be decrypted, and the service refuses to start. |
| `app/config.yaml` | Instance config. |
| `compose.yaml` | Records the image version in use. When you restore, start the same version. |

`ecoku.env` contains secrets. Keep backup files only in places you control.

## Cold backup with the service stopped {#cold-backup}

This is the recommended method. Stop the service, pack the four items into one archive, verify it, and then start the service again. The comment section cannot load while the service is stopped, but the whole process usually takes only a few seconds.

Copy and run the whole block. If any step fails, the block aborts and the service stays stopped. Find the cause, then start the service by hand.

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

This script:

- Creates `ecoku-<date>_<time>.tar.gz` under `~/backups/`, with the directory and file readable only by the current user;
- Uses `sudo` to read the data files owned by UID 10001;
- Packs the entire `data/` directory, including any leftover WAL files;
- Finally checks that the archive can be read and that all required files are in it. This shows only that the archive is complete; it is not the same as a restore drill.

## Online snapshot

If you do not want to stop the service, you can take a consistent snapshot of the running database with the `sqlite3` command on the host. Install sqlite3 first (Debian/Ubuntu: `sudo apt install sqlite3`).

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

The result is a directory containing the database snapshot `database.sqlite3` (owned by root, mode 600) and the config archive `config.tar.gz`. Its format differs from a cold backup, so you cannot use it directly with the restore script below. If the config changed while the snapshot was being taken, the database and config may not match. When the two must correspond exactly, use a cold backup.

To restore from a snapshot, stop the service first, delete any leftover WAL files, and then put the database back owned by the container user (change `snapshot=` to the snapshot directory):

```bash
cd ~/Ecoku
snapshot="$HOME/backups/ecoku-snapshot-XXXXXXXX"
sudo docker compose down
sudo rm -f data/ecoku.sqlite3-wal data/ecoku.sqlite3-shm
sudo install -o 10001 -g 10001 -m 600 "$snapshot/database.sqlite3" data/ecoku.sqlite3
sudo docker compose up -d
```

If you also need to restore the config, unpack `config.tar.gz` before starting, and fix ownership and permissions as in the restore script below.

## Restore from a cold backup {#restore}

Restoring replaces the current database and config with the state in the backup. Comments and settings changes made after the backup are lost.

First change `archive=` in the script to the path of the archive you want to restore. The script runs in the original deployment directory; when restoring on a new host, create `~/Ecoku` first as in step 1 of [Docker deployment](./docker). The script:

1. Checks that the archive contains the required files;
2. Stops the service;
3. Moves the current `data/`, config, and environment file into `recovery-before-<date>_<time>/`, so you can get them back if needed;
4. Unpacks the archive and fixes ownership and permissions;
5. Starts the service and checks the health endpoint.

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
sudo chown "$(id -u):$(id -g)" app app/config.yaml ecoku.env compose.yaml
chmod 755 app
chmod 644 app/config.yaml
chmod 600 ecoku.env
sudo docker compose up -d
curl --fail --silent --show-error --retry 15 --retry-delay 2 --retry-all-errors \
  http://127.0.0.1:12123/api/health
)
```

The entire `data/` directory is replaced, so old WAL files do not get mixed into the restored database. `compose.yaml` also comes from the backup, so the service starts with the image version that was in use at backup time.

A healthy health endpoint only means the process is running. After restoring, also confirm that you can sign in to the admin console, that the site settings are correct, and that post pages show their existing comments.

Restore only archives from trusted sources.
