# Notifications

Ecoku can notify the blogger when a new comment arrives, and email a visitor when someone replies to their comment. You configure notifications on the **Notifications** (通知设置) page of the admin console. The settings apply to every site on the instance.

| Channel | Recipients |
| --- | --- |
| Email (SMTP) | Blogger: the recipient list you enter. Visitor: the email address left on the comment that was replied to. |
| Telegram bot | Blogger only: the user, group, or channel IDs you enter. |

## Before you enable notifications

- `notifications.instance_public_url` is set in `app/config.yaml`. Otherwise no channel can be enabled.
- `ECOKU_NOTIFICATION_ENCRYPTION_KEY` is set in `ecoku.env`. The SMTP password and bot token can be saved only after they are encrypted with it.
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
- Visitor reply notifications are sent only when the email channel is enabled. There is no separate switch. The **When a visitor gets a reply** (访客收到回复时) option in the admin console is always checked.
- Telegram never notifies visitors.

## Email

| Field | Description |
| --- | --- |
| SMTP server (SMTP 服务器) | Such as `smtp.example.com`. |
| Port (端口) | Use what your mail provider requires, usually 465 (SSL/TLS) or 587 (STARTTLS). |
| Encryption (加密方式) | `SSL/TLS`: encrypted from the moment the connection opens. `STARTTLS`: opens a plain connection and then upgrades it. Unencrypted SMTP is not supported. |
| Username (用户名) | May be empty. If empty, no SMTP authentication is performed. |
| Password (密码) | After saving, it is shown only as Set (已设置). Leaving it empty keeps it unchanged. |
| From address (发件人地址) | The From address of the email. Many providers require it to match the sign-in account. |
| Recipients (通知收件人) | Email addresses that receive blogger notifications. You can enter several, separated by Enter or commas. |

**Send test email** (发送测试邮件) sends a test email to the recipients using the values currently in the form (if the password is empty, the saved password is used). You do not need to save first. If it fails, the page gives the reason, such as a connection timeout, failed authentication, or a failed TLS handshake.

Each email contains both a plain-text and an HTML version, with the site name, the commenter, the post title, the submission time, the comment body, and a link to the original comment. Reply notifications also include the comment that was replied to. Times in emails are in UTC.

Subject lines (sent in Chinese):

- Blogger notification: "您在 [站点名称] 上有新评论" (You have a new comment on [site name]) or "您在 [站点名称] 上有新回复" (You have a new reply on [site name])
- Visitor reply notification: "你在 [站点名称] 的评论收到了回复" (Your comment on [site name] got a reply)

## Telegram

1. In Telegram, create a bot with [@BotFather](https://t.me/BotFather) and get its bot token.
2. Make sure the bot can message you: for a private chat, send the bot a message first; for a group or channel, add the bot to it, and for a channel also make it an admin.
3. Find the ID of the target: a user ID is a string of digits, such as `123456789`; group and channel IDs usually start with `-100`, such as `-1001234567890`.
4. Enter the bot token and target IDs (you can enter several) in the admin console, click **Send test message** (发送测试消息) to confirm, then save.

Messages have the same content as emails. Long messages are truncated (at most 1200 characters of the comment body), with a "View original" (查看原文) link at the end.

## Delivery

Notifications are not sent synchronously when a comment is submitted. The comment and the notifications it triggers are written to a pending queue in the same database transaction, and a background task picks up a batch and sends it every 3 seconds. As a result:

- A mail server that is temporarily unreachable does not stop visitors from commenting.
- Each recipient has its own record and is retried separately. A failure for one address does not affect other addresses.
- After a failure, retries happen at intervals of 2, 4, 8, 16, 32, 64, and 128 minutes, for 8 attempts in total, and then Ecoku gives up.
- Recipients are fixed when a notification is queued. If you later disable a channel or change recipients, notifications already in the queue are still delivered as they were.
- If the process crashes right after a message has been sent but before the result is recorded, it may be sent again after restart. In rare cases you may receive a duplicate notification.

Logs record only the notification ID, error type, and attempt count. They do not record recipient addresses, comment content, or credentials.

## Troubleshooting {#troubleshooting}

**Saving shows "实例公开网址尚未配置" (instance public URL is not configured)**: set `notifications.instance_public_url` in `app/config.yaml` and recreate the container.

**Saving shows "通知加密密钥尚未配置" (notification encryption key is not configured)**: set `ECOKU_NOTIFICATION_ENCRYPTION_KEY` in `ecoku.env` and recreate the container. See [Docker deployment](./docker#env).

**The test email times out**: usually the server's outbound SMTP port is blocked. First confirm connectivity on the server with `nc -vz smtp.example.com 465`, then check that the port matches the encryption mode (465 goes with SSL/TLS, 587 with STARTTLS).
