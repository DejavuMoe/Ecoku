# FAQ

When something goes wrong, check the container logs first. Most startup errors state their cause there:

```bash
cd ~/Ecoku
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
```

## Deployment and startup

### The container keeps restarting and the log says permission denied

The container runs as UID/GID `10001:10001`. It needs to read `app/config.yaml` and write to `data/`. Fix ownership and permissions, then restart:

```bash
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
sudo chown "$(id -u):$(id -g)" app app/config.yaml
chmod 644 app/config.yaml
sudo docker compose up -d
```

`app/config.yaml` holds no secrets, so it can belong to your own account, and later edits do not need `sudo`.

### Permission denied when editing app/config.yaml {#config-permission}

Earlier deployment steps gave `app/` and `app/config.yaml` to root or UID 10001. Give them back to your own account; you do not need to recreate the container:

```bash
cd ~/Ecoku
sudo chown "$(id -u):$(id -g)" app app/config.yaml
chmod 755 app
chmod 644 app/config.yaml
```

### The container keeps restarting and the log says config.yaml is a directory

`app/config.yaml` did not exist before startup, so Docker created an empty directory in its place. Stop the service, delete that directory, write the configuration file again as in step 3 of [Docker deployment](./docker), and then start:

```bash
cd ~/Ecoku
sudo docker compose stop ecoku
sudo rmdir app/config.yaml
```

### Saving a site says "公开站点来源不能复用管理端来源" (a public site origin cannot reuse an admin origin)

The site's allowed origins overlap with the admin console's origin. The admin origin defaults to `notifications.instance_public_url`; if you set `admin.allowed_origins`, that list is used instead. The admin console must use its own origin, usually Ecoku's own domain, such as `https://ecoku.example.com`.

### Startup fails and the log says "通知凭据校验失败" or "CAPTCHA 凭据校验失败" (credential check failed)

Stored SMTP, Telegram and CAPTCHA credentials are all encrypted with the notification encryption key; with a different key they cannot be decrypted. Check that `ecoku-secrets.json` beside the database belongs to the same instance, is owned by the container user and has mode `600`. Do not delete the file to make Ecoku generate new keys. If the file is missing or does not match the database, restore the database and keys from the same backup; see [restore](./backup#restore).

If an internal test instance still injects `ECOKU_NOTIFICATION_ENCRYPTION_KEY`, its value must match the key in the persistent file. Otherwise startup fails with `持久通知加密主密钥与旧环境变量不一致；为避免无法解密已有凭据，已拒绝启动`.

### Configuration changes do not take effect

New deployments do not use `ecoku.env`. After changing `app/config.yaml` or Compose, recreate the container:

```bash
cd ~/Ecoku && sudo docker compose up -d --force-recreate ecoku
```

## Comment section

### No comment section appears on the page

When the loader cannot find a required element or attribute, it skips the section silently. Check that:

- the wrapper element has `data-ecoku-comments` and contains the four elements `data-ecoku-mount`, `data-ecoku-loader`, `data-ecoku-status` and `data-ecoku-retry`, structured as in the [embed example](../integration/html);
- the three attributes `data-server-url`, `data-site-id` and `data-page-key` all have values;
- in the browser developer tools' Network panel, `ecoku-loader.js` and `ecoku.umd.js` load successfully.

### The comment section shows "评论暂时不可用" (Comments are temporarily unavailable) or reports a permission error

Usually the post page's origin is not registered. On the 「站点」 (Sites) page of the admin console, add the `scheme://host[:port]` shown in the browser's address bar to the site's allowed origins. Origins with and without `www` are two different origins.

### Visitors often see "提交过于频繁，请稍后再试。" (You are posting too quickly. Try again later.)

Ecoku runs behind a reverse proxy, but `trusted_proxies` is not configured, so all visitors count as one IP and share the default quota of 5 submissions per minute. Fill in the Docker gateway address as described in [Reverse proxy](./reverse-proxy#trusted-proxies), and make sure the reverse proxy overwrites `X-Forwarded-For`.

### Comments fail to load on one post but work on others

The discussion on this post may exceed the limits of a single read (200 comments, 16 levels or 1 MiB). You can lower `data-page-size` in the embed code. If a single thread is itself too large, lowering it does not help, and you need to delete some comments in the admin console. See [Threads and pagination](../guide/concepts#threads).

### Old comments disappeared after changing the blog's link format

Comments are stored by page key. When the link format changes, the page keys produced by the embed code change too. The data is still in the database: change `data-page-key` back to the original scheme and the comments show up again.

### Comment times are in the wrong time zone

Set the time zone in Compose at `services.ecoku.environment.TZ`, for example `TZ: Asia/Tokyo`, then recreate the container. No `ecoku.env` is needed; see [Time zone and admin language](./docker#timezone).

## Admin console

### Cannot sign in

Check these in order:

1. You are opening the admin console over HTTPS. Only loopback addresses such as `localhost` and `127.0.0.1` may use HTTP.
2. The origin in the address bar matches `notifications.instance_public_url` (or `admin.allowed_origins`, if you set it) exactly, including the port.
3. The username and password are correct. By default each IP may make at most 5 sign-in requests per minute (successful ones count too); beyond that, wait as prompted. Without [`trusted_proxies`](./reverse-proxy#trusted-proxies), everyone shares this one allowance.
4. The CAPTCHA widget completes normally. If the verification service has problems, turn CAPTCHA off temporarily with `captcha disable`; see [CAPTCHA](./captcha#disable).

### Forgot the admin password

The administrator account is stored in the database under `data/`. Stop the service and generate a new temporary password:

```bash
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d
```

The command prints `管理员临时密码：…` and signs out every administrator session. The username stays the same; after signing in with the new temporary password you must set a password again. If an internal test instance still injects administrator credentials through environment variables, the reset hands the account over to the database, and the username and password hash in those variables no longer apply.

## Notifications and CAPTCHA

### Test email fails to send

See [Notifications](./notifications#troubleshooting).

### Saving Cap settings says the URL is invalid

The Cap instance URL must be a publicly reachable HTTPS URL without a username and password, query string or `#` fragment. `localhost`, `127.0.0.1` and private-network IPs are rejected.

### After enabling Cap, the browser console shows CSP errors

If the error appears on your blog pages, your blog's own CSP does not allow Cap. Add the Cap instance origin, `worker-src blob:` and WebAssembly permissions; see [CAPTCHA · Content Security Policy](./captcha#csp). Ecoku adjusts the admin console's CSP automatically, so you do not need to change it.
