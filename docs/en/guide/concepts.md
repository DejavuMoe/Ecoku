# How it works

This page explains how Ecoku organizes comments, how it handles deletion and identity, and what data it stores. Read it before you deploy and embed Ecoku to avoid most surprises.

## Sites and pages {#page-key}

Ecoku uses two values to identify "the comment section of one post":

- **Site ID** (`siteId`): set when you register a site in the admin console. One instance can have multiple sites, and their comments, allowed origins, and settings are completely separate.
- **Page key** (`pageKey`): provided by the embed code. It is usually the post's path on the site, such as `/posts/hello-world/`.

Within one site, pages with the same page key share one comment section. A page key must be a relative path on the site, at most 512 characters long. It cannot be a full URL, and it cannot contain a `?` query string or a `#` fragment. A key that breaks these rules still displays the comment section, but posting comments is rejected.

::: warning Do not change a page key once it is in use
Comments are stored by page key. If you later change your blog's permalink format, the page keys of old posts change with it, and their existing comments no longer appear (the data is still in the database). Pick a value that will not change as the page key.
:::

## Threads and pagination {#threads}

Comments form a tree: a root comment can have replies, and replies can have replies of their own.

- **Depth**: a root comment is at depth 0, and new replies can go down to depth 16. A reply to a comment at depth 16 is rejected, with a message asking the visitor to reply to a comment higher up.
- **Indentation**: indentation grows with depth up to depth 3. Deeper replies line up with depth 3. From depth 3 on, the nickname line shows a clickable `@replied-to-name` that points to the comment being replied to. This keeps deep discussions from being squeezed into a narrow strip on phones.
- **Collapsing**: a comment with replies has a `[-]` next to it. Click it to collapse the whole branch, which then shows "N replies collapsed" (已折叠 N 条回复).

Pagination applies only to root comments. Each page shows a number of root comments (10 by default) and returns them **together with all of their replies**. Turning a page swaps in a whole batch of discussions, so replies are never split onto the next page.

To keep a single huge discussion from overwhelming the service, one list request has limits: at most 200 comments, 16 levels, and a 1 MiB response. When counting totals, at most 10,000 comments on the same page are checked. If any limit is exceeded, the server returns an error instead of truncated data, and the comment section shows that loading failed. Normal blog comments rarely reach these limits. If you do hit them, lower the number of root comments per page, or use the [level-by-level API](../reference/api#cursor) in a custom frontend.

## Deletion {#deletion}

The admin console offers two kinds of delete. Neither can be undone.

**Tombstone delete**: clears the comment's nickname, email address, website, and body, but keeps its position and time in the discussion. On public pages it shows as "Deleted" (已删除) and "[This comment has been deleted]" ([该评论已删除]). Its replies stay as they are, and nobody can reply to it anymore. Deleting one comment this way does not strip the rest of the thread of its context.

**Permanent delete**: removes a tombstone from the database. Only a tombstone with **no replies at all** can be permanently deleted.

## Visitor identity {#visitor-identity}

Visitors do not need to register to comment. They fill in three fields:

| Field | Required | Public |
| --- | --- | --- |
| Nickname | Required, at most 80 characters | Public |
| Email | Required by default; a site setting can make it optional | Not public; used only for reply notifications |
| Website | Optional by default; can be made required; only `http://` or `https://` is accepted | Public, as a link on the nickname |

The identity a visitor enters in the root comment box is reused automatically for replies. When a visitor clicks "Reply" (回复) under a comment directly, any missing identity fields are filled in inside that reply box, without jumping back to the top of the page.

After a successful post, the browser remembers this identity for 7 days so the visitor does not have to enter it again:

- It is stored in the browser's IndexedDB, encrypted with a non-extractable AES-GCM key. It is not written to cookies, localStorage, or the URL.
- It is stored separately per Ecoku server address and site ID, and is not shared between sites.
- It expires after 7 days. If the browser does not support it, or the data is corrupted or expired, the comment box starts out empty. Commenting still works.
- Clearing the browser's site data deletes it. The comment section has no separate "Forget me" (忘记我) button.

## Blogger identity {#blogger}

The blogger does not need a separate account. After you set the blogger nickname, email address, and passphrase for a site in the admin console, the blogger posts by entering the passphrase in the **nickname field** of the comment section and leaving the email and website fields empty. When the server recognizes the passphrase, it:

- Replaces the comment's nickname with the blogger nickname, the website with the site URL, and the email address with the blogger email;
- Marks the comment as a blogger comment, and the page shows a badge after the nickname (`[博主]` by default);
- The browser clears the nickname field and does not save the passphrase as the identity.

The blogger mark is written when the comment is saved and is never recalculated. Changing the blogger nickname or the passphrase does not change the mark on existing comments.

Only two cases backfill the blogger mark on existing comments by matching "nickname equals the blogger nickname and email equals the blogger email (case-insensitive)": the one-time migration when upgrading from an older release to schema v5, and the [first Twikoo import](../self-hosting/twikoo).

## Plain text

Comment bodies and nicknames are always displayed as plain text:

- HTML tags are displayed literally as text and are not parsed;
- Markdown is not rendered, and URLs are not turned into links automatically;
- Line breaks are preserved.

The only exception is [Smoji stickers](../integration/smoji). When a site has a sticker pack enabled, `![smoji:name](image-url)` that has the right format and the same origin as the sticker manifest is displayed as an image. Everything else is displayed as text.

A visitor's website appears only as a link on their nickname, with `rel="nofollow ugc noopener noreferrer"`.

## Data stored and made public {#data}

For each comment, the database stores: site ID, page key, post title, parent comment, nickname, email address, website, body, blogger mark, deletion time, and creation and update times.

Public APIs return only: comment ID, site ID, page key, parent comment ID, nickname, website, body, whether it is a blogger comment, whether it is deleted, and the times. **Email addresses never appear in any public API.**

Ecoku does not store visitor IP addresses, User-Agents, or geolocation, and does not record them in logs. IP addresses are held briefly in memory for rate limiting only and are cleared when the process restarts. The comment section does not call any third-party avatar, analytics, or IP lookup service.

The visitor's browser connects directly to a third party in these cases:

- When Turnstile or Cap is enabled, to load the verification widget;
- When Smoji is enabled, to load sticker images from the server that hosts the manifest.

## Origin checks and rate limits

Each site registers its "allowed origins" in the admin console. When a browser reads comments, origins that are not on the list are rejected. When a browser submits a comment, the request must carry a registered origin, or it is rejected outright. As a result, the comment section works only on websites you have registered.

Submitting, reading, deleting, and admin sign-in are all rate limited per IP. The defaults are 5 submissions and 60 reads per minute. Behind a reverse proxy, you need to configure [`trusted_proxies`](../self-hosting/reverse-proxy#trusted-proxies) correctly. Otherwise all visitors share a single quota.

## Time and time zone

Comment times are displayed in `YYYY-MM-DD HH:mm` format. The time zone comes from the container's `TZ` environment variable (set in `ecoku.env`). Hovering over a time shows the time zone name and offset, such as `Asia/Shanghai UTC+8`.
