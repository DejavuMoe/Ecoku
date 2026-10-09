# Command line

The image's entry program is `/app/ecoku-server`. Without arguments, it starts the service. With one of the subcommands below, it runs a one-off task and exits. A misspelled subcommand name does not cause an error; the service starts as usual instead, so check the spelling before running.

In the deployment directory, use `docker compose run` to run a subcommand with the same config and mounts:

```bash
cd ~/Ecoku
sudo docker compose run --rm --no-deps ecoku <subcommand> [arguments]
```

Except for `hash-password`, every subcommand reads `app/config.yaml` and opens the database. Stop the service with `sudo docker compose stop ecoku` before running a subcommand that writes (`admin reset-password`, `captcha disable`, `import-twikoo`), so it does not write to the database at the same time as the running instance; `captcha status` only reads the settings and can run while the service is up.

## admin reset-password {#admin-reset-password}

Generate a new temporary password for the persistent administrator account. Stop the running service first:

```bash
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d
```

The command prints `管理员临时密码：…` and revokes every administrator session. The username stays the same; after signing in with it and the temporary password, the setup page fills in the current username, which you can keep or change, and you set a permanent password.

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
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```

The saved Turnstile and Cap settings and keys are all kept. After signing in to the admin console, you can fix them on the **Security** (安全) page and enable CAPTCHA again. If CAPTCHA is already off, the command prints `CAPTCHA 已处于关闭状态` (CAPTCHA is already off) and changes nothing.

## import-twikoo

Imports a Twikoo JSON export into a site that has no comments.

First run a dry run with `--dry-run`:

```bash
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json --dry-run
sudo docker compose up -d
```

After checking the result, drop `--dry-run` to run the real import:

```bash
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json
sudo docker compose up -d
```

| Argument | Description |
| --- | --- |
| `--site` | Target site ID. The site must already be registered in the admin console and have no comments at all (including deleted ones). |
| `--file` | Path of the export file inside the container. Put the file in the `data/` directory first (see [Migrate from Twikoo](../self-hosting/twikoo) for how); its path inside the container is `/data/...`. |
| `--dry-run` | Runs the complete import and then rolls it back. It only prints the statistics and saves no comments. |

On success, its last line prints the statistics in Chinese (prefixed with the date and time): counts of comments, root comments, replies, pages, emails, websites, and missing parents. A dry run reports 「预检通过」 (dry run passed); a real import reports 「完成」 (done), for example:

```text
Twikoo 导入预检通过：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
Twikoo 导入完成：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
```

See [Migrate from Twikoo](../self-hosting/twikoo) for the full steps, field mapping, and caveats.

::: details Internal test configuration: password hashing

## hash-password {#hash-password}

Reads one line of password from standard input and prints a bcrypt hash (cost 10) for the legacy `ECOKU_ADMIN_PASSWORD_HASH` variable. New instances generate the administrator during first start and do not need this command. It does not read the config or touch the database, so you can run it while the service is running.

```bash
read -rsp 'Admin password: ' P; echo
printf '%s\n' "$P" | sudo docker run --rm -i ghcr.io/dejavumoe/ecoku:v0.3.8 hash-password
unset P
```

The password cannot be empty and cannot exceed 72 bytes in UTF-8 (the bcrypt limit). If it does, the command exits with an error.

When you write the output into `ecoku.env`, wrap it in single quotes:

```bash
ECOKU_ADMIN_PASSWORD_HASH='$2a$10$...'
```

Then recreate the container for it to take effect.

:::
