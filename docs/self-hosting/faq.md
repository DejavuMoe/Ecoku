# 常见问题

## `/api/health` 正常，但页面打不开

健康检查只表示进程可响应。确认反代转发了 `/`、`/api/`、`/admin/`、`/client/`：

```bash
sudo docker compose ps
sudo docker compose logs --tail=200 ecoku
```

详见 [反向代理](./reverse-proxy)。

## 所有访客共用一个限流桶

常见于 `trusted_proxies: []`，或反代**追加**而非覆盖 `X-Forwarded-For`。按 [反向代理](./reverse-proxy#客户端地址与限流) 配置 Docker 网关 `/32`；不要填 `0.0.0.0/0`、`::/0` 或 CDN 网段。

## 出现 CORS 错误

站点 Allowed origins 填评论页完整 Origin；管理端填管理页 Origin。协议、域名、端口须完全一致，不能带路径或用 `*`。

## 管理员无法登录

核对用户名、bcrypt 哈希、`ECOKU_ADMIN_TOKEN_KEY` 与管理端 Allowed origins。若被人机验证挡住，见 [恢复登录](./admin#验证故障时恢复登录)。

## Turnstile 或 Cap 验证失败

确认实例能访问验证服务，密钥成对，CORS 含所需 Origin，浏览器能加载 Widget / WASM / Siteverify。token 一次性消费，失败后需重新求解。

## 升级后提示数据库版本不支持

不要删库或手工改 `schema_migrations`。保留备份，对照 [升级](./upgrade) 中的镜像与 schema 表。只支持顺序原位升级，没有降级迁移。

## 如何修改时区

改 `ecoku.env` 的 `TZ` 为 IANA 名（如 `Asia/Singapore`），再：

```bash
sudo docker compose up -d --force-recreate
```

## 严格 CSP 阻止验证组件

Turnstile 需要 Cloudflare Origin；Cap 需要实例 Origin、WASM、Blob Worker，instrumentation 可能还需 `'unsafe-eval'`。见 [人机验证](./admin#人机验证)。
