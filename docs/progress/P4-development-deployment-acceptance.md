# P4 持久开发部署补充验收

> 历史说明：本文保留首次持久开发部署证据；当前 release、站点管理、通知与浏览器验收见
> `P4-final-acceptance.md`。
>
> 退役说明：本文描述的远程实例已经退出项目测试范围。访问地址、IP、登录指引、专用部署模板与
> 同步脚本均已删除；以下内容不得作为当前运维步骤执行。

日期：2026-08-13
结论：**当时通过**。远程测试主机曾从一次性容器验收环境转换为保留 SQLite、凭据、源码
release、证书和备份的持续开发实例。本记录是 `P4-followup-acceptance.md` 之后的历史增量
事实，不把开发实例描述为正式发布或生产 SLA。

## 1. 用户授权与部署边界

- 当时使用用户创建且未开启代理的测试域名 A/AAAA；该域名现已从仓库移除；
- 当时允许在远程测试主机安装 Caddy、启用自动 TLS 和 IPv4/IPv6 HTTP(S)；
- 本地已提交源码可以同步到固定远端目录，但私有配置、数据库、日志、依赖、缓存和构建
  产物不得进入源码归档；
- SQLite、管理员凭据和服务端 key 必须跨更新与重启保留，后续不再按一次性验收方式清理；
- 旧容器、旧数据卷和迁移前备份本次全部保留，用作人工回滚证据；
- 用户已授权本地 Git 初始化和分次规范提交；本次没有配置远程、推送、tag、PR、release、
  npm publish 或镜像仓库推送。

## 2. 最终拓扑

```text
IPv4/IPv6 :80/:443
        |
   Caddy 2.11.2
   自动 TLS / HTTP -> HTTPS
        |
127.0.0.1:12123
        |
ecoku-development (UID/GID 10001)
        |
external Docker volume: ecoku-data
```

- 管理端与 HTTPS API 的旧公网地址已移除；
- Ecoku 端口只绑定宿主机 `127.0.0.1:12123`，公网不能直接访问 12123；
- Caddy 在 TCP 80/443 和 UDP 443 监听双栈；80 自动 308 跳转 HTTPS；
- Caddyfile 不启用 access log。HTTPS 站点响应包含 HSTS、`nosniff` 和 `no-referrer`；
- Caddy 到容器的实测 socket 对端为 `172.17.0.1`，后端只信任这一精确代理 IP；
- 管理 Origin 当时仅允许旧测试域名；`blog-local` 公开 Origin 仍仅为本地 Hugo 的
  `http://127.0.0.1:1313` 和 `http://localhost:1313`。

