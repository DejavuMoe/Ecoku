# 反向代理與 HTTPS

Ecoku 只在本機 `127.0.0.1:12123` 上提供 HTTP。你需要用 Caddy 或 Nginx 給它一個 HTTPS 網域，再告訴 Ecoku 哪個位址轉送過來的訪客 IP 可信。

<div class="page-meta">
<div>

**你會完成**

- `https://ecoku.example.com` 可以存取
- Ecoku 依每個訪客的真實 IP 限流

</div>
<div>

**開始之前**

- 已依 [Docker 安裝](./docker) 啟動容器
- 網域已解析到這台主機

</div>
</div>

<figure class="doc-diagram" tabindex="0" aria-label="請求路徑圖，可橫向捲動">
  <img class="diagram-light" src="/diagrams/reverse-proxy.zh-Hant.light.svg" width="984" height="91" loading="lazy" decoding="async" alt="訪客透過 HTTPS 直連反向代理或經可選 CDN 回源，再透過 HTTP 127.0.0.1:12123 存取 Ecoku 容器。">
  <img class="diagram-dark" src="/diagrams/reverse-proxy.zh-Hant.dark.svg" width="984" height="91" loading="lazy" decoding="async" alt="訪客透過 HTTPS 直連反向代理或經可選 CDN 回源，再透過 HTTP 127.0.0.1:12123 存取 Ecoku 容器。">
</figure>

<div class="steps">

### 設定反向代理

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

`X-Forwarded-For` 必須 **覆寫** 而不是附加。附加的話（例如 Nginx 的 `$proxy_add_x_forwarded_for`），瀏覽器可以自己帶一個偽造的值來繞過限流。

前面有 Cloudflare 這類 CDN 時，訪客 IP 要從 CDN 的請求標頭取得，例如 `CF-Connecting-IP`。這時在防火牆上只放行 CDN 的 IP 範圍，防止有人繞過 CDN 直連來源伺服器並偽造請求標頭。

### 設定 trusted_proxies {#trusted-proxies}

反向代理連到 `127.0.0.1:12123` 時，Ecoku 看到的對端是 Docker 橋接網路的閘道，而不是訪客。只有把這個閘道寫進 `site.trusted_proxies`，Ecoku 才會讀取 `X-Forwarded-For`。

不設定的話，所有訪客都算同一個 IP，共用每分鐘 5 次的送出額度，很快就會出現「提交過於頻繁」。

查出閘道位址：

```bash
sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{"\n"}}{{end}}'
```

假設輸出 `172.18.0.1`，寫進 `app/config.yaml`：

```yaml
site:
  trusted_proxies:
    - "172.18.0.1/32"
```

重建容器：

```bash
cd ~/Ecoku && sudo docker compose up -d --force-recreate --wait --wait-timeout 120 ecoku
```

用了 CDN 也只填 Docker 閘道，不要填 CDN 的網段。`0.0.0.0/0` 這類全網段會讓 Ecoku 拒絕啟動。

### 檢查

在任何一台能連上網路的機器上執行：

```bash
for path in /api/health /client/ecoku-loader.js /admin/; do
  curl -sS -o /dev/null -w "%{http_code} $path\n" "https://ecoku.example.com$path"
done
```

三行都以 `200` 開頭就對了。之後回到 [首次登入](./docker#first-sign-in)。

</div>
