---
layout: home
hero:
  name: Ecoku
  text: Self-hosted plain-text comments
  tagline: Multi-site, SQLite, Docker Compose. Comments go live on submit. Public APIs never expose emails or visitor traces.
  image:
    src: /ecoku-hero.png
    alt: Ecoku illustration connecting comment threads to self-hosted data
  actions:
    - theme: brand
      text: Deploy with Docker
      link: /en/self-hosting/docker
    - theme: alt
      text: Features
      link: /en/guide/features
features:
  - title: Live on submit
    details: No moderation queue. Replies happen on the parent comment. Threads are unbounded; visual indent stops at three levels.
  - title: Private by default
    details: Public DTOs omit email, IP, UA, and admin fields. Guest identity is encrypted in IndexedDB for 7 days only.
  - title: One container
    details: Pinned image tags, in-place SQLite migrations, TLS at a local reverse proxy. Admin UI and comment SDK are served from the same origin.
  - title: Deduped notifications
    details: SMTP (TLS/STARTTLS) and Telegram. Bloggers prove identity with a passphrase. Delivery follows a fixed matrix; the admin UI does not show a decision table.
---
