# 反向代理

Ecoku 只監聽 `127.0.0.1:12123`。請在本機 Web 伺服器上終止 HTTPS，並把 `/`（含 `/api/`、`/admin/`、`/client/`）反向代理到該連接埠。

## 直連源站

```text
訪客 → Caddy / Nginx → 127.0.0.1:12123
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

## 經 CDN

```text
訪客 → CDN → Caddy / Nginx → 127.0.0.1:12123
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

只允許 CDN 網段存取源站 HTTPS，並關閉回源繞過。`CF-Connecting-IP` 僅在入口限制成立時可信。Ecoku 的 `trusted_proxies` 仍只填 Docker 閘道，不要填 CDN 網段。

若啟用 Turnstile Pre-clearance，站點須經 Cloudflare 代理；`cf_clearance` 不會跳過 Ecoku 的 Siteverify。

## 用戶端位址與限流

預設不信任 `X-Forwarded-For`，按直連位址限流。僅當 Docker 閘道命中 `trusted_proxies` 時，才讀取反代覆蓋後的用戶端位址。

| 鏈路 | `trusted_proxies` | 反代 |
| --- | --- | --- |
| 訪客 → 反代 → Ecoku | Docker 閘道 `/32` | 用訪客位址**覆蓋** `X-Forwarded-For` |
| 訪客 → CDN → 反代 → Ecoku | Docker 閘道 `/32` | 用 CDN 提供的訪客位址覆蓋 |
| 不設定 | `[]` | 所有訪客共用一個限流桶 |

```bash
sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{"\n"}}{{end}}'
```

把實際閘道寫入 `app/config.yaml`，例如 `172.18.0.1/32`。禁止 `0.0.0.0/0` 與 `::/0`。

## 檢查

```bash
curl --fail https://comments.example.com/api/health
curl --fail https://comments.example.com/client/ecoku-loader.js
```

確認管理端、評論頁與靜態資源可存取後，再測登入與送出。
