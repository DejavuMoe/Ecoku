# Command line

The program in the image is `/app/ecoku-server`. Without arguments, it starts the service; with a subcommand, it runs a one-off task and exits.

Use `docker compose run` in the deployment directory so subcommands use the same configuration and mounts as the service:

```bash
cd ~/Ecoku
sudo docker compose run --rm --no-deps ecoku <subcommand> [arguments]
```

::: warning
A misspelled subcommand name doesn't cause an error; the service starts as usual instead. Check the spelling before running.
:::

For subcommands that write to the database (`admin reset-password`, `captcha disable`, `import-twikoo`), stop the service with `sudo docker compose stop ecoku` first.

Except for `healthcheck` and `hash-password`, every subcommand opens the database. If the database is on an older version, opening it runs migrations first and performs the same [origin check](./configuration#reload) as service startup. So if you've just switched to a new image and haven't upgraded the database yet, stop the service and take a cold backup before running any subcommand.

## healthcheck {#healthcheck}

Checks whether the running service responds; Compose's health check uses it. Available since v0.6.0. To run it manually:

```bash
sudo docker compose exec -T ecoku /app/ecoku-server healthcheck
```

It requests `http://127.0.0.1:12123/api/health` with a 2-second timeout. It exits with code 0 on a 200 response and 1 otherwise, and prints nothing on success. If the container port isn't 12123, add `--port=PORT`.

Run it with `exec` in the running container. A new container started with `run` has no running service, so the check always fails.

## admin reset-password {#admin-reset-password}

Generates a new temporary password for the administrator account, for first sign-in or a forgotten password. A new instance must have started once for the account to exist.

```bash
(
set -eu
cd ~/Ecoku
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d --wait --wait-timeout 120
)
```

The command prints `管理员临时密码：…` (temporary administrator password) and invalidates all signed-in sessions. The username stays the same. After signing in with the temporary password, you set a permanent password again, and can change the username at the same time.

The temporary password appears only in this command's terminal output, not in `docker compose logs`. If it reports `管理员账户尚未初始化` (administrator account not initialized), see [Docker installation](../self-hosting/docker#temporary-password).

## captcha status

Shows the current CAPTCHA settings. It can also run while the service is running:

```bash
sudo docker compose run --rm --no-deps ecoku captcha status
```

It prints one line, for example:

```text
provider=turnstile turnstile_secret_set=true cap_secret_set=false
```

## captcha disable {#captcha-disable}

Turns CAPTCHA off. Use it when the verification service is broken and you can't sign in to the admin console.

```bash
(
set -eu
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d --wait --wait-timeout 120 ecoku
)
```

The saved Turnstile and Cap settings are all kept; after signing in, fix them on the **Security** page and enable CAPTCHA again. If CAPTCHA is already off, it prints `CAPTCHA 已处于关闭状态` (CAPTCHA is already off).

## import-twikoo

Imports a Twikoo JSON export into a site that has no comments yet. For the full steps, see [Migrate from Twikoo](../self-hosting/twikoo).

Do a dry run with `--dry-run` first:

```bash
(
set -eu
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json --dry-run
)
```

After checking the result, remove `--dry-run` to run the real import:

```bash
(
set -eu
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json
sudo docker compose up -d --wait --wait-timeout 120 ecoku
)
```

| Argument | Description |
| --- | --- |
| `--site` | Target site ID. It must be registered in the admin console and have no comments at all (including deleted ones). |
| `--file` | File path inside the container. Put the file in the `data/` directory, and its path in the container is `/data/...`. |
| `--dry-run` | Runs the whole import and then rolls it back; prints only the statistics and saves nothing. |

On success, the last line is the statistics (dry run passed / import done, with counts of comments, root comments, replies, pages, emails, websites and missing parents):

```text
Twikoo 导入预检通过：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
Twikoo 导入完成：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
```

::: details Internal test configuration: password hashing

## hash-password {#hash-password}

Reads one line of password from standard input and prints a bcrypt hash (cost 10). It is used only by older instances that still inject the administrator through `ECOKU_ADMIN_PASSWORD_HASH`. New instances don't need it.

```bash
read -rsp 'Admin password: ' P; echo
printf '%s\n' "$P" | sudo docker run --rm -i ghcr.io/dejavumoe/ecoku:v0.6.3 hash-password
unset P
```

The password can't be empty or exceed 72 bytes in UTF-8 (the bcrypt limit); otherwise the command exits with an error.

When you write the output into `ecoku.env`, wrap it in single quotes:

```bash
ECOKU_ADMIN_PASSWORD_HASH='$2a$10$...'
```

Then recreate the container for it to take effect.

:::
