---
layout: home
hero:
  name: Ecoku
  text: Self-hosted plain-text comments
  tagline: Deploy with Docker, store data in SQLite. One instance serves many sites. Comments go live on submit.
  image:
    src: /ecoku-hero.png
    alt: Ecoku illustration
  actions:
    - theme: brand
      text: Deploy with Docker
      link: /en/self-hosting/docker
    - theme: alt
      text: Features
      link: /en/guide/features
features:
  - title: Live on submit
    details: No moderation queue. Reply under the parent comment; nesting has no depth limit in data, visual indent stops at three levels.
  - title: Public APIs omit private fields
    details: No email, IP, or UA in public responses. Guest identity is encrypted in IndexedDB for 7 days.
  - title: One container
    details: Pin an image tag and keep data on the host. Admin UI and comment SDK share the same origin.
  - title: Email and Telegram
    details: Optional SMTP or Telegram alerts. Bloggers can prove identity with a passphrase.
---
