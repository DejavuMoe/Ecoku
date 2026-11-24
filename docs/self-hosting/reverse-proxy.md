# 反向代理与 HTTPS

Ecoku 只在本机 `127.0.0.1:12123` 上提供 HTTP。你需要用 Caddy 或 Nginx 给它一个 HTTPS 域名，再告诉 Ecoku 哪个地址转发过来的访客 IP 可信。

<div class="page-meta">
<div>

**你会完成**

- `https://ecoku.example.com` 可以访问
- Ecoku 按每个访客的真实 IP 限流

</div>
<div>

**开始之前**

- 已按 [Docker 安装](./docker) 启动容器
- 域名已解析到这台主机

</div>
</div>

<figure class="doc-diagram" tabindex="0" aria-label="请求路径图，可横向滚动">
  <img class="diagram-light" src="/diagrams/reverse-proxy.zh-CN.light.svg" width="984" height="91" loading="lazy" decoding="async" alt="访客通过 HTTPS 直连反向代理或经可选 CDN 回源，再通过 HTTP 127.0.0.1:12123 访问 Ecoku 容器。">
  <img class="diagram-dark" src="/diagrams/reverse-proxy.zh-CN.dark.svg" width="984" height="91" loading="lazy" decoding="async" alt="访客通过 HTTPS 直连反向代理或经可选 CDN 回源，再通过 HTTP 127.0.0.1:12123 访问 Ecoku 容器。">
</figure>

<div class="steps">

### 配置反向代理

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

`X-Forwarded-For` 必须**覆盖**而不是追加。追加的话（例如 Nginx 的 `$proxy_add_x_forwarded_for`），浏览器可以自己带一个伪造的值来绕过限流。

前面有 Cloudflare 这类 CDN 时，访客 IP 要从 CDN 的请求头取，例如 `CF-Connecting-IP`。这时在防火墙上只放行 CDN 的 IP 段，防止有人绕过 CDN 直连源站伪造请求头。

### 配置 trusted_proxies {#trusted-proxies}

反向代理连到 `127.0.0.1:12123` 时，Ecoku 看到的对端是 Docker 网桥的网关，而不是访客。只有把这个网关写进 `site.trusted_proxies`，Ecoku 才会读取 `X-Forwarded-For`。

不配置的话，所有访客都算同一个 IP，共用每分钟 5 次的提交额度，很快就会出现「提交过于频繁」。

查出网关地址：

```bash
sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{"\n"}}{{end}}'
```

假设输出 `172.18.0.1`，写进 `app/config.yaml`：

```yaml
site:
  trusted_proxies:
    - "172.18.0.1/32"
```

重建容器：

```bash
cd ~/Ecoku && sudo docker compose up -d --force-recreate --wait --wait-timeout 120 ecoku
```

用了 CDN 也只填 Docker 网关，不要填 CDN 的网段。`0.0.0.0/0` 这类全网段会让 Ecoku 拒绝启动。

### 检查

在任意一台能上网的机器上运行：

```bash
for path in /api/health /client/ecoku-loader.js /admin/; do
  curl -sS -o /dev/null -w "%{http_code} $path\n" "https://ecoku.example.com$path"
done
```

三行都以 `200` 开头就对了。之后回到 [首次登录](./docker#first-sign-in)。

</div>
