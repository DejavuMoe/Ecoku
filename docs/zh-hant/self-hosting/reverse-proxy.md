# 反向代理

HTTPS 終止在本機反代，上遊 `127.0.0.1:12123`。不要把容器埠改成 `0.0.0.0`。

## 限流拓撲

預設不信任 `X-Forwarded-For`，限流使用 socket 對端。只有**直接 TCP 對端**匹配 `trusted_proxies` 中的 IP/CIDR 時，才從轉發頭解析訪客地址。禁止 `0.0.0.0/0` 與 `::/0`。Ecoku 不信任更外層的 CDN 地址列表。

| 拓撲 | 鏈路 | `trusted_proxies` | 反代對 `X-Forwarded-For` |
| --- | --- | --- | --- |
| 1（推薦） | 訪客 → Caddy → `127.0.0.1:12123` | Docker 網關 `/32` | **覆蓋**為 `{remote_host}` / `$remote_addr` |
| 2 | 訪客 → CDN → Caddy → Compose | 仍為 Docker 網關 `/32` | Caddy **覆蓋**為 CDN Connecting-IP |
| 3 | 直連或不按人限流 | `[]`（預設） | 不必改頭；所有訪客共用一個限流桶 |

查 Docker 網關：

```bash
sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}'
```

把該地址寫成 `/32` 填入 `app/config.yaml` 的 `trusted_proxies`。

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

`header_up X-Forwarded-For {remote_host}` 用 Caddy 看到的 TCP 對端**覆蓋**該頭。Caddy 可能提示 `Unnecessary header_up`：預設是把已有頭傳給上遊（訪客可以偽造），與覆蓋不是一回事，警告可忽略。

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

用 `$remote_addr` **覆蓋**，不要附加瀏覽器自帶的 `X-Forwarded-For`。TLS 按自己的 Nginx 方式配置。

```bash
curl --fail https://comments.example.com/api/health
curl --fail --head https://comments.example.com/client/ecoku-loader.js
```

## Cloudflare CDN（拓撲 2）

Ecoku 只信任 Docker 網關。由本機 Caddy 讀取 CDN 的真實訪客 IP，再覆蓋傳給容器：

```
comments.example.com {
	encode zstd gzip
	reverse_proxy 127.0.0.1:12123 {
		header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
		header_up X-Forwarded-Proto {scheme}
	}
}
```

- `trusted_proxies` 仍只填 Docker 網關 `/32`，不要填 Cloudflare CIDR。
- 限制 Caddy 只接受來自 Cloudflare 的入站（防火牆或 `remote_ip` 匹配 Cloudflare 發布段）。
- Turnstile 與 CDN 代理是兩套機制。`cf_clearance` 只跳過後續 Cloudflare 安全規則，不會讓 Ecoku 跳過 Siteverify。管理端或評論站不在 Cloudflare 代理之後時，關閉 Pre-clearance，否則瀏覽器會向站點自身請求 `/cdn-cgi/challenge-platform/` 得到 404。
