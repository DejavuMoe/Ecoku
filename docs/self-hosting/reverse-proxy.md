# 反向代理

Ecoku 只监听 `127.0.0.1:12123`。请在本机 Web 服务器上终止 HTTPS，并把 `/`（含 `/api/`、`/admin/`、`/client/`）反代到该端口。

## 直连源站

```text
访客 → Caddy / Nginx → 127.0.0.1:12123
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

## 经 CDN

```text
访客 → CDN → Caddy / Nginx → 127.0.0.1:12123
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

只允许 CDN 网段访问源站 HTTPS，并关闭回源绕过。`CF-Connecting-IP` 仅在入口限制成立时可信。Ecoku 的 `trusted_proxies` 仍只填 Docker 网关，不要填 CDN 网段。

若启用 Turnstile Pre-clearance，站点须经 Cloudflare 代理；`cf_clearance` 不会跳过 Ecoku 的 Siteverify。

## 客户端地址与限流

默认不信任 `X-Forwarded-For`，按直连地址限流。仅当 Docker 网关命中 `trusted_proxies` 时，才读取反代覆盖后的客户端地址。

| 链路 | `trusted_proxies` | 反代 |
| --- | --- | --- |
| 访客 → 反代 → Ecoku | Docker 网关 `/32` | 用访客地址**覆盖** `X-Forwarded-For` |
| 访客 → CDN → 反代 → Ecoku | Docker 网关 `/32` | 用 CDN 提供的访客地址覆盖 |
| 不配置 | `[]` | 所有访客共用一个限流桶 |

```bash
sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{"\n"}}{{end}}'
```

把实际网关写入 `app/config.yaml`，例如 `172.18.0.1/32`。禁止 `0.0.0.0/0` 与 `::/0`。

## 检查

```bash
curl --fail https://comments.example.com/api/health
curl --fail https://comments.example.com/client/ecoku-loader.js
```

确认管理端、评论页与静态资源可访问后，再测登录与提交。
