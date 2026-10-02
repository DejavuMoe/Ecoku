---
layout: home
hero:
  name: Ecoku
  text: Self-hosted<br>plain-text comments
  tagline: For static blogs and personal websites. One Docker container, one SQLite file, and comments go live on submit.
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
  - title: No visitor tracking
    details: IP addresses and User-Agents are not stored, and public APIs never return email addresses. Visitor identity is kept encrypted in the browser for 7 days.
    link: /en/guide/concepts#data
  - title: One container, one file
    details: A single Go program serves the API, the admin console, and the embed script. All data lives in one SQLite file.
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
