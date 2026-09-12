# Backup & Disaster Recovery

All persistent Ecoku state—including site configurations, comments, encrypted credentials, and migration records—is stored in a single SQLite3 database file.

---

## 1. Cold Snapshot Backup (Recommended & Fail-Safe)

Before performing version upgrades, host migrations, or major configuration changes, **a cold backup with the service stopped is the safest approach**.

```bash
cd ~/Ecoku

# 1. Stop the running container to ensure full SQLite WAL checkpointing
sudo docker compose down

# 2. Archive data directory, configuration, and environment file
BACKUP_NAME="ecoku-backup-$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czvf "$BACKUP_NAME" data/ app/config.yaml ecoku.env compose.yaml

# 3. Secure permissions and move archive to safe offline or off-site storage
chmod 600 "$BACKUP_NAME"
mkdir -p ~/backups && mv "$BACKUP_NAME" ~/backups/

# 4. Restart service
sudo docker compose up -d
```

---

## 2. Host Online Snapshot (`VACUUM INTO`)

If the `sqlite3` CLI is installed on the host and zero downtime is preferred, you can invoke SQLite's native atomic snapshot command `VACUUM INTO` directly against the database file. This produces a consistent, defragmented single-file backup without holding table locks:

```bash
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)

# Execute VACUUM INTO on the host to generate an atomic snapshot
mkdir -p ~/backups
sqlite3 ~/Ecoku/data/ecoku.sqlite3 "VACUUM INTO '$HOME/backups/backup_${BACKUP_DATE}.sqlite3'"
```

> [!NOTE]
> The container runtime is based on a minimal Alpine image without the `sqlite3` CLI. If your host lacks `sqlite3`, use the cold backup method above (most reliable, zero extra dependencies).

---

## 3. Restore SOP

Follow this exact sequence if data corruption, operational error, or full-host migration occurs:

```bash
cd ~/Ecoku

# Step 1: Stop container
sudo docker compose down

# Step 2: Quarantine damaged state (rename existing directory)
mv data data_corrupted_$(date +%Y%m%d_%H%M%S)
mkdir -p data

# Step 3: Extract backup archive
tar -xzvf ~/backups/ecoku-backup-YYYYMMDD_HHMMSS.tar.gz

# Step 4: Verify and repair file ownership and permissions (must be 10001:10001)
sudo chown -R 10001:10001 data app/config.yaml
sudo chmod 750 data
sudo chmod 640 app/config.yaml
sudo chmod 600 ecoku.env

# Step 5: Start container
sudo docker compose up -d

# Step 6: Check logs and service health
sudo docker compose logs --tail=100 ecoku
curl -f http://127.0.0.1:12123/api/health
```

---

## 4. Post-Restore Verification Checklist

After restoring data, complete this verification checklist:

- [ ] `curl -f http://127.0.0.1:12123/api/health` returns HTTP 200 with `data.status: "healthy"`.
- [ ] Admin console at `/admin/` logs in successfully.
- [ ] Registered sites and settings are intact; blogger passphrase and badge render correctly.
- [ ] Public comment thread loads historical comments properly.
- [ ] Submit a test comment to confirm immediate publication.
