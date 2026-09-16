# 常见问题与排错指南

汇总 Ecoku 在部署、运维与日常管理中最常见的问题诊断与解决方案。

---

## 1. 登录与权限问题

### Q: 管理后台刷新或重开后会保留登录吗？

管理员会话通过 HttpOnly Cookie 保存，服务端在 SQLite 中仅保存凭据摘要与到期时间。登录后固定 8 小时，刷新或关闭重开会恢复有效会话，不延长到期时间。主动退出由服务端撤销当前会话；退出失败会保留当前页面并提示重试。凭据不进入 JavaScript、localStorage、sessionStorage 或 URL。

### Q: 启动容器提示 `permission denied` 或无法读写 SQLite 数据库？
**答**：Ecoku 容器采用非 root 用户 `10001:10001` 运行。请在宿主机上检查数据目录与配置文件的所有者权限：
```bash
sudo chown -R 10001:10001 ~/Ecoku/data ~/Ecoku/app/logs ~/Ecoku/app/config.yaml
sudo chmod 750 ~/Ecoku/data ~/Ecoku/app/logs
sudo chmod 640 ~/Ecoku/app/config.yaml
```

---

## 2. 人机验证与紧急恢复

### Q: 人机验证（Turnstile 或 Cap）配置错误导致管理员无法登录后台，如何恢复？
**答**：使用官方内置的 CLI 救砖命令离线禁用验证码：
```bash
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```
服务启动后，直接使用管理员账号密码登录管理后台，修正验证码参数后重新保存即可。

### Q: 使用自托管 Cap 验证码时，控制台报错 CSP (Content Security Policy) 拦截？
**答**：Ecoku 会根据当前选中的验证码提供方动态生成精确收敛的 CSP。若使用 Cap，请确保：
1. 在管理端安全设置中，Cap 的**实例地址必须以 `https://` 开头**（本地开发调试允许 `localhost` HTTP）。
2. Cap 的 API 端点（`/<sitekey>/siteverify`）必须在同一 HTTPS 域名下提供。
3. 若 Cap 客户端开启了 instrumentation（探针），Ecoku 的 CSP 会自动放行必要的 `'unsafe-eval'` 与 WASM 求值。

---

## 3. 网络反代与限流排错

### Q: 访客发表评论频繁提示 `429 Too Many Requests`？
**答**：通常是因为未配置 `trusted_proxies`，导致所有访客的请求都被识别为来自同一个反向代理网关 IP（如 Docker 网关 `172.18.0.1`），从而共享了同一个单 IP 限流计数桶。
**解决办法**：
1. 查询 Docker 容器网关：
   ```bash
   sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{"\n"}}{{end}}'
   ```
2. 在 `app/config.yaml` 的 `site.trusted_proxies` 中填入该网关 IP（例如 `172.18.0.1/32`）。
3. 确保 Caddy 或 Nginx 配置中使用了 `{remote_host}` 或 `$remote_addr` **覆盖**了 `X-Forwarded-For`。

---

## 4. 邮件与通知排错

### Q: 发送邮件测试提示超时或握手失败？
**答**：
- Ecoku 强制要求使用加密连接，只支持 `465`（SSL/TLS 直连）或 `587`（STARTTLS 直连）。**严禁使用未加密的 25 端口**。
- 请确认云服务器安全组已放行出方向的 465 / 587 端口。
- 确认 `ecoku.env` 中的 `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 已经正确配置，若主密钥缺失或不合法，数据库内加密的密码将无法解密。

### Q: 评论区时间显示与当前时区不一致？
**答**：
- Ecoku 评论时间由 `ecoku.env` 中的环境变量 `TZ` 控制（如 `TZ=Asia/Shanghai` 或 `TZ=Asia/Tokyo`）。
- 该变量由 Docker Compose 注入给容器运行时，默认回退为 `Asia/Shanghai`。
- 修改 `ecoku.env` 中的 `TZ` 并执行 `sudo docker compose restart` 即可即时生效。
