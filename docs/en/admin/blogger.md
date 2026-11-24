# Blogger identity

The blogger doesn't need a separate account. After you set a passphrase for a site, type it into the name field in your blog's comment section to post as the blogger, and the comment gets the blogger badge.

<div class="steps">

### Fill in the blogger details for the site

In the admin console, edit the site under **Sites** and find the blogger fields:

| Field | Description |
| --- | --- |
| Blogger name | The publicly shown name, up to 80 characters |
| Blogger email | Not public; stored as the email of blogger comments. Blogger notifications go to the recipients on the **Notifications** page, not here. |
| Blogger passphrase | 12 to 80 characters, no more than 72 UTF-8 bytes, no line breaks. It is never shown again after saving; leave it empty to keep it unchanged. |
| Comment badge | Text shown after the name, `[博主]` by default, up to 16 characters. If empty, no badge is shown. |

Fill in both the name and the email, or leave both empty. When both are filled in, a passphrase is required.

### Post in the comment section

In your blog's comment box:

- **Name**: enter the blogger passphrase
- **Email**, **Website**: leave empty

Post it. When the server recognizes the passphrase, it replaces the comment's name, website and email with the blogger name, the site URL and the blogger email, and adds the blogger badge. The browser doesn't save the passphrase as your name.

</div>

::: warning If you mistype the passphrase
A mistyped passphrase is treated as an ordinary name. If the site makes email optional, the comment is published with the passphrase text as its name. When you notice, delete it under **Comments** and change the passphrase.
:::

## Turn off the blogger identity

Clear both the blogger name and email and save. The passphrase is cleared as well.

## Marks on existing comments

The blogger mark is written when a comment is saved and is never recalculated. Changing the name or the passphrase doesn't affect marks on existing comments.

Past comments are backfilled by name and email in only two cases:

- The one-time migration when upgrading from an older version to schema v5;
- When [importing from Twikoo](../self-hosting/twikoo), comments whose name matches exactly and whose email matches (case-insensitive) are marked as blogger comments.

The blogger's own comments don't trigger notifications to yourself; see [Notifications · When notifications are sent](./notifications#when) for the rules.
