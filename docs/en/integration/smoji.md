# Smoji sticker packs

::: info Unreleased feature
「图片来源」 (Image origin) is for the next release, not v0.2.9. In v0.2.9 the manifest and images must share an origin. Use the public manifest or host your custom manifest and images together.
:::

[Smoji](https://github.com/DejavuMoe/Smoji) provides a sticker gallery and manifest export tools. In the [Smoji workbench](https://smoji.zsh.moe/), you can copy individual stickers or select categories and custom groups to export a manifest for the comment picker's contents.

Ecoku saves stickers as plain-text markers and renders them as images when displaying comments. The Ecoku server does not bundle, proxy, or cache sticker assets.

## Use Smoji directly {#quick-start}

To use Smoji's existing gallery, you do not need to download or host the assets yourself:

1. Edit the site under 「站点」 (Sites) in the admin console and select 「启用」 (Enable) under 「表情包」 (Sticker packs).
2. Enter the public manifest URL in 「Smoji 清单」 (Smoji manifest) and save:

   ```text
   https://s3-cdn.zsh.moe/smoji/smoji.json
   ```

3. Open the comment page and click 「表情」 (Stickers) to pick an image. You can also open an individual sticker's details in the [Smoji workbench](https://smoji.zsh.moe/), copy its **Markdown** format, and paste it into the comment box:

   ```text
   ![smoji:挠脸](https://s3-cdn.zsh.moe/smoji/aodamiao/iclpknnbbcne.webp)
   ```

4. Click 「预览」 (Preview) to check the image, then publish the comment. Pasting a marker does not require opening the sticker picker first.

Choose the Markdown format containing `![smoji:…](…)`. A bare image URL, HTML, or BBCode will not become an Ecoku sticker; ordinary Markdown images are not supported either.

Copied images must also satisfy the site's origin restriction. Validation checks the image origin and marker format; it does not require the image to appear in the picker manifest. After disabling 「表情包」, existing markers display as literal text, and submissions containing new sticker markers are rejected.

## Select stickers and export a manifest {#custom-manifest}

To show only a selection of stickers in the picker:

1. In the [Smoji workbench](https://smoji.zsh.moe/), select categories with 「按分类导出」 (Export by category), or create groups and add stickers with 「自选分组」 (Custom groups).
2. Choose the **Smoji** format (v1) and click 「导出」 (Export) to download `smoji-YYYYMMDD.json`. The 「分组备份」 (Group backup) format is a workbench backup, not an Ecoku manifest.
3. Publish the exported file at a publicly accessible HTTPS static URL. You can rename it to `smoji.json` or keep the date suffix; enter the actual URL in the admin console. Check the [manifest and image origin requirements](#hosting) before hosting it.

**The export is a local JSON file. It contains no images and does not upload anything or create a personal hosting URL.** Custom groups and selections stay in the current browser. After changing them, export again and replace your hosted file.

For example, a custom group named `favorites` can contain two images from `aodamiao`:

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

Keep these `src` values: they point to the images' actual locations and take precedence over `base`. Removing them would make the template generate `/smoji/favorites/…`, while the images are actually under `/smoji/aodamiao/…`.

## Host the manifest and images {#hosting}

The manifest and images can be hosted separately. Publish the JSON above unchanged at `https://example.com/smoji.json`, then configure 「表情包」 (Sticker packs) under 「站点」 (Sites):

| Field | Value |
| --- | --- |
| 表情包 (Sticker packs) | 启用 (Enable) |
| Smoji 清单 (Smoji manifest) | `https://example.com/smoji.json` |
| 图片来源 (Image origin) | `https://s3-cdn.zsh.moe` |

After saving, browsers fetch the manifest from `example.com` and images from `s3-cdn.zsh.moe`. No image migration or exported JSON changes are required.

「图片来源」 is one optional origin: scheme, hostname, and optional port, without a path, credentials, query, fragment, or wildcard. Use HTTPS in production; HTTP loopback addresses are allowed for development. Empty preserves the manifest-origin rule, so existing sites need no change. When set, only the specified origin is allowed; the manifest origin is not additionally allowed.

| Manifest location | Image location | Result |
| --- | --- | --- |
| Smoji public CDN | The same CDN | Use the public manifest and copied markers directly. |
| Your website | Smoji public CDN | Set 「图片来源」 to `https://s3-cdn.zsh.moe`. |
| Your static server or CDN | Same origin as the manifest | Host the images too and update their URLs. |

The administrator explicitly saves the image origin. A remote manifest cannot add trusted origins through `base` or `src`. Relative URLs still resolve against the manifest URL; keep exported absolute URLs when hosting separately. If hosting images yourself, actually serve the files at the destination before updating `base` and all absolute `src` values.

Hosting also requires:

- An HTTPS manifest URL without credentials, a `?` query string, or a `#` fragment. Only loopback addresses such as `localhost` and `127.0.0.1` may use HTTP for local development.
- If the manifest and the **page containing the comments** have different origins, the manifest server must allow CORS requests from that page’s origin. A public static manifest fetched without credentials can use `Access-Control-Allow-Origin: *`. Changing 「允许来源」 (Allowed origins) in Ecoku does not replace the static server’s CORS configuration.
- Serve the JSON file itself with a `Content-Type` of `application/json` or a media type ending in `+json`, rather than a download page, login page, or SPA HTML. The file must be at most 1 MiB and finish downloading within 8 seconds.
- If the website sets CSP, allow the manifest origin in `connect-src` and the image origin in `img-src`. Neither CORS nor CSP changes Ecoku's image-origin validation.

## Loading and display {#how-it-works}

1. When a visitor first opens the sticker picker, the browser requests the manifest directly, without cookies or Referer.
2. The browser validates the manifest, resolves `base` and `src`, and loads picker images from those image URLs. Selecting an image writes its full URL into the comment marker.
3. On submission, the Ecoku server validates the site's enable setting, marker format, and image origin. It does not download the manifest or images.
4. Preview, public comments, and admin comments render valid markers using the site configuration, without first downloading the manifest. Images load directly from their host, without passing through the Ecoku server. Email uses the same image-origin rule; Telegram displays text labels.

A manifest loading failure affects the picker; it does not automatically invalidate existing stickers that still satisfy the origin rule. The image files must remain accessible.

::: warning Privacy
The resource host sends the manifest and images directly to visitors' browsers and can see their IP addresses. Using Smoji's public CDN sends requests to that CDN. Image requests set `no-referrer`, which does not hide visitor IP addresses.
:::

## Manifest format {#manifest-format}

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
- Every resolved image URL must have the **same origin** as the configured image origin (same scheme, hostname, and effective port), with no credentials, `?`, or `#`. Empty image origin means the manifest origin.
- See [hosting](#hosting) for file-size and response requirements.

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

- `base` must contain both `{pack}` and `{id}`, replaced by the group ID and sticker ID. Its expanded origin must match the image-origin setting.
- Stickers without `src` get their URL from the template. Stickers with `src` use `src`.
- The expanded result is still a full URL, so the format of markers saved in comments does not change.

`base` is supported starting with v0.2.1.

## Update sticker assets {#updates}

Comments store the **full image URL**. When you update your assets:

- Keep the old image URLs working, or put compatible copies at the original paths. Replacing only the manifest does not fix images that are already broken in existing comments.
- Keep historical images within the configured image origin. With an explicit origin, moving the manifest does not change image trust; with an empty setting, moving the manifest to another origin makes old-origin markers display as text. Existing comments are not rewritten.
- Removing a sticker from your custom manifest only removes it from the picker. It neither deletes markers in existing comments nor prevents direct submissions of same-origin image markers.
- Continued availability of public CDN images depends on the asset host. When moving assets yourself, check both `base` and every explicit `src`; production manifests must not reference local development addresses.

## Marker format {#markers}

```text
![smoji:名称](图片地址)
```

`(` and `)` in the image URL are encoded as `%28` and `%29`. The public API’s `formConfig.smoji` returns `enabled`, `manifestUrl`, and optional `imageOrigin`. A custom frontend can use it to build its own picker and rendering, following the same rules as above.
