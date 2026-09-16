# 升級與遷移

Ecoku 採用版本化、原位（In-Place）、交易性的 SQLite Schema 遷移體系。

**[v0.2.4](./upgrades/v0.2.4)** 已於 2026-09-16 發佈：安全修復、可撤銷管理員會話與回覆深度限制，schema v7 → v8。

升級前核對對應版本的設定相容性。修改 Compose 精確鏡像 tag 後，服務啟動時按版本順序執行資料庫遷移。

---

## 升級核心契約

1. **單向交易遷移**：Schema 遷移在同一個 SQLite 檔案中順序向上執行，成功後向 `schema_migrations` 表追加版本記錄。Ecoku **不支援自動向下遷移（Down-migration）**。
2. **嚴禁浮動標籤**：生產環境絕對禁止使用 `latest`，必須使用形如 `v0.2.4` 的精確發布版本。
3. **不可逆性與回滾原則**：一旦資料庫成功升級至高版本 Schema（例如 v8），**不能僅將映像檔標籤換回舊版本**，否則舊版本服務因無法識別高版本 Schema 會拒絕啟動。回滾必須使用升級前冷備份的資料庫檔案進行復原。

---

## 標準停服升級 SOP

```bash
(
set -eu
umask 077
cd "$HOME/Ecoku"
install -d -m 700 "$HOME/backups"
sudo docker compose down
archive="$HOME/backups/ecoku-$(date +%Y%m%d_%H%M%S).tar.gz"
[ ! -e "$archive" ]
sudo tar -czf - data/ app/config.yaml ecoku.env compose.yaml > "$archive"
contents=$(tar -tzf "$archive")
for required in data/ecoku.sqlite3 app/config.yaml ecoku.env compose.yaml; do
  printf '%s\n' "$contents" | grep -Fx "$required" > /dev/null
done
printf 'Verified backup: %s\n' "$archive"
vi app/config.yaml compose.yaml
sudo docker compose pull && sudo docker compose up -d
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
)
```

---

## Schema 版本演進歷史

| 映像檔版本 | Schema 版本 | 核心資料庫變更與特性 |
| :--- | :---: | :--- |
| **`v0.2.4`** | `v8` | `admin_sessions` |
| **`v0.1.9`** | `v7`（不變） | 不新增遷移；公開評論列表 CWE-400 資源預算防護、單層游標分頁與獨立列表讀取頻控。 |
| **`v0.1.8`** | `v7` | `sites` 表新增 `smoji_enabled` (布林) 與 `smoji_manifest_url` (TEXT)，支援站點級表情包。 |
| **`v0.1.7`** | `v6`（不變） | 不改變 Schema；建置工具鏈升級、多語言文件體系落地與 CI 映像檔建置優化。 |
| **`v0.1.6`** | `v6`（不變） | 不改變 Schema；修復 Cap instrumentation 腳本所需動態 CSP 策略。 |
| **`v0.1.5`** | `v6` | `turnstile_settings` 表原位重命名為 `captcha_settings`，新增 `provider` 及自託管 Cap 相關設定欄位。 |
| **`v0.1.4`** | `v5`（不變） | 不改變 Schema；後台儲存站長通關密語時自動回填歷史所有未刪除評論的 `is_blogger` 標記。 |
| **`v0.1.3`** | `v5` | `sites` 表增加 `blogger_passphrase_hash`；`comments` 表增加 `is_blogger`；`notification_outbox` 拆為每接收目標單行。 |
| **`v0.1.2`** | `v4`（不變） | 不改變 Schema；優化評論區暱稱排版基線對齊與 14px 字級階梯。 |
| **`v0.1.1`** | `v4`（不變） | 不改變 Schema；評論折疊按鈕 `[+]`/`[-]` 提高優先級並固定 3ch 等寬。 |
| **`v0.1.0`** | `v4` | 首個正式發布版本；多站點純文字評論模型、墓碑軟刪除、通知設定與 Cloudflare Turnstile 支援。 |
| **更早候選版** | `v1` ～ `v4` | RC 候選階段：單容器極簡架構演進、SQLite WAL 模式引入與時區支援。 |

