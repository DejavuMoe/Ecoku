# 升級與遷移

Ecoku 採用版本化、原位、交易性的 SQLite Schema 遷移體系。

準備升級至 **[v0.1.9](./upgrades/v0.1.9)** 時，先確認提交 CI 成功且鏡像已發布。自 v0.1.8 升級維持 schema v7，主要影響是公開讀取預算與頻控。回滾至 v0.1.8 前須移除明確新增的 `rate_limit.comment_list`；SDK 行為與操作步驟見版本說明。

---

## 升級步驟

1. 閱讀目標版本說明並執行停服冷備份。
2. 修改 `compose.yaml` 中的精確鏡像標籤（如 `v0.1.8`）。
3. 拉取鏡像並重啟：
   ```bash
   sudo docker compose pull
   sudo docker compose up -d
   sudo docker compose logs --tail=100 -f ecoku
   curl -f http://127.0.0.1:12123/api/health
   ```

---

## Schema 版本演進

| 鏡像版本區間 | Schema 版本 | 核心資料庫變更 |
| :--- | :---: | :--- |
| `v0.1.0`～`v0.1.2` | `v4` | 基礎表結構、Turnstile 設定表。 |
| `v0.1.3`～`v0.1.4` | `v5` | `sites.blogger_passphrase_hash`、`comments.is_blogger`、Outbox 拆行。 |
| `v0.1.5`～`v0.1.7` | `v6` | 改為 `captcha_settings` 表，支援自託管 Cap。 |
| `v0.1.8` | `v7` | 新增 Smoji 貼圖支援欄位。 |
| `v0.1.9` | `v7` | 無新遷移；公開讀取預算、分頁、頻控與 SQLite 重連安全設定。 |

---

## 歷史升級索引

- [v0.1.9](./upgrades/v0.1.9)：2026-08-31；CWE-400 修復與相容性說明
- [v0.1.8](./upgrades/v0.1.8)
- [v0.1.7](./upgrades/v0.1.7)
- [v0.1.6](./upgrades/v0.1.6)
- [v0.1.5](./upgrades/v0.1.5)
- [v0.1.4](./upgrades/v0.1.4)
- [v0.1.3](./upgrades/v0.1.3)
- [v0.1.2](./upgrades/v0.1.2)
- [v0.1.1](./upgrades/v0.1.1)
- [v0.1.0](./upgrades/v0.1.0)
- [更早候選版](./upgrades/earlier)
