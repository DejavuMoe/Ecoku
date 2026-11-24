# Introduction

Ecoku is a self-hosted comment system for static sites built with Hugo, Hexo, Astro, VitePress and similar tools. You run one Docker container on your own server and add an HTML snippet to your post template, and your posts get a comment section.

Visitors don't need to sign up. They enter a name and email and post, and the comment appears right away. Replies open under the comment they answer. The bottom of every page on this site is an Ecoku comment section.

## What it's made of {#components}

<figure class="doc-diagram" tabindex="0" aria-label="System diagram, horizontally scrollable">
  <img class="diagram-light" src="/diagrams/components.en.light.svg" width="1185" height="304" loading="lazy" decoding="async" alt="Visitor and administrator browsers reach Ecoku through a reverse proxy. The service connects to SQLite and sends SMTP or Telegram notifications.">
  <img class="diagram-dark" src="/diagrams/components.en.dark.svg" width="1185" height="304" loading="lazy" decoding="async" alt="Visitor and administrator browsers reach Ecoku through a reverse proxy. The service connects to SQLite and sends SMTP or Telegram notifications.">
</figure>

| Part | Description |
| --- | --- |
| `ecoku-server` | The only program in the container. Serves the comment API, the admin console `/admin/` and the scripts your blog loads from `/client/`, and sends notifications in the background. |
| SQLite database | Holds all sites, comments and settings. `ecoku-secrets.json` next to it holds the keys; back up both together. |
| Reverse proxy | Your own Caddy or Nginx, which handles HTTPS. The container listens only on local `127.0.0.1:12123`. |
| Comment script | `ecoku-loader.js`, loaded by your blog pages. You can also use the npm package `ecoku`. |

No MySQL, Redis or other external service is needed.

## What it doesn't do

- It doesn't render Markdown or HTML, and doesn't accept image uploads. [Smoji stickers](../integration/smoji) are the only content shown as images.
- There are no visitor accounts, third-party sign-in or avatars.
- There are no likes and no moderation queue. Comments go public on submission; you delete them in the admin console afterwards.
- SQLite is the only supported database.

If you need any of these, Ecoku may not be right for you.

## Privacy

Ecoku doesn't store visitor IP addresses, User-Agents or locations. The email a visitor enters is used only for notifications and never appears in any public API. The comment section doesn't request third-party avatar, analytics or IP lookup services. See [Stored and public data](../reference/concepts#data).

## Where to start

<div class="cards">
<Card title="Quick start" link="/guide/quick-start" icon="rocket">Go from deployment to embedding in under twenty minutes.</Card>
<Card title="How it works" link="/reference/concepts" icon="book">How page keys, reply depth, deletion and identity work.</Card>
<Card title="HTML embed" link="/integration/html" icon="code">You already have an Ecoku server and just want comments on your blog.</Card>
<Card title="Migrate from Twikoo" link="/self-hosting/twikoo" icon="download">Import your Twikoo comment history into Ecoku.</Card>
</div>
