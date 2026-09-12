# Twikoo Historical Data Import

Ecoku provides a dedicated CLI tool to migrate historical comment data from Twikoo JSON exports with full data fidelity.

> [!IMPORTANT]
> **Initial Deployment Only**:
> The Twikoo import command (`import-twikoo`) **only supports target sites that are registered in the admin console and contain exactly 0 comments**.
> If new comments have already been submitted to the target site, the system **strictly rejects the import** to protect thread hierarchies, foreign key integrity, and comment ID continuity.

---

## Import Prerequisites & Contracts

1. **Target Site Must Be Empty**: Import is permitted only on a registered site with exactly zero comments. Appending into an active site is strictly prohibited.
2. **Mandatory Cold Backup**: Complete a cold backup before running the actual import.
3. **Dry-Run Support**: Supports dry-run execution (`--dry-run`) to parse and validate format without writing to the database.
4. **Single Atomic Transaction**: The entire import runs within a single SQLite transaction. Any syntax or structure error rolls back all operations, leaving no partial state.
5. **Silent Notifications**: The import process **never triggers** email or Telegram notifications.

---

## Field Mapping & Sanitization Rules

| Twikoo Source Field | Ecoku Mapping & Sanitization Rules |
| :--- | :--- |
| `_id` / `rid` / `pid` | Automatically mapped to reconstruct parent-child thread hierarchy (`parent_id`). |
| `url` (page identifier) | Sanitized into a canonical site-relative path (strips protocol, host, query params, and hash anchors). |
| `comment` (body) | Extracted and converted from historical HTML/Markdown into safe plain text, stripping all tags. |
| `nick` | Mapped to comment author nickname. |
| `mail` | Mapped to private email (used solely for future reply notifications, never exposed in public APIs). |
| `link` | Validated and mapped to author website (retains only safe `http://` or `https://` URLs). |
| `created` | Preserves original UNIX publication timestamp. |
| `ip` / `ua` / `os` | **Discarded immediately**, adhering strictly to Ecoku privacy boundaries. |
| `is_blogger` | Upon completion, automatically matched against the target site's blogger nickname and email to backfill badge flags. |

---

## Step-by-Step Import Guide

### 1. Dry-Run Verification

Place the exported JSON file on the host (e.g. `~/Ecoku/data/twikoo.json`) and run a dry-run validation:

```bash
cd ~/Ecoku

sudo docker compose run --rm --no-deps ecoku \
  import-twikoo \
  --site=blog \
  --file=/data/twikoo.json \
  --dry-run
```

Review the printed summary (root comments, descendant replies, skipped anomalies, etc.).

### 2. Execute Formal Import

Once the dry run completes without errors, execute the real database write:

```bash
cd ~/Ecoku

sudo docker compose run --rm --no-deps ecoku \
  import-twikoo \
  --site=blog \
  --file=/data/twikoo.json
```

### 3. Clean Up & Start Service

Immediately delete the unencrypted `twikoo.json` export file from disk (as it contains historical plaintext IPs and emails), then start the service:

```bash
# Safely remove temporary export file
rm -f ~/Ecoku/data/twikoo.json

# Start service
sudo docker compose up -d
```
