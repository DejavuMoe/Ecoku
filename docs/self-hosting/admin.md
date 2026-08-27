# 后台配置

打开实例的 `/admin/`，用 `ECOKU_ADMIN_USERNAME` 与对应密码登录。管理端 Bearer token 只存在当前页内存，关闭或刷新后需重新登录。

`admin.allowed_origins` 与评论站点来源分开配置，不能用一个宽泛来源代替。

## 站点

| 配置 | 说明 |
| --- | --- |
| ID | 接入用的唯一值；创建后不可改 |
| 站点地址、名称 | 识别站点与拼通知链接 |
| Allowed origins | 允许调用评论 API 的精确 Origin（完整 `https://域名`，无路径） |
| 邮箱、网站 | 访客字段是否**必填**（字段仍会显示） |
| 占位文本、长度上限、空状态、排序 | 表单与列表行为 |

评论提交后直接发布，没有审核队列。

### 表情包

站点可选启用表情包并填写一个 `smoji.json` 清单 URL。生产环境须使用 HTTPS；清单中的图片须与清单同源。Ecoku 不打包或代理这些资源，访客首次打开表情选择框时才会动态加载。直链请求可能向资源主机暴露访客 IP，请只使用可信主机。关闭后会保留 URL，历史表情标记按纯文本显示。

management key（若在 YAML 中声明）只供可信服务端做所属站点的墓碑删除等操作，不是浏览器接入配置。详见 [Docker 部署](./docker#配置)。

## 博主身份

昵称与邮箱须同时填写或同时留空。启用时另设 12–80 字符口令；保存后按该身份回填历史评论的博主标记。可配置公开徽章文案。

公开区：已启用口令时，博主在昵称栏填口令即可，不必填邮箱或网站。口令错误且同时填了访客身份时，按普通访客发布。

## 通知

实例级 SMTP（仅 TLS / STARTTLS）与 Telegram。凭据由 `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 加密存入 SQLite；管理端只显示「已设置」，不提供判定表或模板预览。启用渠道前须配置 `notifications.instance_public_url`。

默认规则（以存储的 `is_blogger` 为准）：

| 场景 | 行为 |
| --- | --- |
| 访客发根评论 | 通知博主渠道 |
| 访客回复访客 | 通知博主渠道，并邮件通知被直接回复者 |
| 博主回复访客 | 仅邮件通知被直接回复者 |
| 访客回复博主 | 仅通知博主渠道 |
| 博主回复博主 | 不通知 |
| 同一邮箱回复自己 | 不发送访客回复邮件 |

## 人机验证

在「安全」页选择关闭、Cloudflare Turnstile 或自托管 Cap（三选一）。启用后同时保护评论提交与管理员登录；失败则拒绝，不会自动换提供方。切换提供方不会删除未启用方的已存配置。

### Turnstile

在 Cloudflare 创建 Widget，填入 Site key 与 Secret key。Pre-clearance 要求站点经 Cloudflare 代理；`cf_clearance` 不替代 Ecoku Siteverify。

### Cap

在 Cap Standalone 创建密钥，并把管理端 Origin、全部评论站点 Origin 加入该 Key 的 CORS。实例须经公开 HTTPS 提供 `/assets/widget.js`、`/assets/cap_wasm_bg.wasm` 与 `/<sitekey>/siteverify`。在 Ecoku 填写实例地址、Site key、Secret key。

管理端 CSP 随当前提供方收敛：Turnstile 放行 Cloudflare；Cap 放行实例 Origin、WASM、Blob Worker；Cap instrumentation 可能还需 `'unsafe-eval'`。无法接受时关闭 instrumentation 或改用 Turnstile。

## 验证故障时恢复登录

```bash
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku captcha status
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```

登录后修正验证配置，再在管理端重新启用。
