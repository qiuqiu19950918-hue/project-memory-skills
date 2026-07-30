---
name: project-memory-compact
description: "Use when user invokes /pmem, asks about cross-module impact of a code change, or when development work involves new entities/tables, new foreign key or implicit relationships, special business rules, non-standard API response formats, or cross-module implicit dependencies. Maintains a versioned structured knowledge base at .zcode_skills_temp/.aiknowledge/ mapping code entities, relationships, business rules, and API contracts. Optimized for LOW TOKEN USAGE: loads a lightweight index on first turn, then fetches individual entity definitions on demand via precise file+line anchors. Actively checks for external changes each turn. For token-billed models (e.g. DeepSeek). Code is the single source of truth."
---

# Project Memory — AI 的项目长期记忆（token 最少变体）

Maintain a structured, versioned knowledge base that gives AI a long-term map of a project's data model, relationships, business rules, and API contracts.

## This Variant — Minimum Token Usage

This is the **token-minimal** variant. It assumes billing is **per input/output token**, so minimizing context size matters more than request count.

**How it minimizes tokens:**
- First turn: load only the **lightweight index** (`INDEX.yaml` — name + table + one-line description per entity, no fields). ~1–2K tokens.
- Query time: fetch ONLY the relevant entity's field definition on demand via its `anchor` (scoped Read of ~20–40 lines). Never load the whole entities.yaml.
- Each continuation turn: actively read `VERSION` (1 request, ~200 tokens) to detect external changes — never misses a pull.

**Trade-off accepted here:** more requests (one per entity lookup, plus a VERSION check each turn) in exchange for far smaller per-request context. This is the right trade for token-billed models.

## Core Principle

**Code is the single source of truth. The knowledge base is a CACHE of the code's structure.** Updates overwrite, never append. Stale data is flagged, not trusted.

## Knowledge Base Layout

All files live under `.zcode_skills_temp/.aiknowledge/`:

```
.zcode_skills_temp/.aiknowledge/
├── VERSION                # ⭐ version fingerprint + recent change list
├── INDEX.yaml             # ⭐⭐ lightweight entity index (this variant loads this, NOT entities.yaml)
├── entities.yaml          # full entity definitions (NOT loaded wholesale; read per-entity via anchor)
├── relationships.yaml     # relationships + dual anchors (loaded wholesale — it's the impact graph)
├── business-rules.md      # business rules + anchors
├── api-contracts.md       # API contracts + anchors
├── sources.yaml           # entry files and scan paths (optional)
└── temp/
    └── drafts/
```

**Key difference from the request-count variant:** this variant loads `INDEX.yaml` + `relationships.yaml` first turn (small), and reads `entities.yaml` **per-entity** via anchors on demand. The full `entities.yaml` is a backing store, not a first-load file.

## The Anchor (the load-bearing mechanism in this variant)

Because this variant does NOT load full entity definitions upfront, anchors are what make on-demand fetch precise:

```yaml
anchor:
  file: src/models/User.ts
  symbol: class User
  lines: "12-48"      # use Read offset/limit to fetch ONLY this region
  hash: 9f8a2c
```

For a field-list query on entity X:
1. Find X in `INDEX.yaml` → get its `anchor`.
2. `Read anchor.file` with offset/limit = `anchor.lines`.
3. Done. ~500 tokens, 1 request — instead of loading 40K-token entities.yaml.

This is exactly how the earlier-identified "anchor redundancy" problem is resolved: in the full-load variant the anchor pointed at content already in context (redundant); here the anchor is the **only** way to get field details, so it is load-bearing, not redundant.

## ⭐ The Load State Machine

Before ANY knowledge-base interaction, run this state check.

### Step 1 — Check for the loaded marker

Scan context for: `[PMEM_LOADED:Vx]`

### Step 2 — Branch by state

```
No marker
  → FIRST-TURN MODE
  → load INDEX.yaml + relationships.yaml + VERSION (small footprint)
  → emit marker

Marker found
  → CONTINUATION MODE
  → ACTIVE CHANGE CHECK: read VERSION (1 request) — compare loaded_version to marker
       match   → in sync, zero further load
       mismatch → read only the VERSION.recent_changes listed entries (per-entity, via anchor)
```

### Why active check each turn (this variant's choice)
This variant accepts the extra 1 request/turn for the VERSION read because:
- Token-billed models don't mind the small ~200-token VERSION read.
- It never misses an external `git pull` — robustness over request count.
- Contrast with the request-count variant, which checks passively only when the user signals.

### FIRST-TURN MODE

1. **One Bash call** to load the lightweight set:
   ```bash
   cat .zcode_skills_temp/.aiknowledge/VERSION \
       .zcode_skills_temp/.aiknowledge/INDEX.yaml \
       .zcode_skills_temp/.aiknowledge/relationships.yaml
   ```
   - If `INDEX.yaml` is missing → generate it from `entities.yaml` (see `references/indexing-protocol.md`), or run `/pmem sync` if entities.yaml also missing.
2. Get HEAD (combine with above):
   ```bash
   git rev-parse --short HEAD 2>/dev/null || echo "no-git"
   ```
3. Compare `code_fingerprint` to HEAD. Note staleness if mismatch.
4. Display status summary.
5. Emit marker `[PMEM_LOADED:Vx]`.

### CONTINUATION MODE

