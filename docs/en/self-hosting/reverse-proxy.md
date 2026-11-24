# Reverse proxy and HTTPS

Ecoku serves plain HTTP on local `127.0.0.1:12123` only. Use Caddy or Nginx to give it an HTTPS domain, then tell Ecoku which address it can trust to forward visitor IPs.

<div class="page-meta">
<div>

**You will**

- Make `https://ecoku.example.com` reachable
- Have Ecoku rate-limit by each visitor's real IP

</div>
<div>

**Before you start**

- Start the container as described in [Docker installation](./docker)
- Point the domain at this host

</div>
</div>

<figure class="doc-diagram" tabindex="0" aria-label="Request path, horizontally scrollable">
  <img class="diagram-light" src="/diagrams/reverse-proxy.en.light.svg" width="984" height="91" loading="lazy" decoding="async" alt="Visitors reach the reverse proxy over HTTPS, directly or through an optional CDN. The proxy forwards requests to the Ecoku container over HTTP at 127.0.0.1:12123.">
  <img class="diagram-dark" src="/diagrams/reverse-proxy.en.dark.svg" width="984" height="91" loading="lazy" decoding="async" alt="Visitors reach the reverse proxy over HTTPS, directly or through an optional CDN. The proxy forwards requests to the Ecoku container over HTTP at 127.0.0.1:12123.">
</figure>

<div class="steps">

### Configure the reverse proxy

::: code-group

```caddyfile [Caddy]
ecoku.example.com {
    encode zstd gzip

    reverse_proxy 127.0.0.1:12123 {
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

```nginx [Nginx]
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name ecoku.example.com;

    ssl_certificate     /etc/letsencrypt/live/ecoku.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ecoku.example.com/privkey.pem;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location / {
        proxy_pass http://127.0.0.1:12123;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```caddyfile [Caddy + Cloudflare]
ecoku.example.com {
    encode zstd gzip

    reverse_proxy 127.0.0.1:12123 {
        header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

:::

`X-Forwarded-For` must be **overwritten**, not appended to. If it's appended (for example with Nginx's `$proxy_add_x_forwarded_for`), a browser can send its own forged value and get around rate limiting.

When a CDN such as Cloudflare sits in front, take the visitor IP from the CDN's request header, such as `CF-Connecting-IP`. In that case, allow only the CDN's IP ranges through your firewall so nobody can bypass the CDN, connect to the origin directly and forge the header.

### Configure trusted_proxies {#trusted-proxies}

When the reverse proxy connects to `127.0.0.1:12123`, Ecoku sees the Docker bridge gateway as the peer, not the visitor. Ecoku reads `X-Forwarded-For` only after you add this gateway to `site.trusted_proxies`.

Without it, all visitors count as one IP and share a quota of 5 submissions per minute, so 「提交过于频繁」 (You are posting too quickly) soon appears.

Find the gateway address:

```bash
sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{"\n"}}{{end}}'
```

If it prints `172.18.0.1`, add it to `app/config.yaml`:

```yaml
site:
  trusted_proxies:
    - "172.18.0.1/32"
```

Recreate the container:

```bash
cd ~/Ecoku && sudo docker compose up -d --force-recreate --wait --wait-timeout 120 ecoku
```

Even with a CDN, list only the Docker gateway, not the CDN's ranges. A catch-all range such as `0.0.0.0/0` makes Ecoku refuse to start.

### Check

Run this on any machine with internet access:

```bash
for path in /api/health /client/ecoku-loader.js /admin/; do
  curl -sS -o /dev/null -w "%{http_code} $path\n" "https://ecoku.example.com$path"
done
```

All three lines should start with `200`. Then go back to [First sign-in](./docker#first-sign-in).

</div>
