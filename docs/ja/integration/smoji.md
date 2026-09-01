# Smoji スタンププロトコル

Smoji は、Ecoku で使用される純テキストベースの軽量スタンププロトコルです。

---

## マニフェスト形式 `smoji.json`

```json
{
  "version": 1,
  "packs": [
    {
      "id": "paopao",
      "label": "PaoPao",
      "items": [
        { "id": "smile", "label": "笑顔", "src": "https://stickers.example.com/paopao/smile.png" },
        { "id": "thumbsup", "label": "いいね", "src": "https://stickers.example.com/paopao/thumbsup.png" }
      ]
    }
  ]
}
```

- スタンプ画像の Origin はマニフェスト自身の Origin と完全に一致している必要があります。
- 純テキスト記法：`![smoji:ラベル](画像URL)`。
