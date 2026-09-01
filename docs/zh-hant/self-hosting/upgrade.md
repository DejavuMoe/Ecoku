# 升級與遷移

Ecoku 採用版本化、原位、交易性的 SQLite Schema 遷移體系。

準備升級至 **[v0.1.9](./upgrades/v0.1.9)** 時，請先查閱對應版本說明。自 v0.1.8 升級維持 schema v7，無需執行資料庫遷移；主要影響是公開讀取預算保護與頻控限流。回滾至 v0.1.8 前須移除明確新增的 `rate_limit.comment_list` 欄位；詳細限制、客戶端表現與回滾步驟見版本說明。

---

## 升級步驟

1. 閱讀目標版本說明並執行停服冷備份。
2. 修改 `compose.yaml` 中的精確鏡像標籤（如 `git.via.moe/dejavu/ecoku:v0.1.9`）。
3. 拉取鏡像並重啟：
   ```bash
   sudo docker compose pull
   sudo docker compose up -d
   sudo docker compose logs --tail=100 -f ecoku
   curl -f http://127.0.0.1:12123/api/health
   ```

---

## Schema 版本演進

| 鏡像版本 | Schema 版本 | 核心資料庫變更 |
| :--- | :---: | :--- |
| **`v0.1.9`** | `v7`（不變） | 無新遷移；公開評論列表 CWE-400 資源預算防護、單層游標分頁與獨立讀取頻控。 |
| **`v0.1.8`** | `v7` | `sites` 表新增 `smoji_enabled` 與 `smoji_manifest_url`，支援站點級表情包。 |
| **`v0.1.7`** | `v6`（不變） | 不改變 Schema；建置工具鏈升級、多語言文件體系落地。 |
| **`v0.1.6`** | `v6`（不變） | 不改變 Schema；Cap instrumentation 所需動態 CSP 策略調整。 |
| **`v0.1.5`** | `v6` | `turnstile_settings` 表原位重命名為 `captcha_settings`，新增自託管 Cap 支援。 |
| **`v0.1.4`** | `v5`（不變） | 不改變 Schema；管理後台儲存站長口令時自動回填歷史評論 `is_blogger` 標記。 |
| **`v0.1.3`** | `v5` | `sites` 表增加 `blogger_passphrase_hash`；`comments` 表增加 `is_blogger`；Outbox 拆行。 |
| **`v0.1.2`** | `v4`（不變） | 不改變 Schema；優化評論區字型階梯與基線對齊。 |
| **`v0.1.1`** | `v4`（不變） | 不改變 Schema；評論折疊按鈕固定 3ch 等寬。 |
| **`v0.1.0`** | `v4` | 首個正式發布版本；多站點純文字評論模型、墓碑軟刪除、通知與 Turnstile。 |
| **更早候選版** | `v1`～`v4` | RC 候選階段：單容器架構演進、SQLite WAL 模式引入與時區規範。 |

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
