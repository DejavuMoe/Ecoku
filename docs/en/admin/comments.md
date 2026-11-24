# Managing comments

Ecoku has no moderation queue; comments go public as soon as they're submitted. On the **Comments** page of the admin console, you view all comments and delete the ones that shouldn't stay.

## View comments

The **Comments** page has two tabs, **Published** and **Deleted**, with 20 comments per page grouped by date. You can switch between **Newest first** and **Oldest first**. Each comment shows:

- The body, time, post title and page key
- The email and website the visitor entered (these are not public)
- For a reply, a quote of the comment it answers

**View original comment** opens the post in a new tab and jumps to that comment.

## Delete comments {#delete}

There are two kinds of deletion, and neither **can be undone**.

| | Tombstone delete | Delete permanently |
| --- | --- | --- |
| Where | Any comment under **Published** | A comment with no replies under **Deleted** |
| Result | Clears the name, email, website and body, keeping its place in the thread | Removes it from the database |
| What visitors see | **Deleted** and **[Comment deleted]**; replies below it still show | The comment is gone |

Tombstone deletion comes first so the replies below don't lose their context. A tombstone that still has replies can't be deleted permanently; the console shows **Replies remain; permanent deletion is unavailable**.

A tombstoned comment can no longer be replied to.

## How deletion affects notifications

After you delete a comment, related notifications that haven't been sent yet are no longer sent, and Telegram messages already sent are rewritten into a deletion notice. Emails already sent can't be recalled. See [Notifications · After a comment is deleted](./notifications#after-deletion).

## Delete comments with a script

If you need an automated script to delete comments, you can configure a site management credential for a site. It can only tombstone-delete that site's comments. See the comments on `sites[].management_key_env` in the [configuration file](../reference/configuration), and [HTTP API · Authentication](../reference/api#auth).
