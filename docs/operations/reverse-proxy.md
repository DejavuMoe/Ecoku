# Caddy / Nginx 反向代理

生产 Compose 只把 Ecoku 发布到 `127.0.0.1:12123`。外部浏览器应只访问 TLS 域名，例如
`https://ecoku.via.moe`，不能直接暴露容器端口。

## 1. 共同前置条件

1. 为评论域名配置指向服务器的 A 记录；服务器有公网 IPv6 时同时配置 AAAA。
2. 放行 TCP 80/443，并确认其他服务没有占用端口。
3. 保持 Compose 的 `127.0.0.1:12123:12123`，不要改成 `0.0.0.0`。
4. 把 `config.yaml` 中 `admin.allowed_origins` 与 `notifications.instance_public_url` 设置为
   `https://ecoku.via.moe`。
5. 内容站点自己的 Origin（例如 `https://blog.example.com`）只加入对应站点的允许来源，不加入
   管理端白名单。

## 2. Caddy

下面的 Caddyfile 会自动申请并续期公开 TLS 证书：

```caddyfile
ecoku.via.moe {
    encode zstd gzip
    reverse_proxy 127.0.0.1:12123
}
```

校验后平滑加载：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy --since "10 minutes ago" --no-pager
```

Caddy 自动设置标准 `X-Forwarded-*` 头。自动 HTTPS 的域名、DNS 和端口要求见 Caddy 官方
[Automatic HTTPS](https://caddyserver.com/docs/automatic-https)。

## 3. Nginx

先通过发行版工具或 ACME 客户端取得证书，再创建站点配置：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name ecoku.via.moe;

    return 308 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name ecoku.via.moe;

    ssl_certificate /etc/letsencrypt/live/ecoku.via.moe/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ecoku.via.moe/privkey.pem;

    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:12123;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }
}
```

校验后平滑加载：

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo journalctl -u nginx --since "10 minutes ago" --no-pager
```

## 4. 可信代理边界

Ecoku 默认 `trusted_proxies: []`，因此转发头不会改变内存限流所用的连接身份。不要仅因为代理在
同一台主机就直接填写 `127.0.0.1/32`：经过 Docker 端口转发后，Go 进程看到的 socket 对端可能是
容器网桥地址。

先在隔离测试环境确认 Go 进程实际看到的直接 socket 对端，再只填写该精确 IP 或最小 CIDR。禁止
`*`、`0.0.0.0/0`、`::/0`，也不要信任 Cloudflare 或其他代理宣称的任意来源头。若无法确认，保持
空列表；功能可用，但同一代理后的访客会共享限流身份。

## 5. 验收

```bash
curl --fail --show-error http://127.0.0.1:12123/api/health
curl --fail --show-error --ipv4 https://ecoku.via.moe/api/health
curl --fail --show-error --ipv6 https://ecoku.via.moe/api/health
curl --fail --show-error https://ecoku.via.moe/admin/ > /dev/null
curl --fail --show-error --head https://ecoku.via.moe/client/ecoku-loader.js
curl --fail --show-error --head https://ecoku.via.moe/client/ecoku.umd.js
```

没有公网 IPv6 或 AAAA 时，IPv6 项列为条件性验证，不能伪造通过。最后用浏览器检查：

- 管理端静态资源均为 HTTPS，控制台无 mixed-content/CSP 错误；
- 内容站点的 CORS 预检成功，未允许 Origin 被拒绝；
- 网络请求没有第三方 IP、头像、遥测或 management key；
- 证书域名、有效期和完整链正确。
