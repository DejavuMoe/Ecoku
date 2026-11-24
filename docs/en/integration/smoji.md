# Smoji sticker packs

Ecoku comments are plain text, and stickers are the only content that can be shown as images. A sticker is saved in the comment as text like `![smoji:name](image URL)` and becomes an image only when displayed. Visitors' browsers load the images directly from the image host; Ecoku neither stores nor proxies them.

[Smoji](https://github.com/DejavuMoe/Smoji) is the companion sticker gallery. In the [Smoji workbench](https://smoji.zsh.moe/), you can copy individual stickers, or pick a selection and export it as a manifest for the comment box's sticker picker.

## Use Smoji directly {#quick-start}

Use Smoji's public gallery directly, without hosting any assets yourself:

1. Edit the site under **Sites** in the admin console and set **Stickers** to **On**.
2. Enter the public manifest URL in **Smoji manifest** and save:

   ```text
   https://s3-cdn.zsh.moe/smoji/smoji.json
   ```

3. Open a page with comments and click **Sticker** to pick an image. You can also open a sticker's details in the [Smoji workbench](https://smoji.zsh.moe/), copy its **Markdown** format and paste it into the comment box:

   ```text
   ![smoji:挠脸](https://s3-cdn.zsh.moe/smoji/aodamiao/iclpknnbbcne.webp)
   ```

4. Click **Preview** to check the image, then post the comment. Pasting a marker doesn't require opening the **Sticker** picker first.

Only the `![smoji:…](…)` format is shown as a sticker. A bare image URL, HTML, BBCode and ordinary Markdown images are shown as text.

A pasted sticker works as long as its image origin satisfies the site setting; it doesn't have to be in the picker's manifest. After you turn off **Stickers**, existing stickers are shown as their original text, and new stickers are rejected on submission.

## Pick stickers and export a manifest {#custom-manifest}

To show only some stickers in the picker, export your own manifest:

1. In the [Smoji workbench](https://smoji.zsh.moe/), select categories with 「按分类导出」 (Export by category), or build your own groups and add stickers with 「自选分组」 (Custom groups).
2. Choose the **Smoji** format (v1) and click 「导出」 (Export) to download `smoji-YYYYMMDD.json`. 「分组备份」 (Group backup) is a workbench backup file and can't be used as an Ecoku manifest.
3. Publish the exported file at a publicly accessible HTTPS static URL. You can rename it to `smoji.json` or keep the date suffix; enter the actual URL in the admin console. Before hosting it, check the [manifest and image origin requirements](#hosting).

The export is a local JSON file. It contains no images and doesn't upload anything for you. Custom groups are saved in the current browser; when you change your selection, export again and replace your hosted file.

For example, a custom group `favorites` can contain two images from `aodamiao`:

```json
{
  "version": 1,
  "base": "https://s3-cdn.zsh.moe/smoji/{pack}/{id}.webp",
  "packs": [
    {
      "id": "favorites",
      "label": "常用",
      "items": [
        {
          "id": "iclpknnbbcne",
          "label": "挠脸",
          "src": "https://s3-cdn.zsh.moe/smoji/aodamiao/iclpknnbbcne.webp"
        },
        {
          "id": "lhbidblgecnj",
          "label": "坏笑",
          "src": "https://s3-cdn.zsh.moe/smoji/aodamiao/lhbidblgecnj.webp"
        }
      ]
    }
  ]
}
```

Keep these `src` values. They point to the images' actual locations and take precedence over `base`. If you delete them, the template produces `/smoji/favorites/…`, while the images are actually under `/smoji/aodamiao/…`.

## Hosting the manifest and images {#hosting}

The manifest and images can be hosted separately. After publishing the JSON above unchanged at `https://example.com/smoji.json`, fill in **Stickers** under **Sites** in the admin console:

| Field | Value |
| --- | --- |
| Stickers | On |
| Smoji manifest | `https://example.com/smoji.json` |
| Image origin | `https://s3-cdn.zsh.moe` |

After saving, browsers read the manifest from `example.com` and load images from `s3-cdn.zsh.moe`. You don't need to move images or edit the exported JSON.

**Image origin** is a single optional origin (`https://domain[:port]`), without a path or wildcards. If empty, only images with the same origin as the manifest are allowed; if set, only this origin is allowed, and the manifest's origin is no longer allowed in addition.

| Manifest location | Image location | Result |
| --- | --- | --- |
| Smoji public CDN | The same CDN | Use the public manifest and copied sticker markers directly. |
| Your own website | Smoji public CDN | Set **Image origin** to `https://s3-cdn.zsh.moe`. |
| Your own static server or CDN | Same origin as the manifest | Use a custom manifest; host the images too and update their URLs. |

Which images are allowed is decided only by the admin settings. The `base` and `src` in the manifest can't widen that scope.

Requirements for hosting the manifest:

- Use an HTTPS URL, without credentials, `?` or `#`. Only `localhost` and `127.0.0.1` may use HTTP.
- If the manifest and the page with the comments have different origins, the manifest server must return CORS headers, such as `Access-Control-Allow-Origin: *`. **Allowed origins** in the Ecoku admin console doesn't cover this.
- Serve the JSON directly with a `Content-Type` of `application/json` or one ending in `+json`, no larger than 1 MiB, and downloadable within 8 seconds.
- If your blog sets CSP, allow the manifest origin in `connect-src` and the image origin in `img-src`.

## Loading and display {#how-it-works}

1. When a visitor first opens the **Sticker** picker, the browser requests the manifest directly, without cookies or Referer.
2. The browser validates the manifest, resolves `base` and `src`, and loads the picker's images from those URLs. Selecting a sticker writes its full image URL into the comment marker.
3. On submission, the Ecoku server checks the site's sticker setting, the marker format and the image origin. The server doesn't download the manifest or images.
4. Preview, public comments and admin comments render valid markers according to the site settings, without downloading the manifest first. Email notifications use the same origin rules; Telegram shows text labels. Images load directly from the asset host, not through the Ecoku server.

A manifest loading failure affects only the picker. Stickers already posted still display (as long as the images are still reachable).

::: warning Privacy
The image host sends the manifest and images directly to visitors' browsers and can see their IP addresses. Image requests set `no-referrer`, but that doesn't hide the IP.
:::

## Manifest format {#manifest-format}

| Field | Rules |
| --- | --- |
| `version` | Always `1`. |
| `base` | Optional; see below. |
| `packs` | List of groups, 1 to 64. |
| `packs[].id` | Group ID. Starts with a letter or digit and may contain letters, digits, `.`, `_` and `-`, up to 64 characters. Must be unique. |
| `packs[].label` | Group name, shown on the picker's tab. Same rules as `items[].label`. |
| `packs[].items` | List of stickers, 1 to 600 per group; no more than 6000 in the whole manifest. |
| `items[].id` | Sticker ID. Same rules as the group ID; must be unique within the group. |
| `items[].label` | Sticker name, 1 to 40 characters after trimming leading and trailing spaces. It can't contain `]` or control characters such as line breaks. It is written into the comment marker and also used as the image's alt text. |
| `items[].src` | Image URL. Either a full URL or a path relative to the manifest. |

Requirements for the manifest as a whole:

- **Each object may contain only the fields listed above.** Any extra field causes rejection.
- Every resolved image URL must have the **same origin** as the configured image origin (same scheme, domain and effective port), without credentials, `?` or `#`. If the image origin is empty, the manifest origin is used.
- For file size and response requirements, see [Hosting](#hosting).

## Compact form: base {#base}

When you have many stickers, you can use a `base` template instead of writing `src` for each one:

```json
{
  "version": 1,
  "base": "https://stickers.example.com/smoji/{pack}/{id}.webp",
  "packs": [
    {
      "id": "douyin",
      "label": "抖音",
      "items": [
        { "id": "smile", "label": "微笑" },
        { "id": "cool", "label": "酷", "src": "https://stickers.example.com/smoji/extra/cool.png" }
      ]
    }
  ]
}
```

- `base` must contain both `{pack}` and `{id}`, which are replaced by the group ID and sticker ID. The expanded URL must also satisfy the image origin setting.
- Stickers without `src` get their URL from the template; stickers with `src` use `src`.
- The expanded result is still a full URL, so the format of markers saved in comments doesn't change.

## Updating sticker assets {#updates}

Comments store the full image URL, so take care when you change assets:

- Keep the old image URLs working, or put compatible copies at the original paths. Replacing only the manifest doesn't fix images already broken in past comments.
- Keep past images within the configured image origin. With an explicit origin, moving the manifest doesn't change which images are trusted; with an empty setting, moving the manifest to another origin makes old-origin markers display as text. Past comments are not rewritten automatically.
- Removing a sticker from your custom manifest only removes it from the picker. It doesn't delete markers in past comments, and doesn't stop same-origin image markers from being submitted directly.
- With a public CDN, whether images stay available depends on the asset host. When moving assets yourself, check both `base` and every explicit `src`; production manifests must not reference local development addresses.

## Marker format {#markers}

```text
![smoji:名称](图片地址)
```

`(` and `)` in the image URL are encoded as `%28` and `%29`. The public API's `formConfig.smoji` returns `enabled`, `manifestUrl` and the optional `imageOrigin`. A custom front end can use it to build its own picker and rendering, following the same rules as above.
