# Introduction & Architecture

Ecoku is a **self-hosted, multi-site plain-text comment system** engineered for static blogs, documentation hubs, and independent websites.

It eliminates bloated moderation queues, user registration databases, and third-party tracking services. Delivered as a single container with SQLite3, comments become live immediately after basic security checks.

---

## Design Philosophy

- **Minimal Single Container**: A single Go binary simultaneously serves the REST API, the embedded admin panel (`/admin/`), and the client SDK assets (`/client/`). SQLite3 acts as the single-file transactional storage.
- **Pure Text Conversations**: Comment bodies are never parsed as arbitrary HTML or Markdown, preventing XSS attacks by design.
- **Live on Submit**: No artificial moderation delays. Safety is maintained via in-memory rate limiting, blogger passphrases, and modern CAPTCHA (Turnstile / Cap).
- **Zero Privacy Leakage**: Public APIs never return email addresses, IP addresses, User-Agents, or internal database IDs. Visitor identity is stored strictly on the client side in IndexedDB with AES-GCM encryption for 7 days.
- **In-Place Schema Evolution**: Versioned SQLite schema migrations (v1–v8) upgrade sequentially in a single transaction without external migration binaries.

---

## Architecture Overview

```mermaid
flowchart TD
    subgraph Client["🌐 Client Layer (Browser / Web)"]
        direction LR
        Visitor["📱 Visitor Integration<br/>• 2KB Standalone Loader (ecoku-loader.js)<br/>• Native SDK (ESM / UMD / CJS)<br/>• 7-Day Encrypted Storage (IndexedDB)<br/>• Smoji Plain-Text Stickers on Demand"]
        Admin["💻 Admin Console (/admin/)<br/>• Vue 3 + Pinia + System Serif<br/>• HttpOnly cookie + SQLite revocable session<br/>• Multi-site & CAPTCHA Security Settings<br/>• Comment Tombstones & Hard Purge"]
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
        Storage["💾 SQLite3 Storage Engine (WAL Mode)<br/>• /data/ecoku.sqlite3 (Strict Foreign Keys · In-Place Migrations v1~v8)<br/>• AES-256-GCM Sensitive Field Encryption (SMTP / Bot / Captcha Secrets)"]
        Core --> Storage
    end

    Visitor -->|HTTPS REST| Proxy
    Admin -->|HTTPS REST| Proxy
    Proxy -->|127.0.0.1:12123| Engine
    Engine -.->|Enqueue Tasks| Outbox
```

---

## Scope & Boundaries

### What Ecoku Is Ideal For

- **Multi-Site Unified Hosting**: A single Ecoku instance can simultaneously provide isolated comment services for multiple independent domains, subdomains, and blogs.
- **Static Blogs & Documentation**: Seamlessly integrates with modern static site generators such as Hugo, Hexo, Astro, VitePress, Next.js, and SvelteKit.
- **Privacy-Conscious Creators**: Complete ownership of your discussion data in a local SQLite file, with zero external tracking or closed-source cloud dependencies.
- **Flexible Anti-Bot Verification**: Freely toggle between in-memory IP rate limiting, Cloudflare Turnstile, and fully self-hosted open-source Cap.

### What Ecoku Deliberately Omits

To maintain absolute simplicity, security, and performance, Ecoku explicitly excludes the following:

- ❌ **Rich Text & Raw HTML Rendering**: Comments are permanently treated as pure text to eliminate XSS injection risks (except strict same-origin Smoji stickers).
- ❌ **User Registration & Accounts**: Visitors do not register or maintain passwords; they post using a nickname, private email, and optional website.
- ❌ **Likes, Reactions, & Avatars**: No network calls to Gravatar, external IP databases, analytics, or telemetry services.
- ❌ **Pre-Publish Moderation Queues**: Valid comments publish immediately upon passing rate limits and CAPTCHA.
- ❌ **MySQL / PostgreSQL Complexity**: Exclusively built around SQLite3 with WAL mode for zero-ops, single-file resilience.

---

## Deployment Overview

Ecoku runs in Docker as an unprivileged user (`10001:10001`), listening internally on `127.0.0.1:12123`:

1. **Prepare Environment**: Configure `compose.yaml`, `app/config.yaml`, and `ecoku.env`.
2. **Reverse Proxy**: Terminate HTTPS and forward traffic via Caddy or Nginx.
3. **Admin Console**: Access `/admin/` to register sites, configure blogger passphrases, and set up notifications.
4. **Site Integration**: Embed the ~2KB `ecoku-loader.js` snippet into your blog template.

For complete step-by-step instructions, see [Docker Deployment](/en/self-hosting/docker).
