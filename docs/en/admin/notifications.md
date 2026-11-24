# Notifications

Ecoku can send you an email or Telegram message when a new comment arrives, and email a visitor when someone replies to their comment. You set this up on the **Notifications** page of the admin console, and it applies to all sites.

<div class="page-meta">
<div>

**You will**

- Get new comments in your email or Telegram
- Have visitors receive an email when someone replies to them

</div>
<div>

**Before you start**

- `notifications.instance_public_url` is set in `app/config.yaml`
- The server can reach an SMTP port (465 / 587) or `api.telegram.org`

</div>
</div>

## Email {#email}

Fill in the SMTP details on the **Notifications** page:

| Field | Description |
| --- | --- |
| SMTP server | For example `smtp.example.com` |
| Port / Encryption | Use `SSL/TLS` with 465 and `STARTTLS` with 587. Unencrypted connections aren't supported. |
| Username | Leave empty to skip SMTP authentication |
| Password | Required. It is never shown again after saving; leave it empty to keep it unchanged. |
| From address | The From of the email. Many providers require it to match the sign-in account. |
| Notification recipients | Email addresses that receive new-comment notifications; you can enter several |

Click **Send test email**. It sends using the values in the form, so you don't need to save first. Save once the test arrives.

Subject lines look like this (sent in Chinese):

- 「您在 [站点名称] 上有新评论：[文章标题]」 (You have a new comment on [site name]: [post title])
- 「您在 [站点名称] 上有新回复：[文章标题]」 (You have a new reply on [site name]: [post title])
- For visitors: 「你在 [站点名称] 的评论收到了回复：[文章标题]」 (Your comment on [site name] got a reply: [post title])

Emails include the post title, time, commenter, body and post link; reply notifications also include the comment that was replied to. The sender's display name is the site name.

## Telegram {#telegram}

Telegram notifies only you, not visitors.

<div class="steps">

### Create a bot

Create a bot with [@BotFather](https://t.me/BotFather) and get the bot token.

### Let the bot message you

For a private chat, send the bot a message first. For a group or channel, add the bot to it; for a channel, also make it an admin.

### Fill in and test

In the admin console, enter the token and the recipient's numeric ID (a user ID is a string of digits; group and channel IDs usually start with `-100`; `@username` isn't supported). Click **Send test message**, and save once it arrives.

</div>

## When notifications are sent {#when}

"Blogger" means a comment posted with the [blogger passphrase](./blogger).

| Who did what | Notify you | Email the visitor replied to |
| --- | :---: | :---: |
| A visitor posts a comment | ✓ | — |
| A visitor replies to a visitor | ✓ | ✓ |
| A visitor replies to you | ✓ | — |
| You post or reply | — | ✓ when replying to a visitor |

No email goes to the visitor if they left no email, if they replied to themselves, or if the email channel isn't enabled.

## Delivery and retries

Notifications aren't sent when the comment is submitted. They go into a queue, and a background task picks up a batch every 3 seconds. A mail server that is temporarily unreachable doesn't stop visitors from commenting.

- Each recipient is sent to and retried separately.
- After a failure, retries happen after 2, 4, 8 … 128 minutes, up to 8 times.
- Permanent errors, such as a nonexistent address, a rejected message or a removed bot, aren't retried.
- In rare cases (the process crashes right after sending), you may receive a notification twice.

Logs record only the notification ID and the error type, never recipient addresses, comment content or passwords.

## After a comment is deleted {#after-deletion}

After you delete a comment in the admin console:

- Related notifications that haven't been sent yet are no longer sent;
- If someone later replies to it, its author no longer gets an email;
- Telegram messages already sent are rewritten to 「这条评论已被删除，通知内容已移除。」 (This comment was deleted and the notification content has been removed.);
- Emails already sent can't be recalled.

Notification records are kept for 30 days. After that, sent Telegram messages can no longer be rewritten.

## Troubleshooting {#troubleshooting}

**Enabling shows 「请求参数不符合要求，请检查后重试。」 (The request is invalid. Check it and try again.)**
Most likely `notifications.instance_public_url` isn't set in `app/config.yaml`. Set it and recreate the container.

**The test email times out**
Usually the cloud provider blocks outbound SMTP ports. Run `nc -vz smtp.example.com 465` on the server to check connectivity, then confirm that the port and encryption mode match.

**The container fails to start, and the log shows 「通知凭据校验失败」 (notification credential check failed)**
Credentials such as the SMTP password are encrypted with the key in `data/ecoku-secrets.json`. Confirm that it comes from the same backup as the database and has permissions `600`. Don't delete it; see [Backup and restore](../self-hosting/backup#restore).
