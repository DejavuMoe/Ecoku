# Reverse proxy

Terminate HTTPS on a local reverse proxy. Upstream is `127.0.0.1:12123`. Do not bind the container port to `0.0.0.0`.

## Rate-limit topology

`X-Forwarded-For` is untrusted by default. Limits use the socket peer. The forwarded client address is used only when the **direct TCP peer** matches an IP/CIDR in `trusted_proxies`. `0.0.0.0/0` and `::/0` are rejected. Ecoku does not trust outer CDN address lists.

| Topology | Path | `trusted_proxies` | Proxy `X-Forwarded-For` |
| --- | --- | --- | --- |
| 1 (recommended) | Client → Caddy → `127.0.0.1:12123` | Docker gateway `/32` | **Overwrite** with `{remote_host}` / `$remote_addr` |
| 2 | Client → CDN → Caddy → Compose | Still Docker gateway `/32` | Caddy **overwrites** with the CDN Connecting-IP |
| 3 | Direct, or one shared bucket | `[]` (default) | No header change; everyone shares one bucket |

```bash
sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}'
```

Write that address as `/32` in `trusted_proxies`.

## Caddy

```
comments.example.com {
	encode zstd gzip
	reverse_proxy 127.0.0.1:12123 {
		header_up X-Forwarded-For {remote_host}
		header_up X-Forwarded-Proto {scheme}
	}
}
```

`header_up X-Forwarded-For {remote_host}` **overwrites** the header with Caddy’s TCP peer. Caddy may warn `Unnecessary header_up`; the default forwards a client-supplied header (spoofable). The warning is safe to ignore.

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name comments.example.com;

    location / {
        proxy_pass http://127.0.0.1:12123;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_http_version 1.1;
    }
}
```

Overwrite with `$remote_addr`; do not append a browser-supplied `X-Forwarded-For`.

```bash
curl --fail https://comments.example.com/api/health
curl --fail --head https://comments.example.com/client/ecoku-loader.js
```

## Cloudflare CDN (topology 2)

Trust only the Docker gateway. Let local Caddy read the CDN visitor IP and overwrite:

```
comments.example.com {
	encode zstd gzip
	reverse_proxy 127.0.0.1:12123 {
		header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
		header_up X-Forwarded-Proto {scheme}
	}
}
```

- Keep `trusted_proxies` as the Docker gateway `/32`, not Cloudflare CIDRs.
- Restrict Caddy inbound to Cloudflare (firewall or `remote_ip`).
- Turnstile and CDN proxying are separate. `cf_clearance` does not skip Ecoku Siteverify. If admin or comment sites are not behind Cloudflare, disable Pre-clearance or the browser will request `/cdn-cgi/challenge-platform/` on the origin and get 404.
