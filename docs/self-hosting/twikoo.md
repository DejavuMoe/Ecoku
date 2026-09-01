# Twikoo 历史数据导入

Ecoku 提供了专用的 CLI 工具，支持从 Twikoo 导出的 JSON 文件无损迁移历史评论数据。

---

## 导入前提与契约

1. **目标站点必须为空**：Twikoo 导入仅允许导入到一个**已在管理后台注册、但评论数为 0** 的纯净目标站点。禁止向已有评论的站点追加导入。
2. **强制冷备份**：执行实际导入前，必须完成数据库的冷备份。
3. **支持预演（Dry-Run）**：支持在不写入数据库的情况下预先解析并校验数据格式。
4. **单事务原子提交**：整个导入过程在单个 SQLite 事务中完成，任何单条格式错误都会导致全量回滚，绝不残留部分导入数据。
5. **通知静默**：历史导入过程**绝不触发**任何邮件或 Telegram 通知。

---

## 字段映射与清洗规则

| Twikoo 原始字段 | Ecoku 映射与转换规则 |
| :--- | :--- |
| `_id` / `rid` / `pid` | 自动映射并重建父子评论层级关系（`parent_id`）。 |
| `url` (页面标识) | 自动清洗为规范的站内相对路径（剔除协议、Host、Query 参数与 Hash 锚点）。 |
| `comment` (正文) | 将历史 HTML / Markdown 正文提取并转换为安全的纯文本，剔除标签注入。 |
| `nick` | 映射为评论作者昵称。 |
| `mail` | 映射为私有邮箱（仅用于未来接收回复通知，绝不向公开 API 暴露）。 |
| `link` | 校验合法性后映射为作者个人网站（仅保留安全的 `http://` / `https://` 链接）。 |
| `created` | 保留精确历史发表时间戳。 |
| `ip` / `ua` / `os` | **直接丢弃**，严格符合 Ecoku 隐私边界。 |
| `is_blogger` | 导入完成后，系统自动根据目标站点的博主昵称与邮箱匹配并批量回填博主标记。 |

---

## 导入操作实战

### 1. 预演检查（Dry-Run）

将 Twikoo 导出的 JSON 文件放置于宿主机（例如 `~/Ecoku/data/twikoo.json`），先执行 Dry-Run 验证：

```bash
sudo docker compose run --rm --no-deps ecoku \
  ecoku-server import-twikoo \
  --site-id=blog \
  --file=/data/twikoo.json \
  --dry-run
```

检查控制台输出的解析统计信息（根评论数、子回复数、跳过异常数等）。

### 2. 执行正式导入

确认预演统计无误后，执行正式写入：

```bash
sudo docker compose run --rm --no-deps ecoku \
  ecoku-server import-twikoo \
  --site-id=blog \
  --file=/data/twikoo.json
```

### 3. 清理导入文件并启动服务

导入完成后，请及时从服务器磁盘彻底删除原始的 `twikoo.json` 导出文件（因其包含明文历史 IP/邮箱等敏感数据），并启动服务：

```bash
# 安全删除临时导出文件
rm -f ~/Ecoku/data/twikoo.json

# 启动服务
sudo docker compose up -d
```
