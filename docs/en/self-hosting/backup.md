# Backup and recovery

## 1. Cold backup

Run the complete block. Any failed command stops the block and leaves the service stopped; resolve the failure before restarting. The off-volume archive is private from creation. sudo reads files owned by UID 10001. Archive the entire data directory, including any WAL/SHM files: a successful stop does not prove checkpoint completion. Archive validation checks readability and required members; it does not replace a recovery drill.

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

## 2. Online database snapshot

Requires sqlite3 on the host. The database snapshot is root-owned with mode 600 inside a mode 700 directory. Keep the configuration archive and decryption key with it. Do not change configuration during capture; use a cold backup when strict consistency is required. This snapshot is not the cold archive expected by the recovery block below.

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

## 3. Restore a cold backup

Use a trusted archive and replace its filename. The commands preserve the current data and configuration before restoring the whole archive, avoiding stale WAL files. Restore the original image tag and decryption key together. Then check admin login, site settings, historical comments and an authorized new comment. Health only proves that the process responds.

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
