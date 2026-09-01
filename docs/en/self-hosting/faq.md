# FAQ & Troubleshooting

---

## 1. Authentication & Permissions

### Q: Why does the admin panel log out when I refresh the page?
**A**: Ecoku uses an **in-memory session model** for optimal security. Bearer tokens are kept only in JavaScript runtime memory and never written to `localStorage` or cookies.

### Q: Container startup fails with `permission denied`?
**A**: Fix ownership for UID/GID `10001:10001`:
```bash
sudo chown -R 10001:10001 ~/Ecoku/data ~/Ecoku/app/logs ~/Ecoku/app/config.yaml
sudo chmod 750 ~/Ecoku/data ~/Ecoku/app/logs
sudo chmod 640 ~/Ecoku/app/config.yaml
```

---

## 2. Emergency Recovery

### Q: Locked out of the admin panel due to CAPTCHA failure?
**A**: Disable CAPTCHA via CLI:
```bash
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```

---

## 3. Proxy & Rate Limiting

### Q: Visitors constantly receive `429 Too Many Requests`?
**A**: Add the Docker bridge gateway to `site.trusted_proxies` in `app/config.yaml`:
```bash
sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{"\n"}}{{end}}'
```
And verify that your Caddy/Nginx reverse proxy is overwriting `X-Forwarded-For`.
