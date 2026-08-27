# リバースプロキシ

Ecoku は `127.0.0.1:12123` のみを待ち受けます。本機の Web サーバーで HTTPS を終端し、`/`（`/api/`、`/admin/`、`/client/` を含む）をそのポートへ転送します。

## オリジン直結

```text
訪問者 → Caddy / Nginx → 127.0.0.1:12123
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

## CDN 経由

```text
訪問者 → CDN → Caddy / Nginx → 127.0.0.1:12123
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

オリジン HTTPS へは CDN 網段だけを許可し、オリジン迂回を無効にしてください。`CF-Connecting-IP` はその入口制限が成り立つときだけ信頼できます。Ecoku の `trusted_proxies` には Docker ゲートウェイだけを書き、CDN 網段は入れません。

Turnstile Pre-clearance を使う場合、サイトは Cloudflare プロキシ必須です。`cf_clearance` は Ecoku の Siteverify をスキップしません。

## クライアントアドレスとレート制限

既定では `X-Forwarded-For` を信頼せず、直結アドレスでレート制限します。Docker ゲートウェイが `trusted_proxies` に一致するときだけ、プロキシが上書きしたクライアントアドレスを読みます。

| 経路 | `trusted_proxies` | リバースプロキシ |
| --- | --- | --- |
| 訪問者 → プロキシ → Ecoku | Docker ゲートウェイ `/32` | 訪問者アドレスで `X-Forwarded-For` を**上書き** |
| 訪問者 → CDN → プロキシ → Ecoku | Docker ゲートウェイ `/32` | CDN が渡す訪問者アドレスで上書き |
| 未設定 | `[]` | 全訪問者が 1 つのレート制限バケットを共有 |

```bash
sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{"\n"}}{{end}}'
```

実際のゲートウェイを `app/config.yaml` に書き込みます（例：`172.18.0.1/32`）。`0.0.0.0/0` と `::/0` は禁止です。

## 確認

```bash
curl --fail https://comments.example.com/api/health
curl --fail https://comments.example.com/client/ecoku-loader.js
```

管理画面、コメントページ、静的リソースに到達できることを確認してから、ログインと投稿を試してください。
