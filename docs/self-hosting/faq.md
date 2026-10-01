# 常见问题

遇到问题时，先看容器日志，大多数启动错误都会在这里写明原因：

```bash
cd ~/Ecoku
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
```

## 部署与启动

### 容器反复重启，日志提示 permission denied

容器以 UID/GID `10001:10001` 运行，需要能读 `app/config.yaml`、能写 `data/` 和 `app/logs/`。修正属主与权限后重启：

```bash
cd ~/Ecoku
sudo chown -R 10001:10001 data app/logs
sudo chmod 750 data app/logs
sudo chown "$(id -u):$(id -g)" app app/config.yaml
chmod 644 app/config.yaml
sudo docker compose up -d
```

`app/config.yaml` 不含密钥，属于你自己的账号即可，以后编辑不需要 `sudo`。

### 编辑 app/config.yaml 时提示权限不足 {#config-permission}

早期的部署步骤把 `app/` 和 `app/config.yaml` 交给了 root 或 UID 10001。把它们改回自己的账号即可，不需要重建容器：

```bash
cd ~/Ecoku
sudo chown "$(id -u):$(id -g)" app app/config.yaml
chmod 755 app
chmod 644 app/config.yaml
```

### 容器反复重启，日志提示 config.yaml is a directory

启动前 `app/config.yaml` 不存在，Docker 在这个位置创建了一个空目录。停止服务，删掉这个目录，按 [Docker 部署](./docker)第 3 步重新写入配置文件后再启动：

```bash
cd ~/Ecoku
sudo docker compose down
sudo rmdir app/config.yaml
```

### 保存站点时提示“公开站点来源不能复用管理端来源”

站点的允许来源与管理后台的来源重复了。管理后台的来源默认取 `notifications.instance_public_url`，另外写了 `admin.allowed_origins` 时以它为准。管理后台必须使用一个独立的来源，通常就是 Ecoku 自己的域名，如 `https://ecoku.example.com`。如果在 `app/config.yaml` 中写了 `sites`，同样的冲突会在启动时报“管理员来源 … 不能复用公开站点来源”。

### 日志提示“无法解密 … 凭据”

数据库中保存过 SMTP、Telegram 或人机验证的凭据，但 `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 缺失或与保存时不同。从备份中找回原来的 `ecoku.env`，恢复这把密钥。密钥无法找回时，只能从之前的备份恢复整个实例。

### 修改了 ecoku.env 但没有生效

`docker compose restart` 不会重新读取 `env_file`。修改 `ecoku.env` 或 `app/config.yaml` 后，用下面的命令重建容器：

```bash
cd ~/Ecoku && sudo docker compose up -d --force-recreate ecoku
```

## 评论区

### 页面上没有出现评论区

加载器找不到必需的属性时会静默跳过，不显示任何提示。请检查：

- 外壳元素上有 `data-ecoku-comments`，内部有 `data-ecoku-mount`、`data-ecoku-loader`、`data-ecoku-status`、`data-ecoku-retry` 四个元素，结构与[接入示例](../integration/html)一致；
- `data-server-url`、`data-site-id`、`data-page-key` 三个属性都有值；
- 浏览器开发者工具的“网络”面板中，`ecoku-loader.js` 和 `ecoku.umd.js` 能正常加载。

### 评论区显示“评论暂时不可用”，或提示没有权限

多数是文章页的来源没有登记。在后台「站点」中，把浏览器地址栏里的 `协议://域名[:端口]` 加入该站点的允许来源。带 `www` 与不带 `www` 是两个来源。

### 访客频繁收到“提交过于频繁”

Ecoku 放在反向代理后面，但没有配置 `trusted_proxies`，所有访客被算作同一个 IP，共用每分钟 5 次的提交额度。按[反向代理](./reverse-proxy#trusted-proxies)填写 Docker 网关地址，并确认反向代理用覆盖方式设置了 `X-Forwarded-For`。

### 某篇文章的评论加载失败，其他文章正常

这篇文章的讨论可能超出了单次读取的上限（200 条评论、16 层或 1 MiB）。可以在接入代码中调小 `data-page-size`；如果是单个讨论串本身过大，调小也没用，需要在后台删除部分评论。详见[讨论串与分页](../guide/concepts#threads)。

### 调整博客链接格式后，旧评论不见了

评论按页面 key 保存。链接格式改变后，接入代码生成的页面 key 也变了。数据仍在数据库里，把 `data-page-key` 改回原来的生成方式即可重新显示。

### 评论时间的时区不对

时区由 `ecoku.env` 中的 `TZ` 决定，如 `TZ='Asia/Tokyo'`。修改后需要重建容器（见上文）。

## 管理后台

### 无法登录

按顺序排查：

1. 通过 HTTPS 访问后台。只有 `localhost`、`127.0.0.1` 可以用 HTTP。
2. 地址栏中的来源与 `notifications.instance_public_url`（或另外写的 `admin.allowed_origins`）完全一致，包括端口。
3. 用户名和密码正确。同一 IP 每分钟最多 5 次登录请求（成功的也计入），超出后按提示等待。没有配置 [`trusted_proxies`](./reverse-proxy#trusted-proxies) 时，所有人共用这一个额度。
4. 人机验证组件能正常完成。验证服务出问题时，用 `captcha disable` 临时关闭，见[人机验证](./captcha#disable)。

### 忘记了管理员密码

重新生成密码哈希，替换 `ecoku.env` 中 `ECOKU_ADMIN_PASSWORD_HASH` 的值（保留两侧的单引号，否则哈希里的 `$` 会被 Compose 展开），再重建容器：

```bash
cd ~/Ecoku
read -rsp '新密码: ' P; echo
printf '%s\n' "$P" | sudo docker run --rm -i git.via.moe/dejavu/ecoku:v0.2.8 hash-password
unset P
```

更换后所有已登录的会话都会失效。

## 通知与人机验证

### 测试邮件发送失败

见[通知](./notifications#troubleshooting)。

### 保存 Cap 设置时提示地址无效

Cap 实例地址必须是公网可访问的 HTTPS 地址，不能带用户名密码、查询串或 `#` 片段。`localhost`、`127.0.0.1` 和内网 IP 都会被拒绝。

### 启用 Cap 后，浏览器控制台报 CSP 错误

如果报错出现在博客页面，说明博客自己的 CSP 没有为 Cap 放行，需要加入 Cap 实例来源、`worker-src blob:` 和 WebAssembly 权限，详见[人机验证 · 内容安全策略](./captcha#csp)。管理后台的 CSP 由 Ecoku 自动调整，无需手动处理。
