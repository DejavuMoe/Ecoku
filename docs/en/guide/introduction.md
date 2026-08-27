# Introduction

Ecoku is a self-hosted multi-site plain-text comment system. One instance can serve many sites. Comments go live as soon as they are submitted.

It fits static blogs, documentation sites, and personal sites that want comment data on their own servers. Production uses Docker Compose and SQLite3.

Only Docker images are published. Source code is not publicly distributed.

## What it is for

- Provide comment sections for multiple sites.
- Let visitors post comments and replies with a nickname, email, and optional website.
- Optional email or Telegram notifications; one-time import of historical comments from Twikoo.
- Bot protection with Turnstile or self-hosted Cap.

## What it does not provide

Comment bodies are plain text; HTML and Markdown are not parsed. There are no avatars, votes, rich text, end-user accounts, per-site moderation queues, or MySQL.

Never put admin credentials or a site management key in the browser, URL, or page markup.

## How it runs

One non-root container serves the API, the admin UI at `/admin/`, and the comment frontend at `/client/`. By default it binds only to host `127.0.0.1:12123`; public access goes through an HTTPS reverse proxy.

Sites, forms, and notifications are configured in the admin UI and stored in SQLite. For first deploy see [Docker](/en/self-hosting/docker); for page integration see [Plain HTML](/en/integration/html).
