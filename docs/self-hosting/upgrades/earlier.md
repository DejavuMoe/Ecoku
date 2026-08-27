# 更早候选版本

以下 tag 可能仍出现在旧实例的 Compose 中。升级步骤一律见 [升级](../upgrade)。跨 schema 回滚必须恢复备份。

## v0.1.0-rc.10 / rc.9 / rc.8

Schema 至 rc.8 写入 **v3 + v4**（博主标志、`turnstile_settings`）。rc.9 修复 Turnstile `api.js` 与 `turnstile.ready()` 冲突。rc.10 为评论区文案与布局调整。

在 `ecoku.env` 增加 `TZ='<IANA>'` 后，用当前 Compose 的 `env_file` 重建容器即可，不必改 `config.yaml`。从 rc.7 升到 rc.8 必须备份；已写入 v3/v4 的库不能只换回 rc.7。

## v0.1.0-rc.7

接入改为 `data-ecoku-*`，外壳 id 为 `ecoku-comments` / `ecoku-mount`。加载器暂时仍识别旧 `#tcomment`。Schema 仍为 v2。

## v0.1.0-rc.6

日志始终写 stdout；`log_path` 指向文件时另留进程内副本。Schema 仍为 v2。

## v0.1.0-rc.5

Schema **v1 → v2**：站点增加博主昵称与邮箱。SDK 在 IndexedDB 加密保存身份 7 天。管理端不展示通知判定预览。

## v0.1.0-rc.3

宿主目录收敛为 `app/config.yaml`、`app/logs/`、`data/`。SQLite 启用 WAL。从 rc.2 升级需把 `config.yaml` 移到 `app/config.yaml`，旧 `data/ecoku.log` 移到 `app/logs/ecoku.log`。

## v0.1.0-rc.2 / rc.1

rc.2 起容器内置 `/client/ecoku-loader.js` 与 `hash-password`。rc.1 提供多站点纯文本评论、管理员、通知和 Twikoo 导入。
