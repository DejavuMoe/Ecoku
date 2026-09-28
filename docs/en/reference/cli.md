# Command line

The image's entry program is `/app/ecoku-server`. Without arguments, it starts the service. With one of the subcommands below, it runs a one-off task and exits.

In the deployment directory, use `docker compose run` to run a subcommand with the same config and mounts:

```bash
cd ~/Ecoku
sudo docker compose run --rm --no-deps ecoku <subcommand> [arguments]
```

Except for `hash-password`, every subcommand reads `app/config.yaml` and opens the database. If the database is on an older version than the current image, it is migrated first. Stop the service with `sudo docker compose down` before running a subcommand, so it does not write to the database at the same time as the running instance.

## hash-password {#hash-password}

Reads one line of password from standard input and prints a bcrypt hash (cost 10) for `ECOKU_ADMIN_PASSWORD_HASH`. It does not read the config or touch the database, so you can run it while the service is running.

```bash
read -rsp 'Admin password: ' P; echo
printf '%s\n' "$P" | sudo docker run --rm -i git.via.moe/dejavu/ecoku:v0.2.6 hash-password
unset P
```

The password cannot be empty and cannot exceed 72 bytes in UTF-8 (the bcrypt limit). If it does, the command exits with an error.

When you write the output into `ecoku.env`, wrap it in single quotes:

```bash
ECOKU_ADMIN_PASSWORD_HASH='$2a$10$...'
```

Then recreate the container for it to take effect.

## captcha status

Shows the current CAPTCHA settings:

```bash
sudo docker compose run --rm --no-deps ecoku captcha status
```

It prints one line, for example:

```text
provider=turnstile turnstile_secret_set=true cap_secret_set=false
```

## captcha disable {#captcha-disable}

Turns CAPTCHA off. Use it when a misconfigured verification service keeps the admin from signing in to the admin console.

```bash
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```

The saved Turnstile and Cap settings and keys are all kept. After signing in to the admin console, you can fix them on the **Security** (安全) page and enable CAPTCHA again. If CAPTCHA is already off, the command prints `CAPTCHA 已处于关闭状态` (CAPTCHA is already off) and changes nothing.

## import-twikoo

Imports a Twikoo JSON export into a site that has no comments.

```bash
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json [--dry-run]
```

| Argument | Description |
| --- | --- |
| `--site` | Target site ID. The site must already be registered in the admin console and have no comments at all (including deleted ones). |
| `--file` | Path of the export file inside the container. Put the file in the `data/` directory first; its path inside the container is `/data/...`. |
| `--dry-run` | Runs the complete import and then rolls it back. It only prints the statistics and saves no comments. |

On success, it prints the statistics in Chinese: counts of comments, root comments, replies, pages, emails, websites, and missing parents. A dry run reports “预检通过” (dry run passed); a real import reports “完成” (done):

```text
Twikoo 导入预检通过：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
Twikoo 导入完成：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
```

See [Migrate from Twikoo](../self-hosting/twikoo) for the full steps, field mapping, and caveats.
