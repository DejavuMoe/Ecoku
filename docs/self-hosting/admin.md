# 后台配置

访问 `https://comments.example.com/admin/`，使用初始化时的管理员账户登录。Token 只在当前页内存，刷新后需重新登录。管理端来源与公开评论站点来源是两套白名单，不能混用。

## 站点

在「站点管理」中创建：

| 字段 | 说明 |
| --- | --- |
| 站点 ID | 稳定、简短，创建后不可改 |
| 站点 URL | 如 `https://blog.example.com`；通知原文链接只从这里与页面 key 拼接 |
| 站点名称 | 留空时回落到 URL 域名 |
| 允许来源 | 每行一个完整 Origin，如 `https://blog.example.com` |
| 默认排序 | `newest` 或 `oldest` |
| 邮箱 / 网站 | 是否必填；默认邮箱必填、网站可选 |
| 占位文案 | 最多 80 字；空则「写下评论（仅支持纯文本）」 |
| 正文上限 | 1–10000 个 Unicode code point，默认 1000 |
| 无评论文案 | 默认「还没有评论」加一行「成为第一个留下评论的人。」 |

新评论提交后直接公开。management key 只供可信服务端自动化做所属站点的墓碑删除，管理端新建站点默认不生成密钥；它对评论列表/详情返回 403。

## 博主

昵称与邮箱必须同时填写或同时留空；启用时还须设置口令（12–80 字符）。口令只存 bcrypt，界面只返回是否已设置。

公开评论区不为博主提供额外表单：昵称栏填口令即可。服务端改写为配置昵称、私有邮箱，网站设为该站点 URL。口令填错且同时提供了访客身份时，按普通访客发布。

保存口令时，按昵称精确匹配、邮箱大小写不敏感匹配，回填未删除的历史评论。公开只多一个徽章、`isBlogger` 和站点链接。

## 通知

实例级，不随站点选择器变化。支持 SMTP 博主通知、访客直接回复邮件、Telegram 博主通知。测试投递单独限流。

SMTP 只允许 `tls` 或 `starttls`。密码与 Bot Token 使用 `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 加密；缺密钥或无法解密则失败关闭。界面不展示通知判定表或模板预览。判定矩阵见 [特性](/guide/features#通知)。

## 机器人验证

「安全」页三态：关闭 / Cloudflare Turnstile / 自托管 Cap。启用时后两者只能选一个，同时保护评论提交和管理员登录。切换或关闭不会清除另一提供方已保存的配置。两者故障都失败关闭，不会自动降级。

### Turnstile

1. 在 Cloudflare 控制台创建小组件，把管理端与全部评论站点主机名加入列表。
2. 管理端选择 Turnstile，填 Sitekey 与 Secret key。
3. 小组件模式只在 Cloudflare 配置。

Secret 使用同一通知主密钥加密。未配置该密钥时不能保存已启用的 Turnstile。

Pre-clearance 也只在 Cloudflare 配置。`cf_clearance` 不会让 Ecoku 跳过 Siteverify。站点不在 Cloudflare 代理后应关闭它，否则控制台出现 `aborting clearance redemption`。

### Cap

Cap 的 `ADMIN_KEY` 只用于 Cap 自己的后台，不要填进 Ecoku。

1. 在 Cap Standalone 为 Ecoku 创建 Key；保持 instrumentation 开启，并把管理端 Origin 与每个评论站点 Origin 加入该 Key 的 CORS。
2. 实例须为公开 HTTPS，并提供固定版本的 `/assets/widget.js` 与 `/assets/cap_wasm_bg.wasm`。
3. 管理端选择 Cap，填写实例根地址、Site key、Secret key。地址只接受公开 HTTPS，不要带凭据、query、fragment、localhost 或私网 IP。
4. 保存后另开普通窗口验证登录和发表。Token 单次使用。

`v0.1.6` 起，管理端只在 Cap 为当前方式时，为该精确 Origin 加入 Widget、WASM、Blob Worker、nonce 与 instrumentation 所需的 `'unsafe-eval'`。切到关闭或 Turnstile 会在下一次页面响应中去掉这些项，但保留 Cap 配置。

若 instrumentation 返回 `instr_timeout` 且 `/redeem` 为 429，先核对响应 CSP 是否来自当前镜像。不要靠改 CORS、关闭失败关闭，或给 Caddy 加第二份宽泛 CSP 绕过。

使用镜像同源加载器的站点会随镜像获得 Cap 支持。自行固定旧 npm/UMD SDK 的站点必须先更新到包含 `formConfig.captcha` / `captchaToken` 的版本。

宿主站点若使用严格 CSP：Turnstile 需允许 `https://challenges.cloudflare.com`；Cap 需加入实例 Origin、`worker-src blob:`、`'wasm-unsafe-eval'`，以及当前 Cap 3.x instrumentation 所需的 `'unsafe-eval'`。不接受动态求值风险时，关闭该 Key 的 instrumentation 或改用 Turnstile。

## 验证故障时恢复登录

当前提供方故障导致无法登录时，在 Ecoku 主机显式停服恢复。命令会保留冷备份，把验证方式设为关闭，两套配置都保留：

```bash
set -euo pipefail
cd ~/Ecoku

sudo docker compose down
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm

umask 077
mkdir -p ./backups
backup_stamp="$(date +%Y%m%d-%H%M%S)"
sudo cp --reflink=auto --preserve=mode,timestamps \
  ./data/ecoku.sqlite3 "./backups/ecoku-before-captcha-disable-${backup_stamp}.sqlite3"
sudo chown "$USER":"$USER" "./backups/ecoku-before-captcha-disable-${backup_stamp}.sqlite3"
chmod 600 "./backups/ecoku-before-captcha-disable-${backup_stamp}.sqlite3"

sudo docker compose run --rm --no-deps ecoku captcha status
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```

无 CAPTCHA 登录后修复或切换提供方再保存。必须使用当前精确镜像和同一个 `./data`。不要手改设置表。

## 时区

`TZ` 只写在 `ecoku.env`。改完后必须重建容器：

```bash
printf "\nTZ='Asia/Singapore'\n" >> ecoku.env
sudo chmod 0600 ./ecoku.env
sudo docker compose up -d
```

悬停提示形如 `Asia/Singapore UTC+8`。`v0.1.0-rc.7` 及更早镜像不会应用该格式，需先升级。
