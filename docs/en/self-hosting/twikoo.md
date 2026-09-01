# Twikoo Migration

Ecoku provides a built-in CLI tool to migrate discussions from Twikoo JSON exports.

---

## Prerequisites
- Destination site must be registered and contain **0 comments**.
- A full cold backup must be completed.
- The import runs in a single SQLite transaction and triggers **zero notifications**.

---

## Usage

```bash
# 1. Dry run verification
sudo docker compose run --rm --no-deps ecoku \
  ecoku-server import-twikoo \
  --site-id=blog \
  --file=/data/twikoo.json \
  --dry-run

# 2. Execute import
sudo docker compose run --rm --no-deps ecoku \
  ecoku-server import-twikoo \
  --site-id=blog \
  --file=/data/twikoo.json

# 3. Clean up export file and restart
rm -f ~/Ecoku/data/twikoo.json
sudo docker compose up -d
```
