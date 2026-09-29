# Smoji sticker packs

Smoji lets visitors insert sticker images into plain-text comments. A sticker is saved as a text marker in the comment body and becomes an image only when displayed, so the comment itself is still plain text.

Ecoku does not bundle, proxy, or cache any sticker images. You host a `smoji.json` manifest and the images on your own static server or CDN, then enter the manifest URL for the site in the admin console.

## How it works

1. The first time a visitor clicks the **Stickers** (表情) button in the comment box, the browser loads the manifest (without cookies or Referer).
2. When the visitor picks a sticker, a marker is inserted into the comment box:

   ```text
   ![smoji:Thumbs up](https://stickers.example.com/paopao/thumbsup.png)
   ```

3. On submit, the server checks every marker. It allows saving only if the site has sticker packs enabled and the image URL has the same origin as the manifest.
4. When a comment is displayed, markers that meet the same conditions are rendered as images. Everything else is displayed as written.

After a site turns sticker packs off, the markers in existing comments are displayed as literal text, and no images are loaded.

::: warning Privacy
Sticker images are sent to the visitor's browser directly by the server that hosts them, and that server can see the visitor's IP address.
:::

## Enable

On **Sites** (站点管理) in the admin console, edit the site, check **Enable sticker pack** (启用表情包), enter the manifest URL, and save.

- The manifest URL must use HTTPS. Only loopback addresses such as `localhost` and `127.0.0.1` may use HTTP, for local development.
- The URL cannot contain a username or password, a `?` query string, or a `#` fragment.
- If the manifest and the comment page are on different domains, the server hosting the manifest must allow cross-origin requests (CORS) from the comment page's origin.

## Manifest format

```json
{
  "version": 1,
  "packs": [
    {
      "id": "paopao",
      "label": "Paopao",
      "items": [
        { "id": "smile", "label": "Smile", "src": "https://stickers.example.com/paopao/smile.png" },
        { "id": "thumbsup", "label": "Thumbs up", "src": "thumbsup.png" }
      ]
    }
  ]
}
```

| Field | Rules |
| --- | --- |
| `version` | Always `1`. |
| `base` | Optional. See below. |
| `packs` | List of groups, 1 to 64. |
| `packs[].id` | Group ID. Starts with a letter or digit and may contain letters, digits, `.`, `_`, and `-`, up to 64 characters. Must be unique. |
| `packs[].label` | Group name, shown on the picker's tab. Same rules as `items[].label`. |
| `packs[].items` | List of stickers, 1 to 600 per group, and no more than 6000 in the whole manifest. |
| `items[].id` | Sticker ID. Same rules as the group ID. Must be unique within the group. |
| `items[].label` | Sticker name, 1 to 40 characters after trimming leading and trailing spaces. It cannot contain `]` or control characters such as line breaks. It is written into the comment marker and also used as the image's alt text. |
| `items[].src` | Image URL. Either a full URL or a path relative to the manifest. |

Requirements for the manifest as a whole:

- **Each object may contain only the fields listed above.** Any extra field causes rejection.
- Every image URL, once resolved, must have the **same origin** as the manifest (same scheme, domain, and port), and cannot contain a username or password, `?`, or `#`.
- The file is no larger than 1 MiB, the response `Content-Type` is `application/json` or ends in `+json`, and the download completes within 8 seconds.

## Compact form: base {#base}

When you have many stickers, you can use a `base` template instead of writing `src` for each one:

```json
{
  "version": 1,
  "base": "https://stickers.example.com/smoji/{pack}/{id}.webp",
  "packs": [
    {
      "id": "douyin",
      "label": "Douyin",
      "items": [
        { "id": "smile", "label": "Smile" },
        { "id": "cool", "label": "Cool", "src": "https://stickers.example.com/smoji/extra/cool.png" }
      ]
    }
  ]
}
```

- `base` must contain both `{pack}` and `{id}`, which are replaced with the group ID and the sticker ID. It must itself have the same origin as the manifest.
- Stickers without `src` get their URL from the template. Stickers with `src` use `src`.
- The expanded result is still a full URL, so the format of markers saved in comments does not change.

`base` is supported starting with v0.2.1.

## Update sticker assets

Comments store the **full image URL**. When you update your assets:

- Keep the old image URLs working, or put compatible copies at the original paths. Replacing only the manifest does not fix images that are already broken in existing comments.
- Do not change the domain that hosts your stickers. If you do, old markers no longer have the same origin as the new manifest, and all of them are displayed as text.
- Do not put `localhost` URLs in a production manifest. When exporting with an asset tool, set the asset URL to your CDN, such as `https://stickers.example.com/smoji/`.

## Marker format

```text
![smoji:name](image-url)
```

`(` and `)` in the image URL are encoded as `%28` and `%29`. `formConfig.smoji` in the public API returns whether the site has sticker packs enabled and the manifest URL. A custom frontend can use it to build its own picker and rendering, following the same rules as above.
