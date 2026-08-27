# Twikoo 导入

一次性导入：目标站点须已在管理端创建，且评论数为零。保留时间、昵称、私有邮箱、网站、页面 key、回复关系，正文转为纯文本。不导入 IP、UA、地区、头像、赞踩或外部用户 ID，也不发送历史通知。

页面 key 会去掉查询串与片段；绝对 URL 只保留路径。单事务写入，最大导出约 64 MB。损坏的父评论会降为根评论，并在结果中报告。导入结束后按站点博主昵称+邮箱回填 `is_blogger`。

## 备份

导入前按 [备份与恢复](./backup) 停服冷备份。确认无残留 WAL/SHM：

```bash
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm
```

## 预检与导入

将导出文件放在服务目录外，用绝对路径只读挂载：

```bash
sudo docker compose run --rm --no-deps \
  --volume <ABSOLUTE_PATH>/twikoo-comment.json:/import/twikoo-comment.json:ro \
  ecoku import-twikoo \
  --site <SITE_ID> \
  --file /import/twikoo-comment.json \
  --dry-run
```

确认后再去掉 `--dry-run` 执行一次，然后：

```bash
sudo docker compose up -d
```

目标站点已有评论时导入会拒绝。验收后删除含私有邮箱的原始导出。
