---
layout: home
hero:
  name: Ecoku
  text: Self-hosted Plain-text Comments
  tagline: Tailored for static blogs and personal sites. Minimal single container, SQLite persistence, live on submit.
  image:
    src: /ecoku-hero.png
    alt: Ecoku Diagram
  actions:
    - theme: brand
      text: Docker Deployment
      link: /en/self-hosting/docker
    - theme: alt
      text: Core Concepts
      link: /en/guide/concepts
    - theme: alt
      text: Client Integration
      link: /en/integration/html

features:
  - title: Live on Submit · Unbroken Threads
    details: Zero moderation queues. Infinite semantic nesting with up to 3 visual indent levels and tombstone soft-deletion.
    link: /en/guide/concepts#threaded-comment-and-pagination-model
  - title: Strict Privacy Boundary
    details: Zero sensitive fields in public APIs. Visitor identity encrypted with AES-GCM in browser IndexedDB with 7-day TTL.
    link: /en/guide/concepts#encrypted-visitor-identity-storage
  - title: Single Container Topology
    details: Go monolithic binary serving API, embedded admin (/admin/), and SDK (/client/); SQLite WAL in-place migrations.
    link: /en/guide/introduction#architecture-overview
  - title: Modern Bot Protection
    details: "Tri-state instance protection: Off, Cloudflare Turnstile, and self-hosted Cap with dynamically converged CSP."
    link: /en/self-hosting/admin#bot-protection-captcha
  - title: Transactional Outbox Notifications
    details: Outbox pattern driving SMTP (TLS/STARTTLS) and Telegram notifications with per-target retries and blogger passphrases.
    link: /en/guide/concepts#transactional-outbox-notifications
  - title: Lightweight & Versatile Integration
    details: 2KB standalone loader, seamless Hugo PaperMod support, full CSS Design Tokens, and Smoji plain-text sticker protocol.
    link: /en/integration/html
---
