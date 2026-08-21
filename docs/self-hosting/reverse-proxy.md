# 反向代理

HTTPS 终止在本机反代，上游 `127.0.0.1:12123`。不要把容器端口改成 `0.0.0.0`。

## 限流拓扑

默认不信任 `X-Forwarded-For`，限流使用 socket 对端。只有**直接 TCP 对端**匹配 `trusted_proxies` 中的 IP/CIDR 时，才从转发头解析访客地址。禁止 `0.0.0.0/0` 与 `::/0`。Ecoku 不信任更外层的 CDN 地址列表。

| 拓扑 | 链路 | `trusted_proxies` | 反代对 `X-Forwarded-For` |
| --- | --- | --- | --- |
| 1（推荐） | 访客 → Caddy → `127.0.0.1:12123` | Docker 网关 `/32` | **覆盖**为 `{remote_host}` / `$remote_addr` |
| 2 | 访客 → CDN → Caddy → Compose | 仍为 Docker 网关 `/32` | Caddy **覆盖**为 CDN Connecting-IP |
| 3 | 直连或不按人限流 | `[]`（默认） | 不必改头；所有访客共用一个限流桶 |

查 Docker 网关：

```bash
sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}'
```

把该地址写成 `/32` 填入 `app/config.yaml` 的 `trusted_proxies`。

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

`header_up X-Forwarded-For {remote_host}` 用 Caddy 看到的 TCP 对端**覆盖**该头。Caddy 可能提示 `Unnecessary header_up`：默认是把已有头传给上游（访客可以伪造），与覆盖不是一回事，警告可忽略。

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

用 `$remote_addr` **覆盖**，不要附加浏览器自带的 `X-Forwarded-For`。TLS 按自己的 Nginx 方式配置。

```bash
curl --fail https://comments.example.com/api/health
curl --fail --head https://comments.example.com/client/ecoku-loader.js
```

## Cloudflare CDN（拓扑 2）

Ecoku 只信任 Docker 网关。由本机 Caddy 读取 CDN 的真实访客 IP，再覆盖传给容器：

```
comments.example.com {
	encode zstd gzip
	reverse_proxy 127.0.0.1:12123 {
		header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
		header_up X-Forwarded-Proto {scheme}
	}
}
```

- `trusted_proxies` 仍只填 Docker 网关 `/32`，不要填 Cloudflare CIDR。
- 限制 Caddy 只接受来自 Cloudflare 的入站（防火墙或 `remote_ip` 匹配 Cloudflare 发布段）。
- Turnstile 与 CDN 代理是两套机制。`cf_clearance` 只跳过后续 Cloudflare 安全规则，不会让 Ecoku 跳过 Siteverify。管理端或评论站不在 Cloudflare 代理之后时，关闭 Pre-clearance，否则浏览器会向站点自身请求 `/cdn-cgi/challenge-platform/` 得到 404。
