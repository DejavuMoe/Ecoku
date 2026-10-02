# 配置参考

`app/config.yaml` 的字段、默认值、可选值、用途和示例集中在下面的注释模板中。Docker 部署页引用同一份模板；无需在多个字段表之间查找。

## 完整配置模板 {#template}

新部署复制模板并替换 `instance_public_url`。已展开的项目使用默认值；旧版兼容项保持注释，只有保留旧部署行为时才需要启用。YAML 中每个顶层段只能出现一次，不能在文件末尾重复追加 `site:` 或 `admin:`。

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

默认日志写到标准输出，用 `docker compose logs` 查看，保留与轮转由 Docker 管理。模板中的 `site.log_path` 仅为旧版兼容项；新部署不需要日志目录挂载。

## 环境变量 {#env}

新部署不需要 `ecoku.env`。Compose 中的 `TZ: Asia/Shanghai` 决定评论与通知的显示时区，需要其他时区时直接修改该行；`TZ` 不是 YAML 配置字段。

模板中的 `*_env` 都是旧环境变量的名称，不是秘密值。新实例自动创建管理员、临时密码和持久密钥；旧实例须先完成导入与备份，再移除原变量。镜像已设置 `GIN_MODE=release` 和 `ECOKU_RUNTIME=container`，不要覆盖。

## 旧配置迁移 {#legacy}

模板保留了当前仍接受的兼容字段及其默认值。站点种子只在创建全新数据库时导入，不会覆盖已有站点；站点、SMTP、Telegram、人机验证与 Smoji 在后台修改。

升级和删除旧环境变量的操作步骤见 [旧实例配置迁移](../self-hosting/upgrade#legacy-config)。数据库和同目录的 `ecoku-secrets.json` 必须一起备份。
