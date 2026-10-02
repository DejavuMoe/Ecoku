# 文档站点发布

本页说明 Ecoku 文档站点自身的构建与发布方式，供仓库维护者参考，不进入站点导航。

文档部署仍由 Woodpecker 负责。新增的 `.github/workflows/ci.yml` 仅构建、检查并保存文档产物；GitHub Actions 的镜像、npm SDK 和 GitHub Release 发布见 [发布说明](../../packages/client/PUBLISH.md)。GitHub 工作流不连接文档服务器。

## 流程

`.woodpecker/docs-deploy.yml` 在 `master` 分支 push 时运行，与完整测试流程互相独立：

1. `build-docs`：安装依赖，执行 `pnpm docs:build`，再用 `scripts/verify-docs-output.sh` 检查产物边界。
2. `publish-docs`：执行 `scripts/publish-docs.sh`，把产物发布到文档服务器。

流水线固定调度到 `role=netcup-nano`、`server=netcup-nano` 的 agent，同一时间只运行一个发布任务。发布容器通过 trusted volume 只挂载站点目录 `/var/www/<DOCS_DOMAIN>:/deploy`。

## 目录布局

```text
/var/www/<DOCS_DOMAIN>/
├── .deploy.lock
├── html -> releases/<commit>-<pipeline>-<rerun>
└── releases/
    └── <commit>-<pipeline>-<rerun>/
```

- `/var/www/<DOCS_DOMAIN>` 必须是实体目录，不能是软链接。
- Web 服务的根目录设为 `/var/www/<DOCS_DOMAIN>/html`。
- 发布脚本先校验完整产物，再持锁原子切换 `html` 软链接，并拒绝旧流水线覆盖新版本。
- 切换并验证成功后，只保留当前版本和刚被替换的上一版，清理更早的发布目录。失败或过期的发布不会触发清理。首次发布只有一个版本。清理失败只输出警告。
- 这里的验证只检查本地文件与软链接，不包含线上 HTTP 检查。

需要手动回滚时，把 `html` 软链接指回 `releases/` 中的上一版即可。

## Nginx

参考仓库中的 `deploy/nginx-docs.conf.example`，替换域名和 TLS snippet 占位符。站点启用了 VitePress 的 `cleanUrls: true`，`location /` 中必须使用：

```nginx
try_files $uri $uri.html $uri/ =404;
```

否则 `/self-hosting/docker` 这类无扩展名路径在直接访问或刷新时会返回 404。修改后执行 `sudo nginx -t && sudo systemctl reload nginx`。

## 从旧布局迁移

旧布局中 `/var/www/<DOCS_DOMAIN>` 是指向 `/var/www/.<DOCS_DOMAIN>-releases` 的软链接。迁移步骤：

1. 确认没有正在运行或排队的文档发布任务。
2. 删除旧的 `/var/www/<DOCS_DOMAIN>` 软链接，创建同名实体目录。
3. 把 Web 服务的 `root` 改为原路径后加 `/html`。
4. 如需删除旧的 `/var/www/.<DOCS_DOMAIN>-releases`，先确认其中的静态产物不再需要。
5. 推送新版 CI，不要重跑旧版发布任务。

在新 CI 首次发布成功、Web 配置生效之前，文档站点会暂时不可用。评论服务和数据库不受影响。

## 本地验证

```bash
sh scripts/test-publish-docs.sh
```

脚本在隔离的临时目录中验证发布逻辑，不触碰 `/var/www`。`DOCS_DEPLOY_ROOT` 可覆盖默认的 `/deploy`（取代旧的 `DOCS_DEPLOY_PARENT` / `DOCS_DEPLOY_SITE`），它不是 Ecoku 应用的环境变量。
