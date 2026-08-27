# Twikoo import

One-time import: the target site must already exist in the admin UI and must have zero comments. Preserves time, nickname, private email, website, page key, and reply relationships; bodies become plain text. Does not import IP, UA, region, avatars, votes, or external user IDs, and does not send historical notifications.

Page keys drop query strings and fragments; absolute URLs keep only the path. Writes run in a single transaction; export max is about 64 MB. Broken parent comments become roots and are reported in the result. After import, `is_blogger` is backfilled from the site’s blogger nickname+email.

## Backup

Before import, take a stopped cold backup per [Backup & restore](./backup). Confirm no leftover WAL/SHM:

```bash
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm
```

## Dry-run and import

Keep the export file outside the service directory and mount it read-only by absolute path:

```bash
sudo docker compose run --rm --no-deps \
  --volume <ABSOLUTE_PATH>/twikoo-comment.json:/import/twikoo-comment.json:ro \
  ecoku import-twikoo \
  --site <SITE_ID> \
  --file /import/twikoo-comment.json \
  --dry-run
```

When ready, drop `--dry-run` and run once, then:

```bash
sudo docker compose up -d
```

Import is refused if the target site already has comments. After acceptance, delete the original export that contains private emails.