1. **Always** read `VERSION` (1 request, ~200 tokens).
2. Compare `loaded_version` to the marker in context.
3. Match → do nothing more. Answer from index + relationships + previously-fetched entities.
4. Mismatch → for each line in `VERSION.recent_changes`, fetch the named entity via its anchor (scoped Read). Do NOT reload wholesale.
5. Re-emit marker with the new version.

**Self-written archives are never re-read** — they're already in context. Just bump the marker.

## On-Demand Fetch Protocol (the heart of token saving)

When the user asks about entity X's fields/structure (NOT just its existence):

1. Look up X in the in-context `INDEX.yaml` → get `anchor`.
2. `Read anchor.file` at `anchor.lines` → get the full field list for X only.
3. Cache mentally: if the same entity is asked again this window, don't re-Read.

When the user asks about relationships/impact:
- Answer from the in-context `relationships.yaml` (loaded first turn). Usually zero extra reads.

When the user asks about a business rule / API contract detail:
- The summary in business-rules.md / api-contracts.md may suffice (loaded on demand). Only `Read` the anchor if implementation detail is needed.

## Update Criteria

### ✅ MUST Record (each WITH an anchor) — same as the request-count variant

| # | Trigger | File | Also update INDEX? |
|---|---------|------|---|
| 1 | Entity/table change | `entities.yaml` | ✅ Yes — keep INDEX in sync |
| 2 | New/changed relationship | `relationships.yaml` | — |
| 3 | Special business rule | `business-rules.md` | — |
| 4 | API format divergence | `api-contracts.md` | — |
| 5 | Cross-module implicit dependency | `relationships.yaml` | — |

**Critical:** whenever entities.yaml changes, `INDEX.yaml` MUST be regenerated/updated (see `references/indexing-protocol.md`). A stale INDEX breaks on-demand fetch.

### ❌ Do NOT Record — same as the other variant.

See `references/update-checklist.md`.

## Commands

### `/pmem`
Run the Load State Machine. First turn → load index+relationships+VERSION. Continuation → active VERSION check.

### `/pmem check`
Read VERSION + HEAD (1 request). Report staleness. Read-only.

### `/pmem sync`
Full rebuild from current code:
1. Scan model/entity/ORM/migration files.
2. Extract entities + relationships + business rules + non-standard APIs.
3. Write to files WITH fresh anchors.
4. **Regenerate `INDEX.yaml`** from entities.yaml.
5. Bump `loaded_version` in VERSION, set `code_fingerprint` to HEAD, append changes.
6. Display updated status summary.
7. Emit new marker.

⚠️ `sync` overwrites — including drafts. Use `verify` to preserve drafts.

### `/pmem verify`
Incremental repair:
1. Walk every entry in entities.yaml.
2. Missing/stale anchor → locate in code, add/refresh (self-heal).
3. Not found → flag for review.
4. **Re-sync INDEX.yaml** to match entities.yaml.
5. Bump `loaded_version` if anything changed.
6. Output diff. Drafts preserved.

## Update Mechanism

1. Read the current file first (Read before Edit/Write).
2. Precisely replace the target entry — overwrite, never append.
3. Always write/update the anchor.
4. **If entities.yaml changed → regenerate INDEX.yaml.**
5. Update VERSION: bump `loaded_version`, append to `recent_changes` (max 10).
6. Clean up confirmed `temp/drafts/`.

## Forced Archiving + Marker

<HARD-GATE>
After EVERY turn touching code or the knowledge base, output BOTH:
1. The knowledge base update summary (even if "no change").
2. The load marker `[PMEM_LOADED:Vx]` reflecting the CURRENT version.

Without the marker, the next turn reloads the index from scratch. NEVER omit it.
</HARD-GATE>

Same formats as the request-count variant (see that variant's SKILL.md "Forced Archiving" for the literal block). On version bump → `Vx+1`.

## Multi-Machine Collaboration

INDEX.yaml + VERSION + all knowledge files are committed. When pulling:
- VERSION's `code_fingerprint` tells if code moved.
- INDEX.yaml gives the fresh lightweight map without forcing a full entities.yaml load.

## Status Summary Format

```
📚 项目知识库已加载 [PMEM_LOADED:Vx]（精简索引模式）
- 实体索引：N 个（字段按需读取）
- 关系：N 条（已全量加载）
- 业务规则：N 条（按需读取）
- 接口约定：N 条（按需读取）
- 基于代码版本：<fingerprint>（<HEAD 或 stale>）
```

## Quick Reference

| Command | Purpose | Requests |
|---------|---------|----------|
| `/pmem` | Activate via state machine | 1 (first: index+rels+VERSION via cat) / 1 (continuation: VERSION) |
| `/pmem check` | Staleness report | 1 |
| `/pmem verify` | Incremental repair + INDEX resync | varies |
| `/pmem sync` | Full rebuild + INDEX regen | varies |

| Scenario | Action | Tokens |
|----------|--------|--------|
| New window, first turn | Load INDEX+relationships+VERSION | ~1-3K |
| Same window, later turn | Read VERSION (active check) | ~200 |
| Query entity X fields | Read X's anchor only | ~500 |
| Query impact of X | From in-context relationships | ~0 extra |
| User pulled external change | Read VERSION + changed anchors | small |
| Self-written archive | Nothing | 0 |

## References

- `references/indexing-protocol.md` — how INDEX.yaml is structured and regenerated from entities.yaml.
- `references/retrieval-protocol.md` — hash strategy, fallback ladder, commit rules.
- `references/templates/` — annotated templates (with anchor fields).
- `references/update-checklist.md` — per-scenario update criteria + anchor maintenance.
