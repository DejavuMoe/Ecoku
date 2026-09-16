# Features Overview

Ecoku pairs minimalist single-container operations with modern user experience, resilient security, and customizable design tokens.

---

## Comment Experience
- **Live on Submit**: Direct publishing without moderation queues.
- **16 Reply Levels & Max 3-Level Visual Indent**: Supports deep discussion hierarchies while capping indentation at 3 levels to maintain readability on mobile viewports. Replies at depth $\ge 3$ automatically display clickable `@Author` anchors.
- **Root-Thread Pagination**: Returns complete root threads within fixed resource budgets; oversized requests fail explicitly. Large threads can be read on demand through the [single-level cursor API](../reference/api.md).
- **Jitter-Free 3ch Collapse**: Toggle controls `[+]` and `[-]` are fixed at `3ch` tabular width, preventing meta-row layout shifts upon collapsing/expanding.
- **Context-Preserving Tombstones**: Deleting a comment replaces its content with `[该评论已删除]`, preserving the downstream conversation tree.
- **Smoji Plaintext Stickers**: Site-level customizable sticker packs using `![smoji:label](https://...)` markdown tokens, loaded on demand under strict same-origin rules.

---

## Identity & Privacy
- **Configurable Field Requirements**: Nickname is always required; email and website requirements are configurable per site.
- **Client-Side AES-GCM Encryption**: Visitor identities are encrypted via WebCrypto AES-GCM and stored in IndexedDB for 7 days. Never written to `localStorage` or cookies.
- **Blogger Passphrase**: Site owners authenticate by typing a secret passphrase directly in the nickname field.
- **Zero Privacy Leakage**: Public DTOs omit emails, IPs, User-Agents, and geo-locations.

---

## Security & Operations
- **Tri-State Bot Protection**: Toggle between `off`, Cloudflare Turnstile, and self-hosted Cap.
- **Encrypted Database Credentials**: SMTP passwords, Telegram tokens, and CAPTCHA secrets are encrypted with AES-256-GCM using an instance master key.
- **Dynamic CSP Convergence**: Automatically tightens Content-Security-Policy based on the active CAPTCHA provider.
- **In-Memory Rate Limiter**: Windowed rate limiting on Socket peer IP and trusted proxy gateways.
- **Outbox Notifications**: Transactionally enqueues SMTP and Telegram notifications with isolated per-target retries.
- **Twikoo CLI Importer**: One-shot migration tool for importing legacy Twikoo discussions.
