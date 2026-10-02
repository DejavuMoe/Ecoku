# 更早的候选版本

::: warning 内测版本，请勿使用
仅保留版本标签、变更和历史升级事项。公开部署从 v0.3.0 开始；旧镜像不再提供部署支持。请使用 [当前部署文档](../docker)。
:::

`v0.1.0-rc.1` · [v0.1.0-rc.2](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.2) · [v0.1.0-rc.3](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.3) · [v0.1.0-rc.5](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.5) · [v0.1.0-rc.6](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.6) · [v0.1.0-rc.7](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.7) · [v0.1.0-rc.8](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.8) · [v0.1.0-rc.9](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.9) · [v0.1.0-rc.10](https://github.com/DejavuMoe/Ecoku/tree/v0.1.0-rc.10)

## v0.1.0-rc.8 ～ rc.10

- rc.8 写入 schema v3 和 v4：评论的博主标志，以及 `turnstile_settings` 表。
- rc.9 修复 Turnstile `api.js` 与 `turnstile.ready()` 的冲突。
- rc.10 调整评论区文案与布局。

时区改为读取 `ecoku.env` 中的 `TZ='<IANA 时区>'`，加上后重建容器即可，不用修改 `config.yaml`。

从 rc.7 升级到 rc.8 前必须备份。已写入 v3/v4 的数据库不能直接换回 rc.7。

## v0.1.0-rc.7

接入代码改用 `data-ecoku-*` 属性，外壳 ID 改为 `ecoku-comments` / `ecoku-mount`。加载器暂时仍识别旧的 `#tcomment`。schema 仍为 v2。

## v0.1.0-rc.6

日志始终写到 stdout；`log_path` 指向文件时另外保存一份。schema 仍为 v2。

## v0.1.0-rc.5

schema v1 → v2：站点增加博主昵称和邮箱。SDK 在 IndexedDB 中加密保存访客身份 7 天。

## v0.1.0-rc.3

宿主机目录调整为 `app/config.yaml`、`app/logs/`、`data/`，SQLite 启用 WAL。从 rc.2 升级时，把 `config.yaml` 移到 `app/config.yaml`，旧的 `data/ecoku.log` 移到 `app/logs/ecoku.log`。

## v0.1.0-rc.1 / rc.2

- rc.1 提供多站点纯文本评论、管理后台、通知和 Twikoo 导入。
- rc.2 起，容器内置 `/client/ecoku-loader.js` 与 `hash-password` 命令。
