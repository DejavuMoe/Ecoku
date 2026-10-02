# Notifications

Ecoku can notify the blogger when a new comment arrives, and email a visitor when someone replies to their comment. You configure notifications on the **Notifications** (通知) page of the admin console. The settings apply to every site on the instance.

After changing a channel, click 「保存」 (save) in the bottom save bar. Email and Telegram are validated and saved separately. If one channel has an error, the other valid channel can still be saved; unsaved changes remain on the page.

| Channel | Recipients |
| --- | --- |
| Email (SMTP) | Blogger: the recipient list you enter. Visitor: the email address left on the comment that was replied to. |
| Telegram bot | Blogger only: the user, group, or channel IDs you enter. |

## Before you enable notifications

- `notifications.instance_public_url` is set in `app/config.yaml`. Otherwise no channel can be enabled.
- A new instance creates the notification encryption master key in `data/ecoku-secrets.json`. During migration, an old instance may still read `ECOKU_NOTIFICATION_ENCRYPTION_KEY` from `ecoku.env`; remove it only after a stopped backup confirms the migration.
- The server can reach an external SMTP port (usually 465 or 587) or `api.telegram.org`. Some cloud providers block outbound SMTP ports by default.

## When notifications are sent

Whether a comment counts as "the blogger's" depends on the blogger mark recorded when the comment was saved, that is, whether the comment was posted with the [blogger passphrase](./admin#blogger).

| Case | Notify the blogger (email / Telegram) | Email the visitor who was replied to |
| --- | :---: | :---: |
| Visitor posts a root comment | Sent | — |
| Visitor replies to a visitor | Sent | Sent |
| Visitor replies to the blogger | Sent | — |
| Blogger posts a root comment | Not sent | — |
| Blogger replies to a visitor | Not sent | Sent |
| Blogger replies to the blogger | Not sent | — |

In addition:

- No visitor email is sent if the visitor who was replied to left no email address, or if the replier and the person replied to have the same email address (replying to yourself).
- If the comment that was replied to is deleted before the notification goes out, the visitor email is canceled.
- If the comment itself is deleted before the notification goes out, the blogger's email and Telegram messages are canceled too. For notifications that were already sent, see [After a comment is deleted](#after-deletion).
- Visitor reply notifications are sent only when the email channel is enabled. There is no separate switch. Turning the email channel off also stops visitor reply notifications.
- Telegram never notifies visitors.

## Email

| Field | Description |
| --- | --- |
| SMTP server (SMTP 服务器) | Such as `smtp.example.com`. |
| Port (端口) | Use what your mail provider requires, usually 465 (SSL/TLS) or 587 (STARTTLS). |
| Encryption (加密方式) | `SSL/TLS`: encrypted from the moment the connection opens. `STARTTLS`: opens a plain connection and then upgrades it. Unencrypted SMTP is not supported. |
| Username (用户名) | May be empty. If empty, no SMTP authentication is performed. The password is still required; for a server that needs no authentication, enter any value. |
| Password (密码) | After saving, it is shown only as Set (已设置). Leaving it empty keeps it unchanged. |
| From address (发件人地址) | The From address of the email. Many providers require it to match the sign-in account. |
| Recipients (通知收件人) | Email addresses that receive blogger notifications. You can enter several, separated by Enter or commas. |

**Send test email** (发送测试邮件) sends a test email to the recipients using the values currently in the form (if the password is empty, the saved password is used). You do not need to save first. If it fails, the page gives the reason, such as a connection timeout, failed authentication, or a failed TLS handshake.

Each email contains both a plain-text and an HTML version. The HTML version uses the same paper-and-ink colors as the comment area and the admin console. Text uses the sans-serif Chinese and Latin fonts installed on the reader's device; no web fonts are loaded. Mail clients that support dark mode switch to dark colors automatically. The content depends on the type:

- New comment for the blogger: the post title, the publication time, the commenter and the comment body, and a "查看原文" (View original) link;
- New reply for the blogger: the post title, the publication time, the comment that was replied to, the replier and the reply body, and a "查看原文" (View original) link;
- Reply for a visitor: the post title, the reply time, the visitor's own comment, the reply body, and a "查看回复" (View reply) link.

Times are shown in the container's `TZ`, the same as in the comment area, with the UTC offset, such as `2026/09/29 10:18 (UTC+8)`. Comments by the blogger show the site's blogger badge after the nickname.

Smoji render as images only when enabled and the image satisfies the site’s image-origin rule. This defaults to the manifest origin; the next release supports [a separate image origin](../integration/smoji#hosting). Images load directly from their host, as in the comment area. If the mail client blocks external images, `[表情：标签]` ([Smoji: label]) is shown instead. Other cases and plain-text messages also use `[表情：标签]`.

Subject lines (sent in Chinese):

- Blogger notification: "您在 [站点名称] 上有新评论：[文章标题]" (You have a new comment on [site name]: [post title]) or "您在 [站点名称] 上有新回复：[文章标题]" (You have a new reply on [site name]: [post title])
- Visitor reply notification: "你在 [站点名称] 的评论收到了回复：[文章标题]" (Your comment on [site name] got a reply: [post title])

Post titles longer than 60 characters are truncated. If the page has no title, nothing is appended to the subject. The sender's display name is the site name; the address is still the From address. Emails carry an `Auto-Submitted: auto-generated` header, so auto-responders usually do not reply.

## Telegram

1. In Telegram, create a bot with [@BotFather](https://t.me/BotFather) and get its bot token.
2. Make sure the bot can message you: for a private chat, send the bot a message first; for a group or channel, add the bot to it, and for a channel also make it an admin.
3. Find the ID of the target: a user ID is a string of digits, such as `123456789`; group and channel IDs usually start with `-100`, such as `-1001234567890`.
4. Enter the bot token and target IDs (you can enter several) in the admin console, click **Send test message** (发送测试消息) to confirm, then save.

Messages contain the site name, the post title, the publication time, the commenter or replier, the original comment that was replied to (shown as a quote, at most 400 characters), and the body (at most 1000 characters), with a "View original" (查看原文) link at the end. Smoji appear as `[表情：标签]` ([Smoji: label]).

## Delivery

Notifications are not sent synchronously when a comment is submitted. The comment and the notifications it triggers are written to a pending queue in the same database transaction, and a background task picks up a batch and sends it every 3 seconds. As a result:

- A mail server that is temporarily unreachable does not stop visitors from commenting.
- Each recipient has its own record and is retried separately. A failure for one address does not affect other addresses.
- After a failure, retries happen at intervals of 2, 4, 8, 16, 32, 64, and 128 minutes, for 8 attempts in total, and then Ecoku gives up.
- Failures that a retry cannot fix are given up immediately: the mailbox does not exist or the server rejects the message (SMTP 55x), or Telegram cannot find the chat or the bot was removed or blocked (HTTP 400/403). When Telegram asks to slow down (HTTP 429), the retry waits for the time it gives.
- Records that were sent, canceled, or given up are kept for 30 days and then removed automatically.
- Recipients are fixed when a notification is queued. If you later disable a channel or change recipients, notifications already in the queue are still delivered as they were.
- If the process crashes right after a message has been sent but before the result is recorded, it may be sent again after restart. In rare cases you may receive a duplicate notification.

Logs record only the notification ID, error type, and attempt count. They do not record recipient addresses, comment content, or credentials.

## After a comment is deleted {#after-deletion}

After you delete a comment in the admin console:

- Notifications that have not been sent yet are not sent, including the blogger's email and Telegram messages.
- Replies to this comment no longer send email to its author, and the author's address is removed from the queue.
- Telegram messages that were already sent are rewritten to "这条评论已被删除，通知内容已移除。" (This comment was deleted and the notification content has been removed.). Only the site name and post title remain.
- Emails that were already sent cannot be recalled.

A sent Telegram message cannot be rewritten if the notification was sent more than 30 days ago and its record has been removed, if the tombstone was permanently deleted before the retraction finished, or if the process crashed after the message was sent but before the result was recorded.

## Troubleshooting {#troubleshooting}

**Enabling a channel fails to save with "请求参数不符合要求，请检查后重试。" (the request parameters are invalid; check and try again)**: if the form is filled in correctly, the instance public URL is most likely not set. Set `notifications.instance_public_url` in `app/config.yaml` and recreate the container.

**Saving shows "服务端暂时无法完成操作，数据没有被修改。" (the server cannot complete the operation right now; no data was changed)**: check that `data/ecoku-secrets.json` exists and is readable by the container. During migration, restore the original `ECOKU_NOTIFICATION_ENCRYPTION_KEY` from backup and remove it only after the persistent key has been verified.

**The test email times out**: usually the server's outbound SMTP port is blocked. First confirm connectivity on the server with `nc -vz smtp.example.com 465`, then check that the port matches the encryption mode (465 goes with SSL/TLS, 587 with STARTTLS).
