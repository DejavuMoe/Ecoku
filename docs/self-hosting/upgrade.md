# 升级与迁移

Ecoku 采用版本化、原位（In-Place）、事务性的 SQLite Schema 迁移体系。

**[v0.2.4](./upgrades/v0.2.4)** 已于 2026-09-16 发布：安全修复、可撤销管理员会话与回复深度限制，schema v7 → v8。

升级前核对对应版本的配置兼容性。修改 Compose 文件中的精确镜像 tag 后，服务在启动时按版本顺序执行数据库升级。

---

## 升级核心契约

1. **单向事务迁移**：Schema 迁移在同一个 SQLite 文件中顺序向上执行，成功后向 `schema_migrations` 表追加版本记录。Ecoku **不支持自动向下迁移（Down-migration）**。
2. **严禁浮动 Tag**：生产环境绝对禁止使用 `latest`，必须使用形如 `v0.2.4` 的精确发布版本。
3. **不可逆性与回滚原则**：一旦数据库成功升级至高版本 Schema（例如 v8），**不能仅将镜像 Tag 换回旧版本**，否则旧版本服务因无法识别高版本 Schema 会拒绝启动。回滚必须使用升级前冷备份的数据库文件进行恢复。

---

## 标准停服升级 SOP

```bash
(
set -eu
umask 077
cd "$HOME/Ecoku"
install -d -m 700 "$HOME/backups"
sudo docker compose down
archive="$HOME/backups/ecoku-$(date +%Y%m%d_%H%M%S).tar.gz"
[ ! -e "$archive" ]
sudo tar -czf - data/ app/config.yaml ecoku.env compose.yaml > "$archive"
contents=$(tar -tzf "$archive")
for required in data/ecoku.sqlite3 app/config.yaml ecoku.env compose.yaml; do
  printf '%s\n' "$contents" | grep -Fx "$required" > /dev/null
done
printf 'Verified backup: %s\n' "$archive"
vi app/config.yaml compose.yaml
sudo docker compose pull && sudo docker compose up -d
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
)
```

---

## Schema 版本演进历史

| 镜像版本 | Schema 版本 | 核心数据库变更与特性 |
| :--- | :---: | :--- |
| **`v0.2.4`** | `v8` | `admin_sessions` |
| **`v0.1.9`** | `v7`（不变） | 不新增迁移；公开评论列表 CWE-400 资源预算防护、单层游标分页与独立列表读取频控。 |
| **`v0.1.8`** | `v7` | `sites` 表新增 `smoji_enabled` (布尔) 与 `smoji_manifest_url` (TEXT)，支持站点级表情包。 |
| **`v0.1.7`** | `v6`（不变） | 不改变 Schema；构建工具链升级、多语言文档体系落地与 CI 镜像构建优化。 |
| **`v0.1.6`** | `v6`（不变） | 不改变 Schema；修复 Cap instrumentation 脚本所需动态 CSP 策略。 |
| **`v0.1.5`** | `v6` | `turnstile_settings` 表原位重命名为 `captcha_settings`，新增 `provider` 及自托管 Cap 相关配置字段。 |
| **`v0.1.4`** | `v5`（不变） | 不改变 Schema；后台保存博主口令时自动回填历史所有未删除评论的 `is_blogger` 标记。 |
| **`v0.1.3`** | `v5` | `sites` 表增加 `blogger_passphrase_hash`；`comments` 表增加 `is_blogger`；`notification_outbox` 拆为每接收目标单行。 |
| **`v0.1.2`** | `v4`（不变） | 不改变 Schema；优化评论区昵称排版基线对齐与 14px 字号阶梯。 |
| **`v0.1.1`** | `v4`（不变） | 不改变 Schema；评论折叠按钮 `[+]`/`[-]` 提高优先级并固定 3ch 等宽。 |
| **`v0.1.0`** | `v4` | 首个正式发布版本；多站点纯文本评论模型、墓碑软删除、通知配置与 Cloudflare Turnstile 支持。 |
| **更早候选版** | `v1` ～ `v4` | RC 候选阶段：单容器极简架构演进、SQLite WAL 模式引入与时区支持。 |

---

## 历史版本升级指南索引

| 版本 | 发布日期 | Schema 变化 | 升级要点与说明 |
| :--- | :--- | :---: | :--- |
| [**v0.2.4**](./upgrades/v0.2.4) | 2026-09-16 | v7 → v8 | HttpOnly Cookie + SQLite 可撤销会话 |
| [**v0.2.3**](./upgrades/v0.2.3) | 2026-09-16 (tag) | v7（不变） | 身份、通知、导入与客户端审计修复。 |
| [**v0.2.2**](./upgrades/v0.2.2) | 2026-09-13 | v7（不变） | 修复 Smoji 选择器在窄屏下的布局问题。 |
| [**v0.2.1**](./upgrades/v0.2.1) | 2026-09-12 | v7（不变） | Smoji 清单容量提升与精简 `base` 模板支持。 |
| [**v0.2.0**](./upgrades/v0.2.0) | 2026-09-12 | v7（不变） | 文档、接入示例与 API 参考事实校正和完善。 |
| [**v0.1.9**](./upgrades/v0.1.9) | 2026-08-31 | v7（不变） | CWE-400 修复；旧配置可启动，大线程读取和显式新配置键的回滚需留意。 |
| [**v0.1.8**](./upgrades/v0.1.8) | 2026-08-27 | v6 → v7 | 新增 Smoji 纯文本表情包；站点新增表情包开关与清单 URL。 |
| [**v0.1.7**](./upgrades/v0.1.7) | 2026-08-26 | v6 | 构建工具链升级与多语言文档体系落地；运行时契约保持不变。 |
| [**v0.1.6**](./upgrades/v0.1.6) | 2026-08-18 | v6 | 优化 Cap 客户端在管理端所需的动态 CSP 求值策略。 |
| [**v0.1.5**](./upgrades/v0.1.5) | 2026-08-17 | v5 → v6 | 引入自托管 Cap 人机验证；安全设置升级为三态单选。 |
| [**v0.1.4**](./upgrades/v0.1.4) | 2026-08-15 | v5 | 管理后台保存博主口令时自动回填历史评论的 `is_blogger` 标记。 |
| [**v0.1.3**](./upgrades/v0.1.3) | 2026-08-15 | v4 → v5 | 引入博主口令认证；Outbox 通知队列按接收目标拆行入队。 |
| [**v0.1.2**](./upgrades/v0.1.2) | 2026-08-15 | v4 | 优化评论区元信息排版基线与字号阶梯。 |
| [**v0.1.1**](./upgrades/v0.1.1) | 2026-08-15 | v4 | 评论折叠按钮 `[+]`/`[-]` 固定为 3ch 等宽，消除折叠切换抖动。 |
| [**v0.1.0**](./upgrades/v0.1.0) | 2026-08-15 | v4 | 首个正式发布版本。 |
| [**更早候选版**](./upgrades/earlier) | 2026-08-14 | v1 ～ v4 | 早期单容器架构设计、WAL 模式引入与时区规范。 |

## v0.2.4 升级兼容性

v8 新增 `admin_sessions` 表和到期索引，不改写评论、配置或既有迁移记录。旧登录失效，需重新登录。`admin.token_ttl_minutes` 请省略或设为 480；除 `0` 和 `480` 外的旧自定义值会阻止启动。挂载、环境变量和密码哈希保持不变。回滚至 v0.2.3 或更早版本，必须先停服并保留当前现场，再恢复升级前完整冷备份及原镜像；仅改旧 tag 不能打开 v8 库。恢复备份会丢失备份后的写入，需由操作者明确接受。
