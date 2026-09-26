# Upgrades & Schema Migrations

Ecoku employs a versioned, in-place, and strictly transactional SQLite schema migration system.

**[v0.2.5](./upgrades/v0.2.5)** was released on 2026-09-26: paper-and-ink default comment styles, host-overridable variables, and `auto` following the host light/dark mode; schema stays at v8.

Review the version-specific configuration changes before upgrading. Set the exact Compose image tag; startup applies database migrations in order.

---

## Core Upgrade Contracts

1. **Unidirectional Transactional Migrations**: Schema migrations run forward sequentially on your SQLite file, appending version records to `schema_migrations` upon success. Ecoku **does not support automated down-migrations**.
2. **Strictly Prohibited Floating Tags**: Never use `latest` in production. Always specify an exact semantic tag like `v0.2.5`.
3. **Irreversibility & Rollback Principle**: Once the database upgrades to a higher schema version (e.g. v8), **you cannot simply revert the image tag**, as older binaries refuse to boot against newer schemas. Rollbacks strictly require restoring the pre-upgrade cold backup.

---

## Standard Cold Upgrade SOP

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

## Schema Evolution History

| Image Version | Schema Version | Core Database Changes & Highlights |
| :--- | :---: | :--- |
| **`v0.2.5`** | `v8` (unchanged) | No migration; default comment styles with overridable variables, and Turnstile Siteverify rejects redirects. |
| **`v0.2.4`** | `v8` | `admin_sessions` |
| **`v0.1.9`** | `v7` (unchanged) | No migration; CWE-400 resource budget protection, single-layer cursor pagination, and dedicated read rate limiting. |
| **`v0.1.8`** | `v7` | Added `smoji_enabled` (boolean) and `smoji_manifest_url` (TEXT) to `sites` for site-level sticker packs. |
| **`v0.1.7`** | `v6` (unchanged) | No schema change; toolchain upgrades, multilingual documentation architecture, and CI image optimizations. |
| **`v0.1.6`** | `v6` (unchanged) | No schema change; dynamic CSP adjustments for Cap client instrumentation scripts. |
| **`v0.1.5`** | `v6` | Renamed `turnstile_settings` to `captcha_settings`, added `provider` and self-hosted Cap configuration fields. |
| **`v0.1.4`** | `v5` (unchanged) | No schema change; blogger passphrase save automatically backfills `is_blogger` flag on historical comments. |
| **`v0.1.3`** | `v5` | Added `sites.blogger_passphrase_hash`, `comments.is_blogger`, and split outbox queue by target recipient. |
| **`v0.1.2`** | `v4` (unchanged) | No schema change; comment header metadata typography baseline alignment and 14px type scale. |
| **`v0.1.1`** | `v4` (unchanged) | No schema change; 3ch fixed-width comment collapse toggles (`[+]`/`[-]`) to eliminate jitter. |
| **`v0.1.0`** | `v4` | Initial release; multi-site comment model, tombstones, notifications, and Cloudflare Turnstile. |
| **Earlier** | `v1`–`v4` | Pre-release candidates: single-container architecture, SQLite WAL mode, and timezone normalization. |

---

## Historical Upgrade Guide Index

| Version | Release Date | Schema | Upgrade Highlights & Notes |
| :--- | :--- | :---: | :--- |
| [**v0.2.5**](./upgrades/v0.2.5) | 2026-09-26 | v8 (unchanged) | Paper-and-ink default comment styles; overridable variables; `auto` follows the host. |
| [**v0.2.4**](./upgrades/v0.2.4) | 2026-09-16 | v7 → v8 | HttpOnly cookie + SQLite revocable session |
| [**v0.2.3**](./upgrades/v0.2.3) | 2026-09-16 (tag) | v7 (unchanged) | Audit fixes for identity, notifications, imports and clients. |
| [**v0.2.2**](./upgrades/v0.2.2) | 2026-09-13 | v7 (unchanged) | Fixed Smoji picker layout on narrow screens. |
| [**v0.2.1**](./upgrades/v0.2.1) | 2026-09-12 | v7 (unchanged) | Larger Smoji manifests and compact `base` template support. |
| [**v0.2.0**](./upgrades/v0.2.0) | 2026-09-12 | v7 (unchanged) | Documentation, integration examples, and API reference corrections. |
| [**v0.1.9**](./upgrades/v0.1.9) | 2026-08-31 | v7 (unchanged) | CWE-400 mitigation; backward-compatible configs, note large thread read budget limits and rollback steps. |
| [**v0.1.8**](./upgrades/v0.1.8) | 2026-08-27 | v6 → v7 | Smoji plaintext sticker packs; site-level sticker toggle and manifest URL. |
| [**v0.1.7**](./upgrades/v0.1.7) | 2026-08-26 | v6 | Build toolchain upgrades and multilingual documentation site; runtime contracts unchanged. |
| [**v0.1.6**](./upgrades/v0.1.6) | 2026-08-18 | v6 | Optimized dynamic CSP evaluation policies for Cap client in the admin console. |
| [**v0.1.5**](./upgrades/v0.1.5) | 2026-08-17 | v5 → v6 | Introduced self-hosted Cap CAPTCHA; upgraded security settings to tri-state selector. |
| [**v0.1.4**](./upgrades/v0.1.4) | 2026-08-15 | v5 | Admin console automatically backfills `is_blogger` flag on existing comments when saving passphrase. |
| [**v0.1.3**](./upgrades/v0.1.3) | 2026-08-15 | v4 → v5 | Added blogger passphrase authentication; outbox notification queue split per recipient. |
| [**v0.1.2**](./upgrades/v0.1.2) | 2026-08-15 | v4 | Refined comment metadata typography baseline alignment and size hierarchy. |
| [**v0.1.1**](./upgrades/v0.1.1) | 2026-08-15 | v4 | Fixed comment collapse buttons (`[+]`/`[-]`) to 3ch monospace width, eliminating layout shifts. |
| [**v0.1.0**](./upgrades/v0.1.0) | 2026-08-15 | v4 | First official production release. |
| [**Earlier**](./upgrades/earlier) | 2026-08-14 | v1–v4 | Early single-container design, SQLite WAL mode, and timezone standards. |

## v0.2.5 compatibility

Schema stays at v8 with no new migration. Configuration keys, environment variables, Compose mounts and password hashes are unchanged, so v0.2.4 upgrades in place and rolling back to v0.2.4 normally only needs the old image tag. The default comment styles change with the image and existing override CSS may stack on the new defaults; check each embedding site in light and dark mode after upgrading. See [Upgrading to v0.2.5](./upgrades/v0.2.5).
