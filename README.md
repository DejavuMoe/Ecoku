# Ecoku

[![License: MIT](https://img.shields.io/github/license/DejavuMoe/Ecoku)](LICENSE)
[![Release](https://img.shields.io/github/v/release/DejavuMoe/Ecoku)](https://github.com/DejavuMoe/Ecoku/releases)
[![npm](https://img.shields.io/npm/v/ecoku)](https://www.npmjs.com/package/ecoku)
[![CI](https://img.shields.io/github/actions/workflow/status/DejavuMoe/Ecoku/ci.yml?branch=master&label=CI)](https://github.com/DejavuMoe/Ecoku/actions/workflows/ci.yml)

A self-hosted, multi-site comment system for static blogs and personal websites, built around plain-text discussion.

English · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-Hant.md)

**Full documentation lives at [ecoku.zsh.moe](https://ecoku.zsh.moe/en/).** This file is a short overview; for deployment, integration, configuration, and API details, head to the docs site.

## Features

- Runs as a single Docker container; application data is stored in SQLite, with secrets persisted separately
- Comments are plain text and go live immediately — there is no moderation queue
- No visitor accounts; the browser can remember an identity for 7 days, encrypted, and email addresses are never exposed through any public API
- One instance can serve multiple sites, each with fully isolated data and settings
- Optional email / Telegram notifications, plus Cloudflare Turnstile or self-hosted Cap CAPTCHA

## Quick start

```bash
mkdir -p ~/Ecoku/app ~/Ecoku/data && cd ~/Ecoku
# The container runs as UID/GID 10001, and only data/ is writable
sudo chown -R 10001:10001 data && sudo chmod 750 data
# Prepare compose.yaml and app/config.yaml; see the compose.yaml and deploy/ templates in this repo
sudo docker compose up -d
```

Next, put the container behind a reverse proxy with HTTPS, then register your site at `/admin/`. Full steps: [Docker deployment](https://ecoku.zsh.moe/en/self-hosting/docker).

Once your site is registered, embed the comment section in your post template:

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/"
  data-page-title="Hello, world"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>Reload comments</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

For other integration paths — the JavaScript SDK, a Hugo PaperMod template, and custom styling — see [HTML Embed](https://ecoku.zsh.moe/en/integration/html).

## Documentation

- [Guide](https://ecoku.zsh.moe/en/guide/introduction): introduction, features, how it works
- [Self-hosting](https://ecoku.zsh.moe/en/self-hosting/docker): Docker deployment, reverse proxy, admin console, notifications, CAPTCHA, backup & restore, upgrading
- [Integration](https://ecoku.zsh.moe/en/integration/html): HTML, JavaScript SDK, Hugo PaperMod, custom styles
- [Reference](https://ecoku.zsh.moe/en/reference/configuration): configuration, command line, REST API

The docs site is also available in [简体中文](https://ecoku.zsh.moe/) and [繁體中文](https://ecoku.zsh.moe/zh-hant/).

## Project status

Ecoku is in maintenance mode: future releases focus on polish, performance, and security rather than new features. See [CHANGELOG.md](CHANGELOG.md) for release notes.

To build from source or run it locally, see [docs/contribute/local-dev.md](docs/contribute/local-dev.md).

## Feedback & contributions

Found a bug, or have a question? Please [open an issue](https://github.com/DejavuMoe/Ecoku/issues).

This project does not accept pull requests. If you have a feature request, write it up as a prompt in an issue — we'll evaluate it and implement it ourselves.

## License

[MIT](LICENSE)
