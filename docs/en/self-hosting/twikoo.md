# Migrate from Twikoo

The `import-twikoo` command imports comments exported from Twikoo into one Ecoku site. You can import only once: the target site must already be registered and must have **no comments at all** (including deleted ones). Do this after the new site is set up and before anyone posts a comment.

## What is imported

| Twikoo field | After import |
| --- | --- |
| `_id` / `id`, `pid`, `rid` | Reply relationships are rebuilt, preferring the direct parent comment. If the direct parent is not in the export file, the comment is attached under the root comment that `rid` points to. If neither can be found, the parent is on a different page, or forms a cycle, the comment becomes a root comment and is counted as a "missing parent". |
| `url` | The path part becomes the page key, with the query string and `#` fragment removed. |
| `comment` | HTML is converted to plain text: `<br>` and block-level elements become line breaks, images become their alt text or `[图片]` ("image"), and `<script>` and `<style>` are dropped. Markdown is not parsed. |
| `nick` | Nickname. If empty, it is recorded as "访客" ("Visitor"). |
| `mail` | Private email address, used for later reply notifications. Addresses longer than 254 characters are not imported. |
| `link` | Visitor website. Only `http`/`https` URLs are kept; an address without a scheme (such as `example.com`) gets `https://` added. |
| `created` / `updated` | Creation and update times. |

Not imported: IP addresses, User-Agents, avatars, likes, Twikoo user IDs, and the blogger flags in the export file.

Imported comments are public immediately, and the import does not send any notifications.

**Blogger marks** are backfilled from the target site's blogger nickname and email at the time of import: comments whose nickname matches exactly and whose email matches (case-insensitive) are marked as blogger comments. If you want this, set up the blogger identity in the admin console before importing.

## 1. Prepare

1. [Register the target site](./admin#sites) in the admin console. If you want blogger markers backfilled, set both the blogger nickname and the blogger email.
2. Export your comments from Twikoo. You get a file containing a JSON array (64 MiB at most).
3. Take a cold backup as described in [Backup and restore](./backup#cold-backup). The backup script starts the service at the end; you stop it again below.

Copy the export file into the `data/` directory so the container user can read it (replace `/path/to/twikoo.json` with the actual path; the original file is left untouched):

```bash
cd ~/Ecoku
sudo docker compose stop ecoku
sudo install -o 10001 -g 10001 -m 600 /path/to/twikoo.json data/twikoo.json
```

## 2. Dry run

Replace `blog` with the target site ID and run with `--dry-run` first:

```bash
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json --dry-run
```

The dry run performs the complete import and then rolls it back, so no comments are saved. The output looks like this (in Chinese: dry run passed, with counts of comments, root comments, replies, pages, emails, websites, and missing parents):

```text
Twikoo 导入预检通过：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
```

Check that these numbers match what you have in Twikoo. If "missing parents" (缺失父记录) is not 0, some replies will become root comments; they are not skipped.

If the JSON is malformed, the export is an empty array, there are duplicate IDs, a body exceeds 10000 characters, a nickname exceeds 80 characters, a page key is empty or exceeds 512 characters, or the target site does not exist or already has comments, the command exits with an error and changes nothing.

::: info
The dry run does not save comments, but the command still opens the database when it starts. If the database is on an older version, it is migrated first, so this is not a fully read-only operation.
:::

## 3. Import

Once the dry-run results and the backup both look right, run the command again without `--dry-run`. The import runs in one transaction, and an error in any single record rolls back the whole import. After it succeeds, delete the temporary copy and start the service:

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

Open a few posts and confirm that the existing comments and their reply relationships look right. Keep or delete the original export file and the backup as you see fit.

## Page keys must match

On import, the page key comes from the path of the `url` in each Twikoo record, such as `/posts/hello-world/`. Chinese and other non-ASCII characters in the path are stored in percent-encoded form, such as `/posts/%E4%BD%A0%E5%A5%BD/`.

When you embed the comment section, `data-page-key` must produce exactly the same string, or the existing comments will not appear under the right posts. After importing, you can see each comment's page key in the comment details in the admin console and compare it with the value your blog template outputs. If they differ (for example, a trailing `/` or encoding), adjust the embed code; do not change the imported data.
