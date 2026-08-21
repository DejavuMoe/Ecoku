# Twikoo 导入

仅在目标站点已经创建、评论数仍为零时执行一次。导入保留时间、昵称、私有邮箱、网站、页面 key、回复层级和转换后的纯文本正文；不导入 IP、UA、地区、头像、赞踩或外部用户 ID，也不发送历史通知。

页面 key 会去掉 query/fragment；绝对 URL 只保留路径。导入结束时按站点博主昵称+邮箱回填 `is_blogger`。整批使用一个事务，失败不留部分数据。

## 备份

```bash
sudo docker compose down
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm

twikoo_stamp="$(date +%Y%m%d-%H%M%S)"
sudo cp --reflink=auto --preserve=mode,timestamps \
  ./data/ecoku.sqlite3 "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3"
sudo chown "$USER":"$USER" "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3"
chmod 600 "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3"
sha256sum "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3" \
  > "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3.sha256"
```

导出文件放在仓库和服务目录之外，用绝对路径只读挂载。

## 预检与导入

```bash
sudo docker compose run --rm --no-deps \
  --volume <ABSOLUTE_PATH>/twikoo-comment.json:/import/twikoo-comment.json:ro \
  ecoku import-twikoo \
  --site <SITE_ID> \
  --file /import/twikoo-comment.json \
  --dry-run
```

确认评论、根评论、回复、页面、邮箱、网站和缺失父记录摘要符合源数据后：

```bash
sudo docker compose run --rm --no-deps \
  --volume <ABSOLUTE_PATH>/twikoo-comment.json:/import/twikoo-comment.json:ro \
  ecoku import-twikoo \
  --site <SITE_ID> \
  --file /import/twikoo-comment.json

sudo docker compose up -d
```

目标站点已有评论时会拒绝。验收后从服务器删除含私有邮箱的原始导出；冷备份是否保留由你决定。
