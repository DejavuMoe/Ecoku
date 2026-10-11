# Ecoku

[![License: MIT](https://img.shields.io/github/license/DejavuMoe/Ecoku)](LICENSE)
[![Release](https://img.shields.io/github/v/release/DejavuMoe/Ecoku)](https://github.com/DejavuMoe/Ecoku/releases)
[![npm](https://img.shields.io/npm/v/ecoku)](https://www.npmjs.com/package/ecoku)
[![CI](https://img.shields.io/github/actions/workflow/status/DejavuMoe/Ecoku/ci.yml?branch=master&label=CI)](https://github.com/DejavuMoe/Ecoku/actions/workflows/ci.yml)

自托管、多站点、专注纯文字讨论的评论系统，为静态博客与个人网站设计。

[English](README.md) · 简体中文 · [繁體中文](README.zh-Hant.md)

**完整文档见 [ecoku.zsh.moe](https://ecoku.zsh.moe/)**，本文件只做概览，部署、接入、配置与 API 细节请前往文档站阅读。

## 特性

- 单个 Docker 容器即可运行；业务数据存储于 SQLite，密钥独立持久化
- 评论为纯文本，提交后直接发布，没有审核队列
- 访客无需注册；浏览器可加密记住身份 7 天，邮箱不通过公开接口返回
- 单实例可服务多个网站，各站点数据与配置互相隔离
- 可选邮件 / Telegram 通知，以及 Cloudflare Turnstile 或自托管 Cap 人机验证

## 快速开始

```bash
mkdir -p ~/Ecoku/app ~/Ecoku/data && cd ~/Ecoku
# 容器以 UID/GID 10001 运行，只有 data/ 可写
sudo chown -R 10001:10001 data && sudo chmod 750 data
# 准备 compose.yaml 与 app/config.yaml，参考仓库根目录的 compose.yaml 与 deploy/ 模板
sudo docker compose up -d
```

随后用反向代理为容器配置 HTTPS 域名，并在 `/admin/` 注册站点。完整步骤见文档站的 [Docker 部署](https://ecoku.zsh.moe/self-hosting/docker)。

站点就绪后，在文章模板中插入接入代码：

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/"
  data-page-title="你好，世界"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新加载评论</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

更多接入方式（JavaScript SDK、Hugo PaperMod 模板、自定义样式）见文档站的 [HTML 接入](https://ecoku.zsh.moe/integration/html)。

## 文档

- [指南](https://ecoku.zsh.moe/guide/introduction)：简介、功能、工作方式
- [部署](https://ecoku.zsh.moe/self-hosting/docker)：Docker 部署、反向代理、管理后台、通知、人机验证、备份与升级
- [接入](https://ecoku.zsh.moe/integration/html)：HTML、JavaScript SDK、Hugo PaperMod、自定义样式
- [参考](https://ecoku.zsh.moe/reference/configuration)：配置、命令行、REST API

文档站另有 [English](https://ecoku.zsh.moe/en/) 与 [繁體中文](https://ecoku.zsh.moe/zh-hant/) 版本。

## 项目状态

Ecoku 已进入维护阶段：后续更新以打磨细节、优化性能与安全性为主，不再计划大的功能变更。变更记录见 [CHANGELOG.md](CHANGELOG.md)。

如果需要从源码构建或在本地运行，见 [docs/contribute/local-dev.md](docs/contribute/local-dev.md)。

## 反馈与贡献

遇到问题或发现 Bug，欢迎提交 [Issues](https://github.com/DejavuMoe/Ecoku/issues)。

本项目暂不接受 Pull Request。若有功能建议或需求，欢迎在 Issues 中详细说明具体场景与行为预期，由维护者评估后安排实现。

## 许可证

[MIT](LICENSE)