Caddy 官方说明：公共域名的 A/AAAA 指向服务器、80/443 可达且数据目录持久时，会自动
申请并续期证书并执行 HTTP 到 HTTPS 跳转；本实例的实际 ACME、双栈和跳转结果均已独立
验证。参考 [Automatic HTTPS](https://caddyserver.com/docs/automatic-https) 与
[reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)。

## 3. 持久目录与同步机制

当时新增过专用 Compose、无秘密配置模板、Caddyfile、部署脚本、本地同步脚本和运行 SOP，
用于固定容器、外部数据卷、TLS 反代、源码归档校验、卷外备份和健康门禁。这些旧实例专属资产
现已全部从仓库删除，不能作为通用部署入口复用。

远端固定路径：

- `/etc/ecoku/config.yaml`、`/etc/ecoku/ecoku.env`、
  `/etc/ecoku/admin-credentials.txt`；
- `/srv/ecoku/releases/<commit>`、`/srv/ecoku/current`、`/srv/ecoku/incoming`；
- `/var/lib/ecoku/deployment-state`；
- `/var/backups/ecoku`；
- Docker external 卷 `ecoku-data`。

当前 release 为 `37ff4cdba6c3e56a3ab1878f1819d43550686d26`。系统安装的 Caddyfile、
Ecoku 配置和部署脚本与该 release 中对应文件的 SHA-256 完全一致。连续两次运行正式同步
脚本均成功；第二次没有 Compose 卷所有权警告，且继续使用同一个 external 卷。

## 4. SQLite 与凭据迁移

迁移前停止旧容器 `ecoku-integration-20260813-114933`，确认没有 `-wal`、`-shm` 或
`-journal` 边车。旧数据库、卷外备份和新卷数据库 SHA-256 均为：

```text
88c9429a0427970d48113c591427a7ba1b73591240465ecff05130d54e37a72e
```

迁移前卷外备份为
`/var/backups/ecoku/ecoku-pre-persistent-20260813T053253Z.sqlite3`，权限 `0600`；每次后续
同步还生成不覆盖的 `ecoku-pre-deploy-*.sqlite3` 和 SHA-256 记录。旧容器保持 `exited`，
旧卷 `ecoku-integration-data-20260813-114933` 未删除。

现有管理员用户名、bcrypt 哈希、token key 和站点 management key 没有重新生成，已从
临时目录迁入 `/etc/ecoku`。私有 env 与人工凭据文件均为 root `0600`；Compose 所需的
单引号规范化在远端完成，没有输出任何值。远端凭据文件与本地 Git 忽略副本 SHA-256
一致；密码、哈希、token 和 key 没有进入仓库、文档、命令参数、聊天或截图。

容器执行两次显式重启后，管理员仍可登录，评论和线程计数保持不变。最终只读 HTTPS/API
验收结果：

```text
sites=1 pending=8 approved=52 rejected=2 deleted=0
public_comments=52 max_depth=6 log_privacy=ok
```

日志扫描同时覆盖容器 stdout 和 `/data/ecoku.log`，并逐一检查当前管理员密码、Bearer
token、全部运行 key、全部评论私有邮箱与正文；均未命中。

## 5. TLS、网络与安全验收

- DNS 在本机和服务器均曾正确解析到旧测试主机的 IPv4 与 IPv6；具体地址已移除；
- Caddy `2.11.2-1~bpo13+1` 从 Debian 13 backports 安装，systemd 为 `enabled` 且
  `active`；Docker Compose 为 Debian `2.26.1-4`；
- Caddy 成功通过 Let's Encrypt HTTP-01 获取旧测试域名证书；本机和服务器分别以
  `curl -4`、`curl -6` GET `/admin/` 均返回 200，健康 API 均返回统一 200 JSON；
- 公开评论预检：允许本地 Hugo Origin 返回 204 和精确
  `Access-Control-Allow-Origin`，未注册 Origin 返回 403；
- 管理预检：旧测试域名 Origin 返回 204，本地 Hugo Origin 返回 403；
- 13 次错误管理员登录分别伪造不同 `X-Forwarded-For`，第 11 次开始稳定返回 429；
  之后重启容器清空单进程测试限流，并重新执行最终管理员/API/数据验收；
- 容器 `read_only=true`、`restart=unless-stopped`、`cap_drop=ALL`、
  `no-new-privileges=true`；PID 1 的 `CapEff` 全零、`NoNewPrivs=1`，运行用户为
  `10001:10001`。

Caddy 自动重定向服务器仍会在 HTTP 308 响应中标识 `Server: Caddy`；HTTPS Ecoku 响应
已移除该头。这不泄露应用秘密，但若以后要求所有重定向响应也隐藏服务器产品名，需要
单独调整自动 HTTPS 重定向路由并重新验收。

## 6. 本地自动化与 Hugo 集成

| 命令/检查 | 结果 |
| --- | --- |
| `cd server && go test -count=1 ./...` | 通过 |
| `cd server && go vet ./...` | 通过 |
| `pnpm run verify:client` | 2 个测试文件、21 项测试、类型、ESM/UMD/CJS/types 构建和包契约通过；未发布 |
| `pnpm run verify:admin` | 1 个测试文件、13 项测试、类型和生产构建通过 |
| `node designs/plain-thread-comments/prototype-v3.test.mjs` | 52 条和 1～6 级 fixture 契约通过 |
| Hugo 0.164.0 `--enableGitInfo=false` 独立目标构建 | 260 pages、18 paginator pages、822 non-page files、13 static files，通过 |
| client UMD 与 Hugo vendor SHA-256 | 相同：`78AB2E96...BDD4E4` |
| 生产 client 源码和 dist 的第三方 IP / management key 扫描 | 无命中 |
| Caddyfile / shell / PowerShell / Compose 配置检查 | 通过 |
| `git diff --check` | 通过 |

本地嵌套 Hugo 仓库 `test_site/Blog/hugo.yaml` 当时把 `server_url` 从明文 IP HTTP 更新为
旧 HTTPS 测试入口，运行中的 Hugo server 热更新后也使用该地址。该嵌套仓库
在本次之前已有多项用户未提交改动；本次没有替用户提交、删除或覆盖它们。

## 7. 浏览器验收

使用真实本地 Hugo、生产 UMD 和远端 HTTPS API：

- 首批真实渲染包含六级回复；连续四次“加载更多”后得到 52 条评论、47 个根线程、最大
  层级 6，标题为“52 条评论”；
- 生产 SDK 当时使用旧 HTTPS 测试入口；桌面与 390px 窄屏均无横向溢出；
- 管理端通过持久凭据登录，待审核为 8 条、已批准为 52 条且分 3 页；批量按钮在未选择时
  正确禁用；本次浏览器验收没有批准、拒绝、删除或新增评论；
- 管理端仅加载同源 JS/CSS，控制台无 warning/error；
- Hugo 页没有 Ecoku 相关控制台错误。唯一 warning 来自 Hugo 主题既有的
  `stats.via.moe` 分析脚本对 localhost 的忽略提示，不属于 Ecoku SDK；该第三方统计是
  测试博客自身现状，本次未修改。

管理端与 Hugo 评论页当时曾作为人工验收页面；对应实例现已退役，不能继续访问或复用凭据。

## 8. 修改与提交

本次新增提交：

- `faf8934 ops: add persistent dual-stack development deployment`
- `b18067f fix(ops): scope Git trust for source sync`
- `37ff4cd fix(ops): declare the persistent data volume external`

本验收记录将在单独文档提交中保存。仓库没有配置远程，本地提交均未推送。

## 9. 条件项与未覆盖范围

- 已验证 Caddy reload、Ecoku 多次 restart 和 systemd/container 自动启动配置，但没有为
  验收主动重启整台 Debian 主机；完整主机重启仍是条件性验证；
- 本次没有执行卷外备份的破坏性恢复。临时卷恢复能力已在原 P4 容器验收中通过，但当前
  持久卷的灾难恢复应在未来维护窗口使用副本演练；
- 没有做长时间可用性、压力、弱网、证书续期周期或公网攻击流量验收；
- 开发实例没有反垃圾平台、分布式限流、通知、普通用户账户、RBAC 或多实例高可用；
- 本次没有发布 npm、推送镜像、创建 tag/release，也没有把开发实例声明为正式生产发布。

当时的远端目录、Caddy 数据、Docker 卷、回滚容器和固定容器保留策略仅属于该次历史验收。
专用同步脚本和部署模板现已删除；任何新环境必须重新设计部署与数据保留策略。
