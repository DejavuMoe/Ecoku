# FAQ & Troubleshooting

A consolidated diagnostic guide and troubleshooting solutions for common deployment, operation, and administration scenarios in Ecoku.

---

## 1. Authentication & Permissions

### Q: Does login survive a reload or reopening the browser?

Administrator sessions use an HttpOnly cookie; SQLite stores only the credential digest and expiry. Sessions expire exactly eight hours after login. Reloading or reopening restores a valid session without extending its deadline. Logout revokes the current session on the server; a failed logout keeps the current screen and offers retry. Credentials do not enter JavaScript, localStorage, sessionStorage or URLs.

### Q: Container startup fails with `permission denied` or cannot access SQLite database?
**A**: The Ecoku container runs as non-root user `10001:10001`. Fix directory and file ownership on the host:
```bash
sudo chown -R 10001:10001 ~/Ecoku/data ~/Ecoku/app/logs ~/Ecoku/app/config.yaml
sudo chmod 750 ~/Ecoku/data ~/Ecoku/app/logs
sudo chmod 640 ~/Ecoku/app/config.yaml
```

---

## 2. Bot Protection (CAPTCHA) & Emergency Recovery

### Q: Locked out of the admin console due to misconfigured Turnstile or Cap?
**A**: Use the built-in CLI recovery tool to disable bot verification offline:
```bash
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```
Once the service restarts, log into the admin console with your username and password, correct the credentials, and save.

### Q: Console shows Content Security Policy (CSP) errors when using self-hosted Cap?
**A**: Ecoku generates an exact CSP dynamically based on the active provider. If using Cap, ensure:
1. In admin security settings, the Cap **instance address must begin with `https://`** (local HTTP allowed only on `localhost`).
2. The Cap verify endpoint (`/<sitekey>/siteverify`) must be served under the same HTTPS origin.
3. If the Cap client enables client-side instrumentation, Ecoku's CSP automatically allows the required `'unsafe-eval'` and WebAssembly evaluation.

---

## 3. Reverse Proxy & Rate Limiting

### Q: Visitors frequently encounter `429 Too Many Requests` when submitting comments?
**A**: This typically happens when `trusted_proxies` is not configured, causing all incoming requests to be seen as originating from the single reverse proxy gateway IP (e.g. Docker bridge `172.18.0.1`), sharing a single rate-limit bucket.
**Resolution**:
1. Query the Docker container gateway:
   ```bash
   sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{"\n"}}{{end}}'
   ```
2. Add the gateway IP to `site.trusted_proxies` in `app/config.yaml` (e.g. `172.18.0.1/32`).
3. Ensure Caddy or Nginx **overwrites** `X-Forwarded-For` with `{remote_host}` or `$remote_addr`.

---

## 4. Notifications & Timezone

### Q: Test email delivery fails or times out with TLS handshake errors?
**A**:
- Ecoku accepts only `tls` or `starttls` encryption. Use the port required by your mail provider (commonly 465 / 587); plaintext SMTP is unsupported.
- Allow outbound TCP on the configured SMTP port in your host firewall and cloud security groups.
- Verify that `ECOKU_NOTIFICATION_ENCRYPTION_KEY` in `ecoku.env` is properly set; without it, encrypted SMTP credentials cannot be decrypted from the database.

### Q: Comment timestamps do not match local server time?
**A**:
- Ecoku formats timestamps according to the `TZ` environment variable in `ecoku.env` (e.g. `TZ=Asia/Shanghai`, `TZ=America/New_York`, or `TZ=UTC`).
- After updating `TZ` in `ecoku.env`, run `sudo docker compose up -d --force-recreate ecoku` to recreate the container with the new environment. `restart` does not update environment variables; see the [Docker Compose restart reference](https://docs.docker.com/reference/cli/docker/compose/restart/).

---

## 5. Documentation site CI deployment

### Q: How should the documentation release directory be configured?

The repository's `.woodpecker/docs-deploy.yml` independently builds and publishes documentation on `master` pushes using the documentation server agent. The publisher mounts only `/var/www/<DOCS_DOMAIN>:/deploy`. This must be a real directory; set the web server document root to `/var/www/<DOCS_DOMAIN>/html`.

For Nginx, use `deploy/nginx-docs.conf.example` from the repository and replace the domain and TLS snippet placeholders. When migrating from the old directory layout, append `/html` to the `root` path. This site enables VitePress `cleanUrls: true`, so use `try_files $uri $uri.html $uri/ =404;` in `location /` to map extensionless paths such as `/self-hosting/docker` to generated `.html` files; otherwise direct visits and reloads return 404. Then run `sudo nginx -t && sudo systemctl reload nginx`.

```text
/var/www/<DOCS_DOMAIN>/
├── .deploy.lock
├── html -> releases/<commit>-<pipeline>-<rerun>
└── releases/
    └── <commit>-<pipeline>-<rerun>/
```

The script validates the output, then locks and atomically replaces `html`, preventing older pipelines from overwriting newer releases. After activation verification, it keeps the current and immediately previous release and removes older release directories. Failed or stale publications do not prune releases. The first deployment has one version; subsequent deployments normally keep two, allowing a manual rollback. Cleanup failures produce warnings. Verification checks local files and symlinks, not live HTTP health.

To migrate, first ensure no documentation publication is running or queued. Remove the old `/var/www/<DOCS_DOMAIN>` symlink, create a real directory with the same name, and update the web server document root. Before deleting `/var/www/.<DOCS_DOMAIN>-releases`, confirm its static files are no longer needed. Clearing the old deployment makes documentation unavailable until the new CI deployment succeeds and the web configuration takes effect; the comment service and database are unaffected. Push the new CI only after preparation, and do not rerun old publication jobs.

Run `sh scripts/test-publish-docs.sh` for isolated local verification. `DOCS_DEPLOY_ROOT` overrides the script's default `/deploy` and replaces `DOCS_DEPLOY_PARENT` / `DOCS_DEPLOY_SITE`; it is not an Ecoku application environment variable.
