# Smoji 貼圖包協議與自建源

Smoji 是 Ecoku 採用的純文字輕量級貼圖協議。

---

## 清單格式 `smoji.json`

```json
{
  "version": 1,
  "packs": [
    {
      "id": "paopao",
      "label": "泡泡貼圖",
      "items": [
        { "id": "smile", "label": "微笑", "src": "https://stickers.example.com/paopao/smile.png" },
        { "id": "thumbsup", "label": "讚", "src": "https://stickers.example.com/paopao/thumbsup.png" }
      ]
    }
  ]
}
```

- 貼圖圖片 Origin 必須與清單自身 Origin 保持嚴格同源。
- 純文字標記語法：`![smoji:標籤](圖片URL)`。
