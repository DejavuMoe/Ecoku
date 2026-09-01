# Smoji Stickers Protocol

Smoji is a plain-text sticker protocol used in Ecoku discussions.

---

## Manifest Schema `smoji.json`

```json
{
  "version": 1,
  "packs": [
    {
      "id": "paopao",
      "label": "PaoPao",
      "items": [
        { "id": "smile", "label": "Smile", "src": "https://stickers.example.com/paopao/smile.png" },
        { "id": "thumbsup", "label": "Thumbs Up", "src": "https://stickers.example.com/paopao/thumbsup.png" }
      ]
    }
  ]
}
```

- Images must strictly share the same HTTPS origin with the manifest.
- Plain text marker: `![smoji:label](url)`.
