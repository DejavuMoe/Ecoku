# Reverse proxy

Ecoku listens only on `127.0.0.1:12123`. Terminate HTTPS on a local web server and proxy `/` (including `/api/`, `/admin/`, and `/client/`) to that port.

## Direct to origin

```text
Visitor → Caddy / Nginx → 127.0.0.1:12123
```

### Caddy

```caddyfile
comments.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:12123 {
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

### Nginx

```nginx
server {
    listen 443 ssl;
    server_name comments.example.com;

    location / {
        proxy_pass http://127.0.0.1:12123;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Via CDN

```text
Visitor → CDN → Caddy / Nginx → 127.0.0.1:12123
```

### Cloudflare + Caddy

```caddyfile
comments.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:12123 {
        header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

Allow only CDN ranges to reach origin HTTPS, and disable origin bypass. Trust `CF-Connecting-IP` only when that edge restriction holds. Ecoku `trusted_proxies` still lists only the Docker gateway—not CDN ranges.

If Turnstile Pre-clearance is enabled, the site must be proxied through Cloudflare; `cf_clearance` does not skip Ecoku Siteverify.

## Client address and rate limits

By default `X-Forwarded-For` is not trusted, and rate limits use the direct connection address. The proxied client address is read only when the Docker gateway matches `trusted_proxies`.

| Path | `trusted_proxies` | Reverse proxy |
| --- | --- | --- |
| Visitor → proxy → Ecoku | Docker gateway `/32` | **Overwrite** `X-Forwarded-For` with the visitor address |
| Visitor → CDN → proxy → Ecoku | Docker gateway `/32` | Overwrite with the visitor address supplied by the CDN |
| Unconfigured | `[]` | All visitors share one rate-limit bucket |

```bash
sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{"\n"}}{{end}}'
```

Write the real gateway into `app/config.yaml`, for example `172.18.0.1/32`. Never use `0.0.0.0/0` or `::/0`.

## Checks

```bash
curl --fail https://comments.example.com/api/health
curl --fail https://comments.example.com/client/ecoku-loader.js
```

Confirm the admin UI, comment pages, and static assets are reachable, then test login and submit.
