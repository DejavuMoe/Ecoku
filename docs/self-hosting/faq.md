# 常见问题

## 容器 unhealthy 或反复重启

看 `sudo docker compose logs --tail=200 ecoku`。常见原因是迁移失败、配置校验失败或管理员静态目录缺失。对照 [升级说明](/self-hosting/upgrades/) 与当前 `CHANGELOG.md`。

## 启动报未知 schema / 校验和不符

用旧镜像打开了已升级库，或手工改过 `schema_migrations`。停服，用升级前冷备份整库恢复；不要只回退镜像。

## 限流像所有人共用一个桶

`trusted_proxies` 为空，或反代**追加**而非覆盖 `X-Forwarded-For`。按 [反向代理](/self-hosting/reverse-proxy) 拓扑 1：Docker 网关 `/32` + Caddy/Nginx 覆盖头。不要填 `0.0.0.0/0` 或 CDN 段。

## CORS 拒绝评论提交

站点 `allowed_origins` 未登记页面 Origin。管理端补全；管理端来源与公开站点来源分开配。

## Turnstile 登录或评论失败

管理端「安全」检查是否启用、Sitekey/Secret 是否已设置。Secret 需要 `ECOKU_NOTIFICATION_ENCRYPTION_KEY`。Siteverify 失败不会自动降级。

## Cap 登录或评论失败

检查 Cap 健康、Key 的 CORS、`/assets/widget.js`、WASM 与 Siteverify。Token 已消费需重新求解。无法登录时按 [后台配置](/self-hosting/admin#验证故障时恢复登录) 执行 `captcha disable`。

`instr_timeout` 且 `/redeem` 429：核对管理端响应 CSP 是否来自当前镜像（`v0.1.6` 起 Cap 模式才含 `'unsafe-eval'`）。不要给 Caddy 加第二份宽泛 CSP。

## 控制台 aborting clearance redemption

开了 Cloudflare Pre-clearance，但站点不在 CF 代理后。在 Cloudflare 控制台关闭；小组件仍可完成 Siteverify。

## 备份后恢复仍异常

备份时存在 WAL/SHM，或只复制了主文件。必须停服且确认无边车文件后再备份。

## 评论时间不对

容器未设置 `TZ`，或改 `ecoku.env` 后未重建容器。写入 IANA 名称后 `docker compose up -d`。未设置时回退 `Asia/Shanghai`。

## 博主评论无标志

历史评论未回填。管理端再保存一次博主口令；昵称与邮箱须与历史评论一致。

## management key 能删不能看列表

设计如此：该 key 只做所属站点墓碑删除。列表与详情用管理员登录。

## 宿主 CSP

Turnstile：允许 `https://challenges.cloudflare.com` 的 `script-src`、`frame-src`、`connect-src`。

Cap：实例 Origin 加入 `script-src` 与 `connect-src`；`worker-src blob:`；`'wasm-unsafe-eval'`；启用 instrumentation 时还需要 `'unsafe-eval'`。不要用 `*` 或宽泛 `unsafe-inline` 代替。
