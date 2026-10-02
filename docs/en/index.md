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
    details: No moderation queue. Replies open under the comment they answer, and deletes leave a tombstone, so the discussion keeps its context.
    link: /en/guide/concepts#threads
  - title: No visitor IP storage
    details: Comments store names, text and supplied email or website details. Public APIs omit email; IP and User-Agent are not stored. Browsers can remember identity encrypted for 7 days.
    link: /en/guide/concepts#data
  - title: One container, self-hosted
    details: One Go program serves the API, admin console and embed assets. SQLite stores application data; keys persist separately. Back up the data directory and configuration.
    link: /en/guide/introduction#components
  - title: Multiple sites
    details: One instance serves several websites. Each site has its own allowed origins, comment settings, and blogger identity.
    link: /en/self-hosting/admin#sites
  - title: Notifications and CAPTCHA
    details: The blogger gets new comments by email or Telegram. Cloudflare Turnstile or self-hosted Cap can optionally block spam.
    link: /en/self-hosting/notifications
  - title: Embed with a snippet of HTML
    details: Works with Hugo, Hexo, Astro, and any other static site, as well as Vue and React single-page apps. Adjust the look with CSS variables.
    link: /en/integration/html
---
