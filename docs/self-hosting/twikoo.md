# Twikoo 历史数据导入

`import-twikoo` 将 Twikoo JSON 数组中的受支持字段转换为 Ecoku 纯文本评论。目标站点必须已注册且零评论（包括墓碑）。导入不会发送通知，也不会保留 IP、UA、头像、赞踩或外部用户身份。

## 字段与转换

| JSON | Ecoku |
| :--- | :--- |
| `_id` / `id`、`pid` / `rid` | 重建评论 ID 与父子关系，优先直接父评论；缺失、跨页面或无法解析的父关系可能转为根评论并计入缺失父记录。 |
| `url` | 提取站内路径并去掉 query / fragment。 |
| `comment` | 提取 HTML 文本，丢弃 script/style，图片保留 alt 或 `[图片]`；不解析 Markdown 语法。 |
| `nick` / `mail` / `link` | 保存昵称、私有邮箱和合法 http(s) 作者网站。 |
| `created` / `updated` | 转换并保存时间。 |
| 博主标记 | 依据目标站点已配置的昵称与邮箱回填，不读取导出文件中的 `is_blogger`。 |

## 1. 预检前准备

先注册目标站点，按[备份与恢复](./backup)完成停服冷备份并验证归档。备份示例最后会启动服务，因此导入前再次停服。以下命令将原始导出复制为临时文件，并使容器用户 UID 10001 可读；将 `/path/to/twikoo.json` 替换为自己的源文件，保留原件。

```bash
cd ~/Ecoku
sudo docker compose down
sudo install -o 10001 -g 10001 -m 600 /path/to/twikoo.json data/twikoo.json
```

## 2. 执行 dry-run

将 `blog` 替换为目标站点 ID。dry-run 会执行导入事务后回滚，不持久化导入的评论；但 CLI 启动时仍会初始化或迁移数据库，因此不是纯只读检查。

```bash
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json --dry-run
```

核对输出的评论、根评论、回复、页面、邮箱、网站及缺失父记录数量。无效 JSON、重复 ID 等错误会中止；缺失父关系会保留为根评论，不应当作“跳过异常”。

## 3. 正式导入与清理

预检结果无误且备份已验证后，保持服务停止，执行不带 `--dry-run` 的同一命令。导入事务失败会整体回滚。成功后删除本次临时副本、启动服务，检查目标站点和历史评论；源文件与备份按自己的保留策略管理。

```bash
(
set -eu
cd ~/Ecoku
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json
sudo rm -- data/twikoo.json
sudo docker compose up -d
)
```