---

## 歷史版本升級指南索引

| 版本 | 發布日期 | Schema 變化 | 升級要點與說明 |
| :--- | :--- | :---: | :--- |
| [**v0.2.4**](./upgrades/v0.2.4) | 2026-09-16 | v7 → v8 | HttpOnly Cookie + SQLite 可撤銷會話 |
| [**v0.2.3**](./upgrades/v0.2.3) | 2026-09-16 (tag) | v7（不變） | 身分、通知、匯入與客戶端審計修復。 |
| [**v0.2.2**](./upgrades/v0.2.2) | 2026-09-13 | v7（不變） | 修復 Smoji 選擇器在窄螢幕下的版面問題。 |
| [**v0.2.1**](./upgrades/v0.2.1) | 2026-09-12 | v7（不變） | Smoji 清單容量提升與精簡 `base` 模板支援。 |
| [**v0.2.0**](./upgrades/v0.2.0) | 2026-09-12 | v7（不變） | 文件、接入範例與 API 參考事實校正和完善。 |
| [**v0.1.9**](./upgrades/v0.1.9) | 2026-08-31 | v7（不變） | CWE-400 修復；舊設定可啟動，大討論串讀取和明確新設定鍵的回滾需留意。 |
| [**v0.1.8**](./upgrades/v0.1.8) | 2026-08-27 | v6 → v7 | 新增 Smoji 純文字表情包；站點新增表情包開關與清單 URL。 |
| [**v0.1.7**](./upgrades/v0.1.7) | 2026-08-26 | v6 | 建置工具鏈升級與多語言文件體系落地；執行期契約保持不變。 |
| [**v0.1.6**](./upgrades/v0.1.6) | 2026-08-18 | v6 | 優化 Cap 客戶端在管理端所需的動態 CSP 求值策略。 |
| [**v0.1.5**](./upgrades/v0.1.5) | 2026-08-17 | v5 → v6 | 引入自託管 Cap 人機驗證；安全設定升級為三態單選。 |
| [**v0.1.4**](./upgrades/v0.1.4) | 2026-08-15 | v5 | 管理後台儲存站長通關密語時自動回填歷史評論的 `is_blogger` 標記。 |
| [**v0.1.3**](./upgrades/v0.1.3) | 2026-08-15 | v4 → v5 | 引入站長通關密語認證；Outbox 通知佇列按接收目標拆行入隊。 |
| [**v0.1.2**](./upgrades/v0.1.2) | 2026-08-15 | v4 | 優化評論區元資訊排版基線與字級階梯。 |
| [**v0.1.1**](./upgrades/v0.1.1) | 2026-08-15 | v4 | 評論折疊按鈕 `[+]`/`[-]` 固定為 3ch 等寬，消除折疊切換抖動。 |
| [**v0.1.0**](./upgrades/v0.1.0) | 2026-08-15 | v4 | 首個正式發布版本。 |
| [**更早候選版**](./upgrades/earlier) | 2026-08-14 | v1 ～ v4 | 早期單容器架構設計、WAL 模式引入與時區規範。 |

## v0.2.4 相容性

v8 新增 `admin_sessions` 表及到期索引，不改寫留言、設定或既有遷移記錄。舊登入失效，必須重新登入。`admin.token_ttl_minutes` 請省略或設為 480；除 `0` 與 `480` 外的其他舊值會阻止啟動。掛載、環境變數及密碼雜湊不變。回滾至 v0.2.3 或更早版本，必須停服並保留現場，再恢復升級前完整冷備份與原鏡像；僅換舊 tag 無法開啟 v8 資料庫。恢復備份會失去備份後的寫入，須由操作者明確接受。
