---
layout: home
hero:
  name: Ecoku
  text: Self-hosted comments for multiple sites
  tagline: Plain-text conversations for blogs and personal sites. No visitor accounts; comments appear on submission, and you keep the data.
  image:
    src: /logo.svg
    alt: Ecoku logo
  actions:
    - theme: brand
      text: Deploy
      link: /en/self-hosting/docker
    - theme: alt
      text: About Ecoku
      link: /en/guide/introduction
    - theme: alt
      text: Embed comments
      link: /en/integration/html

features:
  - title: Live on submit
    details: No moderation queue. Replies open inline, deletions leave a tombstone, and discussion context remains intact.
    link: /en/guide/concepts#threads
  - title: No visitor IP storage
    details: Stores only nickname, body, and optional email or website. Public APIs omit email; visitor IP and User-Agent are never logged. Browsers remember identity encrypted locally for 7 days.
    link: /en/guide/concepts#data
  - title: Self-contained container
    details: A single Go binary serves APIs, admin console, and embed assets. SQLite holds data while secrets persist independently. Back up just one directory to restore.
    link: /en/guide/introduction#components
  - title: Multi-site support
    details: One instance serves multiple sites, each with isolated origin allowlists, form fields, constraints, and blogger identities.
    link: /en/self-hosting/admin#sites
  - title: Notifications & verification
    details: Immediate notifications via email or Telegram; optional Cloudflare Turnstile or self-hosted Cap anti-spam protection.
    link: /en/self-hosting/notifications
  - title: Simple HTML embed
    details: Works with Hugo, Hexo, Astro, and single-page apps like Vue or React; fully themeable with CSS variables.
    link: /en/integration/html
---
