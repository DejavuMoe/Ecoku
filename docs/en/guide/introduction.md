# Introduction & Architecture

Ecoku is a **self-hosted, multi-site plain-text comment system** engineered for static blogs, documentation hubs, and independent websites.

It eliminates bloated moderation queues, user registration databases, and third-party tracking services. Delivered as a single container with SQLite3, comments become live immediately after basic security checks.

---

## Design Philosophy

- **Minimal Single Container**: A single Go binary simultaneously serves the REST API, the embedded admin panel (`/admin/`), and the client SDK assets (`/client/`). SQLite3 acts as the single-file transactional storage.
- **Pure Text Conversations**: Comment bodies are never parsed as arbitrary HTML or Markdown, preventing XSS attacks by design.
- **Live on Submit**: No artificial moderation delays. Safety is maintained via in-memory rate limiting, blogger passphrases, and modern CAPTCHA (Turnstile / Cap).
- **Zero Privacy Leakage**: Public APIs never return email addresses, IP addresses, User-Agents, or internal database IDs. Visitor identity is stored strictly on the client side in IndexedDB with AES-GCM encryption for 7 days.
- **In-Place Schema Evolution**: Versioned SQLite schema migrations (v1–v7) upgrade sequentially in a single transaction without external migration binaries.

---

## Architecture Overview

```mermaid
flowchart TD
    subgraph Client["🌐 Client Layer (Browser / Web)"]
        direction LR
        Visitor["📱 Visitor Integration<br/>• 2KB Standalone Loader (ecoku-loader.js)<br/>• Native SDK (ESM / UMD / CJS)<br/>• 7-Day Encrypted Storage (IndexedDB)<br/>• Smoji Plain-Text Stickers on Demand"]
        Admin["💻 Admin Console (/admin/)<br/>• Vue 3 + Pinia + System Serif<br/>• Memory-only Bearer Token (No Storage)<br/>• Multi-site & CAPTCHA Security Settings<br/>• Comment Tombstones & Hard Purge"]
    end

    subgraph Edge["🛡️ Edge & Reverse Proxy"]
        Proxy["Caddy / Nginx / CDN<br/>• Automatic TLS / SSL Termination<br/>• Trusted Client IP Forwarding & Anti-Spoofing<br/>• Forward to Local 127.0.0.1:12123"]
    end

    subgraph Runtime["📦 Ecoku Single Container (10001:10001)"]
        direction TB
        subgraph Core["Go 1.24 HTTP Core Engine"]
            direction LR
            Engine["⚡ Gin HTTP Core Service<br/>• In-Memory IP Rate Limiter<br/>• Dynamic CSP Policies (Turnstile / Cap)<br/>• Remote Captcha Siteverify<br/>• Admin Bcrypt Auth & Credential Versioning"]
            Outbox["📬 Outbox Notification Worker<br/>• Single-instance Polling & Exponential Backoff<br/>• SMTP Email Notifications (TLS / STARTTLS)<br/>• Telegram Bot Message Push<br/>• Blogger Passphrase Zero-Auth Match"]
        end
        Storage["💾 SQLite3 Storage Engine (WAL Mode)<br/>• /data/ecoku.sqlite3 (Strict Foreign Keys · In-Place Migrations v1~v7)<br/>• AES-256-GCM Sensitive Field Encryption (SMTP / Bot / Captcha Secrets)"]
        Core --> Storage
    end

    Visitor -->|HTTPS REST| Proxy
    Admin -->|HTTPS REST| Proxy
    Proxy -->|127.0.0.1:12123| Engine
    Engine -.->|Enqueue Tasks| Outbox
```

---

## Scope & Boundaries

### What Ecoku Is
- Multi-site hosting from a single deployment instance.
- Direct posting with instant availability.
- Privacy-first storage with zero client-side tracking.
- Resilient notifications via SMTP (TLS/STARTTLS) and Telegram.

### What Ecoku Is Not
- ❌ **No Rich Text / Markdown Parsing**: Bodies remain pure text (except structured Smoji stickers).
- ❌ **No User Registration**: Visitors post with a nickname, private email, and optional website.
- ❌ **No Avatars, Likes, or Reactions**: No calls to Gravatar, external IP databases, or analytics scripts.
- ❌ **No MySQL / Postgres Requirement**: Built exclusively on SQLite3 with WAL mode.
