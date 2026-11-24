# 从 Twikoo 迁移

`import-twikoo` 命令把 Twikoo 导出的评论导入到一个已登记的 Ecoku 站点，保留回复关系。

导入的评论直接公开，过程中不发任何通知。

::: warning 只能导入一次
目标站点必须一条评论都没有，包括已删除的。在新站点开放评论之前完成导入。
:::

<div class="steps">

### 准备

1. 在后台 [登记目标站点](../admin/sites)。想让你自己以前的评论带上博主标志，先设置好 [博主昵称和邮箱](../admin/blogger)。
2. 在 Twikoo 里导出评论，得到一个 JSON 数组文件（不超过 64 MiB）。
3. 按 [备份与恢复](./backup#cold-backup) 做一次冷备份，之后保持服务停止，直到导入完成。

把导出文件复制到 `data/` 里，让容器能读到（把 `/path/to/twikoo.json` 换成实际路径）：

```bash
cd ~/Ecoku
sudo docker compose stop ecoku
sudo install -o 10001 -g 10001 -m 600 /path/to/twikoo.json data/twikoo.json
```

### 预检

把 `blog` 换成你的站点 ID，加 `--dry-run` 运行：

```bash
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json --dry-run
```

预检会完整走一遍导入，然后回滚，不保存任何评论。输出类似：

```text
Twikoo 导入预检通过：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
```

核对数字和 Twikoo 里是否大致相符。「缺失父记录」不为 0，表示有些回复找不到原评论，会变成根评论（不会被丢掉）。

导出里有 `isSpam: true` 的记录时，命令会停下并报告数量。在导出文件的副本里删掉这些记录，再重新预检。

::: details 其他会让命令报错的情况
JSON 格式错误、文件超过 64 MiB、空数组、ID 重复、正文超过 10000 个字符、昵称超过 80 个字符、页面 key 为空或超过 512 个字符、站点不存在或已有评论。出错时不会保存任何评论。
:::

### 正式导入

去掉 `--dry-run` 再运行一次。导入在一个事务里完成，任何一条出错都会整体回滚。成功后删掉临时副本，启动服务：

```bash
(
set -eu
cd ~/Ecoku
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json
sudo rm -- data/twikoo.json
sudo docker compose up -d --wait --wait-timeout 120 ecoku
)
```

打开几篇文章，确认历史评论和回复关系都对。

</div>

## 页面 key 要对得上

导入时，页面 key 取自 Twikoo 记录的 `url` 的路径部分，例如 `/posts/hello-world/`。中文等非 ASCII 字符保存为百分号编码，如 `/posts/%E4%BD%A0%E5%A5%BD/`。

你的接入代码生成的 `data-page-key` 必须和它一字不差，历史评论才会出现在对应文章下。在后台评论列表里能看到每条评论的页面 key，拿它和博客模板的输出对比。末尾斜杠或编码不一致时，调整接入代码，不要改导入的数据。

## 字段对照

| Twikoo 字段 | 导入后 |
| --- | --- |
| `_id` / `id`、`pid`、`rid` | 重建回复关系，优先使用 `pid` 指向的直接父评论。`pid` 为空或导出中找不到该记录时，尝试挂到 `rid` 指向的根评论下。找不到所引用的父评论、父评论在另一个页面或形成循环时，这条评论改为根评论，计入「缺失父记录」。同页面的有效后代仍保留回复关系。 |
| `url` | 取路径部分作为页面 key，去掉查询参数和 `#` 片段。没有路径的 HTTP(S) 首页地址（如 `https://blog.example`）使用 `/`。 |
| `comment` | HTML 转成纯文本：`<br>` 和块级元素变为换行，移除标签时保留 `<pre>` 内文本的缩进、制表符和内部空行，图片变为 alt 文字或 `[图片]`，`<script>`、`<style>` 丢弃。不解析 Markdown。 |
| `nick` | 昵称。为空时记为「访客」。 |
| `mail` | 私有邮箱，用于之后的回复通知。超过 254 个字符时不导入。 |
| `link` | 访客网址，只保留 `http`/`https` 地址；没有协议的地址（如 `example.com`）补成 `https://`。 |
| `created` / `updated` | 创建和更新时间。 |

不导入：IP、User-Agent、头像、点赞、Twikoo 用户 ID，以及导出文件里的博主标记。

博主标记按目标站点当前的博主昵称和邮箱回填：昵称完全一致、邮箱一致（不区分大小写）的评论标为博主评论。
