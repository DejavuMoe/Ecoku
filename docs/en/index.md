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
    details: Stores only the nickname, body, and the email or website a visitor enters. Public APIs omit email; visitor IP and User-Agent are never logged. Browsers remember identity encrypted locally for 7 days.
    link: /en/guide/concepts#data
  - title: Self-contained container
    details: A single Go binary serves APIs, admin console, and embed assets. SQLite holds data while secrets persist independently. Back up the data directory, the configuration and Compose to restore.
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

<div class="home-showcase">

## Who Is Using Ecoku? {#who-is-using}

<p class="home-showcase-lead">Ecoku provides lightweight, self-hosted discussions for personal blogs, open source documentation, and data platforms. Here are some of the sites using Ecoku:</p>

<div class="showcase-grid">

<a class="showcase-card" href="https://blog.dejavu.moe/" target="_blank" rel="noopener noreferrer">
  <div class="showcase-card-header">
    <span class="showcase-title">Dejavu's Blog</span>
    <span class="showcase-tag">Personal Blog</span>
  </div>
  <p class="showcase-desc">The author's personal blog covering system architecture, self-hosting practices, and essays. Built with Hugo, using Ecoku for article comments and reader interactions.</p>
  <span class="showcase-url">blog.dejavu.moe ↗</span>
</a>

<a class="showcase-card" href="https://ecoku.zsh.moe/" target="_blank" rel="noopener noreferrer">
  <div class="showcase-card-header">
    <span class="showcase-title">Ecoku Documentation</span>
    <span class="showcase-tag">Open Source Docs</span>
  </div>
  <p class="showcase-desc">The official documentation for Ecoku, built with VitePress. Embeds Ecoku comments at the bottom of each doc page as a live demonstration of self-hosting and client integration.</p>
  <span class="showcase-url">ecoku.zsh.moe ↗</span>
</a>

<a class="showcase-card" href="https://sani.zsh.moe/" target="_blank" rel="noopener noreferrer">
  <div class="showcase-card-header">
    <span class="showcase-title">Sani Documentation</span>
    <span class="showcase-tag">Open Source Docs</span>
  </div>
  <p class="showcase-desc">Documentation site for Sani, a self-hosted short link, pastebin, and file sharing tool. Embeds Ecoku across guides and help pages for community discussion and questions.</p>
  <span class="showcase-url">sani.zsh.moe ↗</span>
</a>

<a class="showcase-card" href="https://vps.gripe" target="_blank" rel="noopener noreferrer">
  <div class="showcase-card-header">
    <span class="showcase-title">vps.gripe</span>
    <span class="showcase-tag">Benchmark Reports</span>
  </div>
  <p class="showcase-desc">VPS benchmark reporting platform featuring raw script outputs and parsed summaries. Embeds Ecoku on benchmark detail pages for user discussions on server performance.</p>
  <span class="showcase-url">vps.gripe ↗</span>
</a>

</div>

</div>
