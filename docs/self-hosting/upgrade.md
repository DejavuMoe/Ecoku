# 升级与迁移

Ecoku 采用版本化、原位（In-Place）、事务性的 SQLite Schema 迁移体系。

准备升级到 **[v0.1.9](./upgrades/v0.1.9)** 时，请先查阅对应版本说明。自 v0.1.8 升级仍为 schema v7，无需执行数据库结构迁移；主要影响是公开列表读取预算保护与频控限流。回滚到 v0.1.8 前须移除显式新增的 `rate_limit.comment_list` 字段。详细限制、客户端表现与回滚步骤见版本说明。

升级过程中，只需修改 Compose 文件中的**精确镜像 Tag**，服务在启动时会自动检测并按版本顺序执行数据库升级。

---

## 升级核心契约

1. **单向事务迁移**：Schema 迁移在同一个 SQLite 文件中顺序向上执行，成功后向 `schema_migrations` 表追加版本记录。Ecoku **不支持自动向下迁移（Down-migration）**。
2. **严禁浮动 Tag**：生产环境绝对禁止使用 `latest`，必须使用形如 `v0.1.9` 的精确发布版本。
3. **不可逆性与回滚原则**：一旦数据库成功升级至高版本 Schema（例如 v7），**不能仅将镜像 Tag 换回旧版本**，否则旧版本服务因无法识别高版本 Schema 会拒绝启动。回滚必须使用升级前冷备份的数据库文件进行恢复。

---

## 标准停服升级 SOP

```bash
cd ~/Ecoku

# 步骤 1：阅读目标版本的发布说明与升级指南，确认配置变化
# （见下方各版本升级索引）

# 步骤 2：执行停服冷备份
sudo docker compose down
tar -czvf "ecoku-preupgrade-$(date +%Y%m%d_%H%M%S).tar.gz" data/ app/config.yaml ecoku.env compose.yaml

# 步骤 3：修改 compose.yaml 中的 image 为新版本（如 git.via.moe/dejavu/ecoku:v0.1.9）
# 若新版本有新环境变量要求，一并补充至 ecoku.env

# 步骤 4：拉取新镜像并启动
sudo docker compose pull
sudo docker compose up -d

# 步骤 5：检查启动日志与 Schema 迁移状态
sudo docker compose logs --tail=100 -f ecoku

# 步骤 6：业务与接口验收
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

---

## Schema 版本演进历史

| 镜像版本 | Schema 版本 | 核心数据库变更与特性 |
| :--- | :---: | :--- |
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
