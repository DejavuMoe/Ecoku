# 配置参考

`app/config.yaml` 的字段、默认值、可选值、用途和示例集中在下面的注释模板中。Docker 部署页引用同一份模板；无需在多个字段表之间查找。

## 完整配置模板 {#template}

复制模板并替换 `instance_public_url`。未注释的其他值使用默认值；注释中的赋值可按需启用。YAML 中每个顶层段只能出现一次，不能重复追加 `site:` 或 `admin:`。后台始终启用；会话时长是固定约束，不是自由调节项。

<div class="config-template">

<<< ../../deploy/config.yaml.example{yaml}

</div>

## 修改后生效 {#reload}

保存文件后，在 Compose 所在目录重建容器并查看日志。单纯修改挂载的 YAML 不会热更新服务：

```bash
sudo docker compose up -d --force-recreate ecoku
sudo docker compose logs --tail=100 ecoku
```

配置文件只能有一个 YAML 文档。未知字段、无效值或重复字段会阻止启动；按日志提示修正后重新启动。

## 限流行为 {#rate-limit}

`rate_limit` 的每一项默认值、单位与示例均在模板中。按 IP 分别计数，超限返回 `429` 和 `Retry-After`；进程重启后计数清零。填写 `0` 是恢复默认值，不是关闭限流。反向代理场景同时配置 `site.trusted_proxies`，避免所有访客共用代理地址的额度。

## 日志 {#logs}

默认日志写到标准输出，用 `docker compose logs` 查看，保留与轮转由 Docker 管理。`site.log_path` 是可选的文件日志路径；设置实际路径时同时写标准输出和文件，并需挂载容器可写的目录。具体值见模板。

## 环境变量 {#env}

新部署不需要 `ecoku.env`。Compose 中的 `TZ: Asia/Shanghai` 决定评论与通知的显示时区，需要其他时区时直接修改该行；`TZ` 不是 YAML 配置字段。

模板中的 `*_env` 是程序读取的环境变量名称，不是秘密值；需要自行注入时，在 Compose 的 `environment` 或 `env_file` 中提供对应变量。默认自动创建管理员和持久密钥，无需注入这些凭据。镜像已设置 `GIN_MODE=release` 和 `ECOKU_RUNTIME=container`，不要覆盖。

## 初始化与持久数据 {#legacy}

站点种子 `sites` 只在创建全新数据库时导入，不会覆盖已有站点；站点后续编辑、SMTP、Telegram、人机验证与 Smoji 在后台完成。数据库和同目录的 `ecoku-secrets.json` 必须一起备份。修改数据库路径不会自动搬迁数据。
