# FAQ

The cause of most problems is in the container logs. Start here:

```bash
cd ~/Ecoku
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
```

## Deployment {#deploy}

::: details The container keeps restarting and the log says permission denied
The container runs as UID/GID `10001:10001` and must be able to read `app/config.yaml` and write to `data/`:

```bash
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
sudo chown "$(id -u):$(id -g)" app app/config.yaml
chmod 755 app
chmod 644 app/config.yaml
sudo docker compose up -d
```
:::

::: details The container keeps restarting and the log says config.yaml is a directory
`app/config.yaml` didn't exist before startup, so Docker created an empty directory there. Delete it, [write the configuration file](../self-hosting/docker#config), then start again:

```bash
cd ~/Ecoku
sudo docker compose stop ecoku
sudo rmdir app/config.yaml
```
:::

::: details Configuration changes don't take effect
After changing `app/config.yaml` or `compose.yaml`, recreate the container:

```bash
cd ~/Ecoku && sudo docker compose up -d --force-recreate --wait --wait-timeout 120 ecoku
```
:::

::: details Startup fails: 「通知凭据校验失败」 or 「CAPTCHA 凭据校验失败」 (credential check failed)
`data/ecoku-secrets.json` doesn't match the database. Confirm that it comes from the same backup as the database, is owned by the container user and has permissions `600`. Don't delete it to make the program generate a new one. See [Restore from backup](../self-hosting/backup#restore).
:::

::: details Startup fails: 「与已存储的公开站点来源重叠」 (overlaps a stored public site origin)
The admin console origin overlaps with a site's allowed origins. The admin console needs its own domain; see [Applying configuration and origin checks](./configuration#reload).
:::

## Comment section {#comments}

::: details No comment section appears on the page
When the loader can't find a required element or attribute, it shows nothing. Check that:

- The wrapper has `data-ecoku-comments` and contains the four elements `data-ecoku-mount`, `data-ecoku-loader`, `data-ecoku-status` and `data-ecoku-retry`;
- `data-server-url`, `data-site-id` and `data-page-key` all have values;
- In the browser's Network panel, both `ecoku-loader.js` and `ecoku.umd.js` load successfully.
:::

::: details It shows 「评论暂时不可用」 (Comments are temporarily unavailable)
The most common cause is that the post page's origin isn't registered. Add the `scheme://domain[:port]` from the browser's address bar to the site's [allowed origins](../admin/sites#origins) in the admin console. With and without `www` are two different origins.
:::

::: details Visitors often see 「提交过于频繁，请稍后再试。」 (You are posting too quickly. Try again later.)
`trusted_proxies` isn't configured, so all visitors are treated as one IP. See [Configure trusted_proxies](../self-hosting/reverse-proxy#trusted-proxies).
:::

::: details Comments fail to load on only one post
Check whether the comment list request in the Network panel returns `422`. That means the thread exceeds the limits of a single read; see [Threads and pagination](./concepts#threads). If several root comments together exceed the limit, lowering `data-page-size` fixes it.
:::

::: details Old comments disappeared after changing the blog's link format
Comments are stored by page key, and when the link format changes, the page key changes too. The data is still there; change `data-page-key` back to the original way of generating it. See [Page keys](./concepts#page-key).
:::

::: details Comment times are in the wrong time zone
Change `TZ` in `compose.yaml`, then recreate the container. See [Time zone and admin language](../self-hosting/docker#timezone).
:::

## Admin console {#admin}

::: details Can't find the initial password
Ecoku has no default password and never prints one in its logs. Generate one as described in [Get the temporary administrator password](../self-hosting/docker#temporary-password).
:::

::: details Can't sign in
Check these in order:

1. Open the admin console over HTTPS. Only `localhost` and `127.0.0.1` may use HTTP.
2. The origin in the address bar exactly matches `notifications.instance_public_url` (or `admin.allowed_origins`), including the port.
3. The username and password are correct. Each IP may make at most 5 sign-in requests per minute, successful ones included.
4. CAPTCHA completes normally. If the verification service is broken, [turn verification off from the command line](../admin/captcha#disable).
:::

::: details Forgot the admin password
Stop the service and generate a new temporary password with `admin reset-password`; see [Command line](./cli#admin-reset-password).
:::

## Notifications and CAPTCHA {#notify}

::: details Test email fails to send
See [Notifications · Troubleshooting](../admin/notifications#troubleshooting).
:::

::: details Saving Cap settings says the URL is invalid
The Cap URL must be a public HTTPS URL, without credentials, a query string or `#`. `localhost` and private-network IPs don't work.
:::

::: details After enabling Cap, the browser console shows CSP errors
If the error is on your blog pages, your blog's own CSP doesn't allow Cap; see [CSP for blog pages](../admin/captcha#csp). If the error is in the admin console, refresh the admin page.
:::
