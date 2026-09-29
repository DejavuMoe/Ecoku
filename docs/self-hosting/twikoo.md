# 从 Twikoo 迁移

`import-twikoo` 命令把 Twikoo 导出的评论导入到一个 Ecoku 站点。导入只能做一次：目标站点必须已经注册，而且**没有任何评论**（包括已删除的）。所以请在新站点上线、有人发表评论之前完成。

## 会导入什么

| Twikoo 字段 | 导入后 |
| --- | --- |
| `_id` / `id`、`pid`、`rid` | 重建回复关系，优先使用直接父评论；导出文件中没有直接父评论时，改挂到 `rid` 指向的根评论下。两者都找不到、父评论在另一个页面或形成循环时，这条评论改为根评论，计入“缺失父记录”。 |
| `url` | 取路径部分作为页面 key，去掉查询参数和 `#` 片段。 |
| `comment` | HTML 转成纯文本：`<br>` 和块级元素变为换行，图片变为 alt 文字或 `[图片]`，`<script>`、`<style>` 丢弃。不解析 Markdown。 |
| `nick` | 昵称。为空时记为“访客”。 |
| `mail` | 私有邮箱，用于之后的回复通知。超过 254 个字符时不导入。 |
| `link` | 访客网址，只保留 `http`/`https` 地址；没有协议的地址（如 `example.com`）补成 `https://`。 |
| `created` / `updated` | 创建和更新时间。 |

不会导入：IP、User-Agent、头像、点赞、Twikoo 用户 ID，以及导出文件中的博主标记。

导入的评论直接公开，导入过程不发送任何通知。

**博主标记**按目标站点当时的博主昵称和邮箱回填：昵称完全一致、邮箱一致（不区分大小写）的评论会被标为博主评论。如果需要，请在导入前先在后台设置好博主身份。

## 1. 准备

1. 在后台[注册目标站点](./admin#sites)。需要回填博主标记时，博主昵称和邮箱两项都要设置。
2. 从 Twikoo 导出评论，得到一个 JSON 数组文件（上限 64 MiB）。
3. 按[备份与恢复](./backup#cold-backup)做一次冷备份。备份脚本最后会启动服务，下面会再次停止。

把导出文件复制到 `data/` 目录，让容器用户可以读取（把 `/path/to/twikoo.json` 换成实际路径，原文件保留不动）：

```bash
cd ~/Ecoku
sudo docker compose down
sudo install -o 10001 -g 10001 -m 600 /path/to/twikoo.json data/twikoo.json
```

## 2. 预检

把 `blog` 换成目标站点 ID，先加 `--dry-run` 运行：

```bash
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json --dry-run
```

预检会完整执行一遍导入再回滚，不保存评论。输出类似：

```text
Twikoo 导入预检通过：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
```

核对这些数字是否与 Twikoo 中的情况相符。“缺失父记录”不为 0 时，说明有些回复会变成根评论，不是被跳过。

JSON 格式错误、导出为空数组、ID 重复、正文超过 10000 个字符、昵称超过 80 个字符、页面 key 为空或超过 512 个字符、目标站点不存在或已有评论时，命令会报错退出，不做任何修改。

::: info
预检不保存评论，但命令启动时仍会打开数据库。如果数据库版本较旧，会先执行迁移，所以它不是完全只读的操作。
:::

## 3. 正式导入

确认预检结果和备份都没问题后，去掉 `--dry-run` 再运行一次。导入在一个事务中完成，任何一条出错都会整体回滚。成功后删除临时副本并启动服务：

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

打开几篇文章，确认历史评论和回复关系显示正常。原始导出文件和备份请按自己的习惯保存或删除。

## 页面 key 要对得上

导入时页面 key 取自 Twikoo 记录的 `url` 路径，例如 `/posts/hello-world/`。路径中的中文等非 ASCII 字符会保存为百分号编码形式，如 `/posts/%E4%BD%A0%E5%A5%BD/`。

接入评论区时，`data-page-key` 必须生成完全相同的字符串，历史评论才会出现在对应文章下。导入后可以在后台评论详情中查看每条评论的页面 key，与博客模板输出的值对比。如果两者不一致（例如结尾有没有 `/`、是否编码），请调整接入代码，不要改动已导入的数据。
