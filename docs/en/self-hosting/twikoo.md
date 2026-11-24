# Migrate from Twikoo

The `import-twikoo` command imports comments exported from Twikoo into a registered Ecoku site and keeps their reply relationships.

Imported comments are public immediately, and no notifications are sent during the import.

::: warning You can import only once
The target site must have no comments at all, including deleted ones. Finish the import before you open the new site for comments.
:::

<div class="steps">

### Prepare

1. [Register the target site](../admin/sites) in the admin console. If you want your own past comments to carry the blogger badge, set up the [blogger name and email](../admin/blogger) first.
2. Export your comments from Twikoo. You get a file containing a JSON array (64 MiB at most).
3. Take a cold backup as described in [Backup and restore](./backup#cold-backup), and keep the service stopped until the import is done.

Copy the export file into `data/` so the container can read it (replace `/path/to/twikoo.json` with the actual path):

```bash
cd ~/Ecoku
sudo docker compose stop ecoku
sudo install -o 10001 -g 10001 -m 600 /path/to/twikoo.json data/twikoo.json
```

### Dry run

Replace `blog` with your site ID and run with `--dry-run`:

```bash
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json --dry-run
```

The dry run goes through the whole import and then rolls it back, saving no comments. The output looks like this (dry run passed, with counts of comments, root comments, replies, pages, emails, websites and missing parents):

```text
Twikoo 导入预检通过：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
```

Check that the numbers roughly match what you have in Twikoo. If 「缺失父记录」 (missing parents) is not 0, some replies can't find their original comment and become root comments (they are not dropped).

If the export has records with `isSpam: true`, the command stops and reports how many. Delete those records from a copy of the export file and run the dry run again.

::: details Other cases that make the command fail
Malformed JSON, a file over 64 MiB, an empty array, duplicate IDs, a body over 10000 characters, a name over 80 characters, an empty page key or one over 512 characters, or a site that doesn't exist or already has comments. On error, no comments are saved.
:::

### Import

Run the command again without `--dry-run`. The import runs in one transaction; an error in any record rolls back the whole import. After it succeeds, delete the temporary copy and start the service:

```bash
(
set -eu
cd ~/Ecoku
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json
sudo rm -- data/twikoo.json
sudo docker compose up -d --wait --wait-timeout 120 ecoku
)
```

Open a few posts and confirm that past comments and reply relationships are right.

</div>

## Page keys must match

On import, the page key comes from the path of the `url` in each Twikoo record, such as `/posts/hello-world/`. Chinese and other non-ASCII characters are stored percent-encoded, such as `/posts/%E4%BD%A0%E5%A5%BD/`.

The `data-page-key` your embed code generates must match it exactly, or past comments won't appear under the right posts. The admin comment list shows each comment's page key; compare it with what your blog template outputs. If a trailing slash or the encoding differs, adjust the embed code, not the imported data.

## Field mapping

| Twikoo field | After import |
| --- | --- |
| `_id` / `id`, `pid`, `rid` | Reply relationships are rebuilt, preferring the direct parent identified by `pid`. If `pid` is empty or the record is not in the export, Ecoku tries to attach the comment under the root comment identified by `rid`. If the referenced parent can't be found, is on another page, or forms a cycle, the comment becomes a root comment and counts toward 「缺失父记录」 (missing parents). Valid descendants on the same page keep their reply relationships. |
| `url` | The path becomes the page key, with the query string and `#` fragment removed. An HTTP(S) homepage URL with no path (such as `https://blog.example`) uses `/`. |
| `comment` | HTML becomes plain text: `<br>` and block-level elements become line breaks; when tags are removed, indentation, tabs and internal blank lines of text inside `<pre>` are kept; images become their alt text or `[图片]` ("image"); `<script>` and `<style>` are dropped. Markdown is not parsed. |
| `nick` | Name. If empty, it is recorded as 「访客」 ("Visitor"). |
| `mail` | Private email, used for later reply notifications. Addresses over 254 characters are not imported. |
| `link` | Visitor website. Only `http`/`https` URLs are kept; an address without a scheme (such as `example.com`) gets `https://` added. |
| `created` / `updated` | Creation and update times. |

Not imported: IP addresses, User-Agents, avatars, likes, Twikoo user IDs, and the blogger flags in the export file.

Blogger marks are backfilled from the target site's current blogger name and email: comments whose name matches exactly and whose email matches (case-insensitive) are marked as blogger comments.
