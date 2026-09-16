# Twikoo Historical Data Import

`import-twikoo` converts supported fields from a Twikoo JSON array into Ecoku plain-text comments. The target site must already exist and contain zero comments, including tombstones. Import sends no notifications and discards IPs, user agents, avatars, reactions and external user identities.

## Fields and conversions

| JSON | Ecoku |
| :--- | :--- |
| `_id` / `id`, `pid` / `rid` | Rebuild IDs and parent relationships, preferring the direct parent. Missing, cross-page or unresolved parents may become root comments and count as orphaned records. |
| `url` | Extract the site-relative path and remove query / fragment. |
| `comment` | Extract HTML text, discard script/style, and replace images with alt text or `[图片]`. Markdown syntax is not parsed. |
| `nick` / `mail` / `link` | Preserve nickname, private email and valid http(s) author websites. |
| `created` / `updated` | Convert and preserve timestamps. |
| Blogger flag | Backfill using the target site’s configured nickname and email; the export’s `is_blogger` field is not read. |

## 1. Prepare before validation

Register the target site and complete a verified cold backup using [Backup and recovery](./backup). The backup example restarts the service at the end, so stop it again before importing. The commands below copy the export into a temporary file readable by container UID 10001. Replace `/path/to/twikoo.json` with your source file and retain the original.

```bash
cd ~/Ecoku
sudo docker compose down
sudo install -o 10001 -g 10001 -m 600 /path/to/twikoo.json data/twikoo.json
```

## 2. Run a dry run

Replace `blog` with the target site ID. A dry run executes the import transaction and rolls it back, so imported comments are not persisted. CLI startup can still initialize or migrate the database; this is not a read-only operation.

```bash
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json --dry-run
```

Review the counts for comments, roots, replies, pages, emails, websites and orphaned records. Invalid JSON, duplicate IDs and similar errors abort the import. Unresolved parent relationships are retained as roots, not skipped.

## 3. Import and clean up

After reviewing the dry run and verifying the backup, keep the service stopped and run the same command without `--dry-run`. A failed import transaction rolls back in full. On success, remove only this temporary copy, start the service and check the target site and historical comments. Retain originals and backups according to your own retention policy.

```bash
(
set -eu
cd ~/Ecoku
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json
sudo rm -- data/twikoo.json
sudo docker compose up -d
)
```
