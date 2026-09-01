# Twikoo Migration

Ecoku provides a built-in CLI tool to migrate discussions from Twikoo JSON exports.
> [!IMPORTANT]
> **Initial Deployment Only**:
> The Twikoo import command (`import-twikoo`) **only supports target sites that have exactly 0 comments**.
> If new comments have already been submitted to the site, import will be strictly rejected to safeguard discussion trees, foreign keys, and comment ID continuity.

---

## Prerequisites
- Destination site must be registered and contain **0 comments**.
- A full cold backup must be completed.
- The import runs in a single SQLite transaction and triggers **zero notifications**.

---

## Usage

```bash
cd ~/Ecoku

# 1. Dry run verification
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo \
  --site=blog \
  --file=/data/twikoo.json \
  --dry-run

# 2. Execute import
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo \
  --site=blog \
  --file=/data/twikoo.json

# 3. Clean up export file and restart
rm -f ~/Ecoku/data/twikoo.json
sudo docker compose up -d
```
