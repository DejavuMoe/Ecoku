# 常见问题

大部分问题的原因都写在容器日志里，先看这里：

```bash
cd ~/Ecoku
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
```

## 部署 {#deploy}

::: details 容器反复重启，日志里有 permission denied
容器以 UID/GID `10001:10001` 运行，要能读 `app/config.yaml`、写 `data/`：

```bash
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
sudo chown "$(id -u):$(id -g)" app app/config.yaml
chmod 755 app
chmod 644 app/config.yaml
sudo docker compose up -d
```
:::

::: details 容器反复重启，日志里有 config.yaml is a directory
启动前 `app/config.yaml` 还不存在，Docker 在那里建了一个空目录。删掉它，[写好配置文件](../self-hosting/docker#config) 再启动：

```bash
cd ~/Ecoku
sudo docker compose stop ecoku
sudo rmdir app/config.yaml
```
:::

::: details 改了配置没有生效
修改 `app/config.yaml` 或 `compose.yaml` 后要重建容器：

```bash
cd ~/Ecoku && sudo docker compose up -d --force-recreate --wait --wait-timeout 120 ecoku
```
:::

::: details 启动失败：「通知凭据校验失败」或「CAPTCHA 凭据校验失败」
`data/ecoku-secrets.json` 和数据库对不上。确认它和数据库来自同一份备份，属主是容器用户，权限为 `600`。不要删掉它让程序重新生成。见 [从备份恢复](../self-hosting/backup#restore)。
:::

::: details 启动失败：「与已存储的公开站点来源重叠」
管理后台的来源和某个站点的允许来源重复了。后台要用独立的域名，见 [配置生效与来源检查](./configuration#reload)。
:::

## 评论区 {#comments}

::: details 页面上没有出现评论区
加载器找不到需要的元素或属性时什么都不显示。检查：

- 外壳上有 `data-ecoku-comments`，里面有 `data-ecoku-mount`、`data-ecoku-loader`、`data-ecoku-status`、`data-ecoku-retry` 四个元素；
- `data-server-url`、`data-site-id`、`data-page-key` 都有值；
- 浏览器网络面板里 `ecoku-loader.js` 和 `ecoku.umd.js` 都加载成功。
:::

::: details 显示「评论暂时不可用」
最常见的原因是文章页的来源没登记。在后台站点的 [允许来源](../admin/sites#origins) 里加上浏览器地址栏的 `协议://域名[:端口]`。带 `www` 和不带 `www` 是两个来源。
:::

::: details 访客经常看到「提交过于频繁，请稍后再试。」
没有配置 `trusted_proxies`，所有访客被当成同一个 IP。见 [配置 trusted_proxies](../self-hosting/reverse-proxy#trusted-proxies)。
:::

::: details 只有某一篇文章的评论加载失败
看网络面板里评论列表请求是否返回 `422`。这表示讨论超过了单次读取的上限，见 [讨论串与分页](./concepts#threads)。多条根评论加起来超限时，减小 `data-page-size` 能解决。
:::

::: details 改了博客的链接格式后，旧评论不见了
评论按页面 key 保存，链接格式一变，页面 key 也变了。数据还在，把 `data-page-key` 改回原来的生成方式即可。见 [页面 key](./concepts#page-key)。
:::

::: details 评论时间的时区不对
改 `compose.yaml` 里的 `TZ`，然后重建容器。见 [时区与后台语言](../self-hosting/docker#timezone)。
:::

## 管理后台 {#admin}

::: details 找不到初始密码
Ecoku 没有默认密码，日志里也不会打印。按 [取得管理员临时密码](../self-hosting/docker#temporary-password) 生成一个。
:::

::: details 无法登录
按顺序检查：

1. 用 HTTPS 打开后台。只有 `localhost`、`127.0.0.1` 可以用 HTTP。
2. 地址栏的来源和 `notifications.instance_public_url`（或 `admin.allowed_origins`）完全一致，包括端口。
3. 用户名和密码正确。同一 IP 每分钟最多 5 次登录请求，成功的也算。
4. 人机验证能正常完成。验证服务坏了就 [用命令行关闭验证](../admin/captcha#disable)。
:::

::: details 忘记管理员密码
停服后用 `admin reset-password` 生成新的临时密码，见 [命令行](./cli#admin-reset-password)。
:::

## 通知与人机验证 {#notify}

::: details 测试邮件发送失败
见 [通知 · 常见问题](../admin/notifications#troubleshooting)。
:::

::: details 保存 Cap 设置时提示地址无效
Cap 地址必须是公网 HTTPS 地址，不能带用户名密码、查询参数或 `#`。`localhost` 和内网 IP 都不行。
:::

::: details 启用 Cap 后浏览器控制台报 CSP 错误
报错在博客页面上，说明博客自己的 CSP 没有放行 Cap，见 [博客页面的 CSP](../admin/captcha#csp)。报错在后台的话，刷新后台页面即可。
:::
