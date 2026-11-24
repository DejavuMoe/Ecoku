# How it works

This page explains Ecoku's core rules: how comments are tied to posts, how replies are organized, how visitor identity is stored, and which data is public. Most "why" questions you run into while deploying and embedding are answered here.

## Sites and page keys {#page-key}

Each comment belongs to a page within a site, identified by two values:

| Value | Comes from | Example |
| --- | --- | --- |
| Site ID `siteId` | Set when you register the website in the admin console | `blog` |
| Page key `pageKey` | Passed in by the embed code, usually the post path | `/posts/hello-world/` |

Pages with the same page key in the same site share one comment section. The page key is a path on the site, at most 512 characters. Don't write a full URL or include `?` or `#`; otherwise the comment section displays, but comment submissions are rejected.

::: warning Don't change a page key once it's set
Comments are stored by page key. If you change your blog's permalink format, the page keys generated for old posts change too, and their comments no longer show (the data is still there). Change the embed code back to the original way of generating keys, and the comments come back.
:::

## Threads and pagination {#threads}

Comments form a tree: root comments have replies, and replies can have replies.

- A root comment is level 0, and replies go up to level 16. Comments at level 16 have no **Reply** button.
- Indentation stops at level 3. From level 3 on, `@name` of the person replied to appears after the name and points to the comment being answered.
- A comment with replies has `[-]` beside it; click it to collapse the whole branch.

Pagination counts only root comments: each page shows a number of root comments (10 by default) together with all of their replies.

A single read has limits: 200 comments, 16 levels and a 1 MiB response; counting checks at most 10,000 comments per page. When a limit is exceeded, the comment section shows a loading failure instead of showing only part of the comments. Typical blogs never hit these limits. If you do, reduce the number of root comments per page, or use the [level-by-level read API](./api#cursor) in a custom front end.

## Deletion {#deletion}

| | Tombstone delete | Delete permanently |
| --- | --- | --- |
| Result | Clears the name, email, website and body, keeping the position | Removes it from the database |
| Condition | Any comment | Only tombstones with no replies at all |
| Replies below | Still shown | — |

Neither can be undone. For how to do it, see [Managing comments](../admin/comments).

## Visitor identity {#visitor-identity}

| Field | Required | Public |
| --- | --- | --- |
| Name | Required, at most 80 characters | Public |
| Email | Required by default; can be made optional | Not public; used only for notifications |
| Website | Optional by default; only `http(s)://` accepted | Public, shown as a link on the name |

When a visitor clicks **Reply** on a comment, any missing identity details are filled in right in that reply box, without jumping back to the comment box at the top.

After a successful post, the browser remembers this identity locally for 7 days:

- It is saved in IndexedDB, encrypted with a non-exportable AES-GCM key, and never written to cookies, localStorage or the URL;
- It is stored separately per Ecoku server URL and site ID;
- When it expires or is unavailable, the comment box starts blank, and posting still works;
- Clearing the browser's site data clears it.

## Blogger identity {#blogger}

The blogger posts by entering a passphrase in the name field. When the server recognizes the passphrase, it saves the comment with the blogger details set for the site and writes the blogger mark. The mark is fixed when the comment is saved and never recalculated. For setup, see [Blogger identity](../admin/blogger).

## Plain text

Comment bodies and names are always shown as plain text: HTML is shown as literal text, Markdown isn't rendered, URLs don't become links automatically, and line breaks are kept.

The only exception is [Smoji stickers](../integration/smoji): once enabled for a site, `![smoji:name](image URL)` markers that satisfy the format and image origin rules are shown as images.

The visitor website appears only as the link on the name, with `rel="nofollow ugc noopener noreferrer"`.

## Stored and public data {#data}

| | Contents |
| --- | --- |
| Stored in the database | Site ID, page key, post title, parent comment, name, email, website, body, blogger mark, deletion time, creation and update times |
| Returned by public APIs | Comment ID, site ID, page key, parent comment ID, name, website, body, whether it's a blogger comment, whether it's deleted, times |
| Not stored | Visitor IP, User-Agent, location |

Email never appears in any public API. The connection IP is used briefly in memory for rate limiting only, cleared on restart, and never logged.

Visitors' browsers connect to third parties directly in only two cases: loading the verification widget when Turnstile or Cap is enabled, and loading resources from the manifest and image hosts when Smoji is enabled.

## Origin checks and rate limits {#origins}

Each site registers **Allowed origins** in the admin console. Browsers reading comments from any other origin are refused, and comment submissions must carry a registered origin, so the comment section works only on websites you have registered.

Submissions, reads, deletions and admin sign-ins are rate-limited by IP: by default, 5 submissions and 60 reads per minute. Behind a reverse proxy, configure [`trusted_proxies`](../self-hosting/reverse-proxy#trusted-proxies), or all visitors share one quota.

## Time and time zone

Comment times are shown as `YYYY-MM-DD HH:mm`, in the time zone set by `TZ` in Compose; see [Time zone and admin language](../self-hosting/docker#timezone). Hover over a time to see the time zone.
