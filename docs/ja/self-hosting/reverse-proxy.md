# リバースプロキシ

HTTPS 終端はホスト側プロキシ。上流は `127.0.0.1:12123`。コンテナポートを `0.0.0.0` にしないでください。

## レート制限のトポロジ

既定では `X-Forwarded-For` を信頼せず、ソケット対向を使います。転送ヘッダから訪問者アドレスを取るのは、**直接の TCP 対向**が `trusted_proxies` の IP/CIDR に一致するときだけです。`0.0.0.0/0` と `::/0` は拒否。外側 CDN のアドレス一覧は信頼しません。

| トポロジ | 経路 | `trusted_proxies` | プロキシの `X-Forwarded-For` |
| --- | --- | --- | --- |
| 1（推奨） | 訪問者 → Caddy → `127.0.0.1:12123` | Docker ゲートウェイ `/32` | `{remote_host}` / `$remote_addr` で**上書き** |
| 2 | 訪問者 → CDN → Caddy → Compose | 同じくゲートウェイ `/32` | CDN Connecting-IP で**上書き** |
| 3 | 直結、または共有バケット | `[]`（既定） | 変更不要。全員が 1 バケット |

```bash
sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}'
```

そのアドレスを `/32` として `trusted_proxies` に書きます。

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

`Unnecessary header_up` 警告は無視してよいです。既定はクライアント付与ヘッダを転送するため、上書きとは別物です。

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

`$remote_addr` で上書きし、ブラウザ由来の `X-Forwarded-For` を連結しないでください。

## Cloudflare CDN（トポロジ 2）

信頼するのは Docker ゲートウェイだけです。Caddy が CDN の実 IP を読み、上書きします。

```
comments.example.com {
	encode zstd gzip
	reverse_proxy 127.0.0.1:12123 {
		header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}
		header_up X-Forwarded-Proto {scheme}
	}
}
```

- `trusted_proxies` に Cloudflare CIDR を書かない。
- Caddy への入方向は Cloudflare に限定。
- Turnstile と CDN プロキシは別物。`cf_clearance` は Ecoku の Siteverify を飛ばしません。管理画面やコメントサイトが Cloudflare 配下でないなら Pre-clearance を切り、`/cdn-cgi/challenge-platform/` の 404 を避けます。
