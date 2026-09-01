# Smoji 表情包协议与自建源

Smoji 是 Ecoku 采用的**纯文本轻量级表情包协议**。

它兼顾了丰富的表情交流体验与纯文本安全边界：表情在数据库与服务端中仅以纯文本格式存储，客户端在保证同源安全的前提下按需渲染。

---

## 协议工作流程

```mermaid
sequenceDiagram
    autonumber
    actor Visitor as 访客
    participant Browser as 浏览器 / SDK
    participant CDN as 表情清单托管源
    participant Server as Ecoku 服务端

    Visitor->>Browser: 点击“表情”图标
    Browser->>CDN: GET smoji.json (无凭据, no-referrer)
    CDN-->>Browser: 返回表情包清单 JSON
    Visitor->>Browser: 选择表情 [赞]
    Browser->>Browser: 向评论框插入纯文本: ![smoji:赞](https://cdn.example.com/stickers/like.png)
    Visitor->>Server: 提交纯文本评论正文
    Server->>Server: 校验图片 URL 与站点配置的 Manifest 必须同源
    Server->>Server: 原样存储纯文本标记至 SQLite
    Server-->>Browser: 返回成功
    Browser->>Browser: 客户端渲染时将同源标记渲染为 <img> 标签
```

---

## `smoji.json` 清单 Schema 规范 (v1)

自建表情源需在 Web 服务器根目录下提供一个符合 JSON Schema 规范的 `smoji.json` 文件：

```json
{
  "version": 1,
  "packs": [
    {
      "id": "paopao",
      "label": "泡泡表情",
      "items": [
        {
          "id": "smile",
          "label": "微笑",
          "src": "https://stickers.example.com/paopao/smile.png"
        },
        {
          "id": "thumbsup",
          "label": "赞",
          "src": "https://stickers.example.com/paopao/thumbsup.png"
        }
      ]
    }
  ]
}
```

### 字段约束与限制

- `version`：必须为整数 `1`。
- `packs`：表情包分组数组（1～32 组）。
- `packs[].id`：分组唯一标识（匹配正则 `/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/`）。
- `packs[].label`：分组显示名称（最多 40 字符）。
- `packs[].items`：表情项列表（每组 1～300 项，全清单总表情数不超过 2000 个）。
- `items[].src`：表情图片的绝对直链地址。
- **严格同源约束**：图片 `src` 的 Origin **必须与 `smoji.json` 自身的 Origin 严格保持一致**，生产环境必须使用 `https://` 协议。

---

## 纯文本标记格式

- **标记语法**：`![smoji:标签名称](图片绝对URL)`
- **示例**：`![smoji:赞](https://stickers.example.com/paopao/thumbsup.png)`

### 安全降级规则
若评论正文中包含了与当前站点已配置清单不同源的图片标记，或者站点关闭了 Smoji 功能，客户端在渲染时会自动将其原样作为纯文本显示，绝对不会解释为 HTML 图片标签，杜绝跨站 IP 追踪与钓鱼攻击。
