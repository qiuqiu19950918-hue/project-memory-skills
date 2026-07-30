---
name: project-memory
description: "Use when user invokes /pmem, asks about cross-module impact of a code change, or when development work involves new entities/tables, new foreign key or implicit relationships, special business rules, non-standard API response formats, or cross-module implicit dependencies. Maintains a versioned structured knowledge base at .zcode_skills_temp/.aiknowledge/ mapping code entities, relationships, business rules, and API contracts — each entry carries a precise file+line anchor. Optimized for MINIMUM REQUEST COUNT: full first-load then zero re-loads within the same window via an in-context version marker. Code is the single source of truth."
---

# Project Memory — AI 的项目长期记忆（请求次数最少变体）

Maintain a structured, versioned knowledge base that gives AI a long-term map of a project's data model, relationships, business rules, and API contracts.

## This Variant — Minimum Request Count

This is the **request-count-minimal** variant. It assumes the billing unit is **per request**, and context size per request is not the bottleneck (e.g. 1M-token-window models billed per request).

**How it minimizes requests:**
- First turn of a new window: full load (necessary, to build complete project understanding).
- **All subsequent turns in the SAME window: ZERO reload.** Context is cumulative — what was loaded stays loaded. Never re-Read knowledge files just because a new turn started.
- External changes (git pull) detected only passively (when the user signals an update).

## Core Principle

**Code is the single source of truth. The knowledge base is a CACHE of the code's structure.** Updates overwrite, never append. Stale data is flagged, not trusted.

## Knowledge Base Layout

All files live under the project root at `.zcode_skills_temp/.aiknowledge/`:

```
.zcode_skills_temp/.aiknowledge/
├── VERSION                # ⭐ version fingerprint + recent change list (loaded first)
├── entities.yaml          # Entity definitions (tables, fields, primary keys) + anchors
├── relationships.yaml     # Relationships (FK, implicit chains, cascade) + dual anchors
├── business-rules.md      # Special business rules + anchors
├── api-contracts.md       # API response formats + anchors
├── sources.yaml           # Entry files and scan paths (optional)
└── temp/                  # Temporary working files (gitignored)
    └── drafts/            # Draft rules awaiting user confirmation
```

Every knowledge entry carries an **anchor** (file + line + symbol + hash).

## ⭐ The Load State Machine (most important section)

Before ANY knowledge-base interaction, run this state check. **It costs zero requests** — it only inspects the current conversation context.

### Step 1 — Check for the loaded marker

Scan the conversation context for a marker line of the form:
```
[PMEM_LOADED:Vx]
```

### Step 2 — Branch by state

```
No [PMEM_LOADED:Vx] marker found
  → FIRST-TURN MODE (see below)
  → full load, then emit marker at end of turn

[PMEM_LOADED:Vx] marker found
  → CONTINUATION MODE (see below)
  → zero reload by default
```

### FIRST-TURN MODE (new window / first load)

Goal: build complete project understanding in the fewest requests.

1. **One Bash call** to load ALL knowledge files at once (this is the request-count killer move):
   ```bash
   cat .zcode_skills_temp/.aiknowledge/VERSION \
       .zcode_skills_temp/.aiknowledge/entities.yaml \
       .zcode_skills_temp/.aiknowledge/relationships.yaml \
       .zcode_skills_temp/.aiknowledge/business-rules.md \
       .zcode_skills_temp/.aiknowledge/api-contracts.md \
       .zcode_skills_temp/.aiknowledge/sources.yaml
   ```
   - If VERSION is missing or `.aiknowledge/` doesn't exist → this is a new project: read `references/templates/` and initialize from current code (see `/pmem sync` flow), then create VERSION.
   - This single `cat` replaces 5 separate Read calls → **5 requests collapse to 1**.
2. **One Bash call** to get the code version (if git available):
   ```bash
   git rev-parse --short HEAD 2>/dev/null || echo "no-git"
   ```
   (Can be combined with the cat above using `;` to stay at 1 request total.)
3. Compare VERSION's `code_fingerprint` with HEAD. If mismatch → note "possibly stale" in the summary.
4. Display the status summary (format below).
5. **Emit the marker** at the end of the turn inside the mandatory archiving block (see Forced Archiving).

### CONTINUATION MODE (same window, later turns)

**Default action: do NOTHING. Zero requests.** The context already holds the full knowledge base from the first turn.

Reasoning: context is cumulative. Re-reading would only duplicate content already present — pure waste.

**The ONLY three triggers that break zero-reload:**

| Trigger | What to do | Cost |
|---------|-----------|------|
| User explicitly signals external change ("I pulled", "更新了", "sync 了别人的代码") | Read ONLY `VERSION` (1 request). If `loaded_version` matches the context's marker → still in sync, do nothing more. If different → read `VERSION.recent_changes` listed blocks only. | 1 request |
| User invokes `/pmem sync` or `/pmem verify` (explicit rebuild) | Run that command's full flow. | per command |
| User invokes `/pmem check` | Read `VERSION` + current HEAD, report staleness. | 1 request |

**Critical rule — self-written archives are NEVER re-read:**
If the archive changes in this window were produced by YOU (the AI wrote them in an earlier turn), those changes are ALREADY in context. Do NOT re-read. Just update the marker's version number and continue.

## The Anchor

Every knowledge entry MUST carry an anchor — a precise physical coordinate into the code:

```yaml
anchor:
  file: src/models/User.ts
  symbol: class User
  lines: "12-48"
  hash: 9f8a2c
```

Anchors make retrieval target specific files instead of broad search. For the detailed retrieval ladder (direct read → scoped grep fallback → self-heal), read `references/retrieval-protocol.md`.

## Retrieval & Impact Analysis

**Retrieval** (answer a question about entity X):
1. Answer directly from the in-context knowledge base if possible — **zero requests**.
2. Only if you must confirm against current source: Read `anchor.file` at `anchor.lines`.

**Impact analysis** ("what does changing X affect?"):
1. From the in-context `relationships.yaml`, find entries where `from == X` or `to == X`.
2. Answer directly — **zero requests** in continuation mode.
3. Deep verification only if the user needs source-level proof.

## Update Criteria

### ✅ MUST Record (mandatory, no exceptions) — each WITH an anchor

| # | Trigger | File |
|---|---------|------|
| 1 | Entity/table change (new table with relations, modified FK/constraints) | `entities.yaml` |
| 2 | New/changed relationship (FK, many-to-many, implicit chain, cascade change) | `relationships.yaml` |
| 3 | Special business rule (mutual exclusion, state machine, pre-deletion check) | `business-rules.md` |
| 4 | API format divergence (nested sub-resources, flattened cross-table, non-standard params) | `api-contracts.md` |
| 5 | Cross-module implicit dependency | `relationships.yaml` |

### ❌ Do NOT Record

- Standard single-table CRUD pages/APIs.
- Pure UI adjustments.
- Simple field additions with no relationship/impact.

See `references/update-checklist.md` for per-scenario guidance.

## Commands

### `/pmem`
Run the Load State Machine. First turn → full load. Continuation → zero reload. Always end by (re)emitting the marker.

### `/pmem check`
Read `VERSION` + current HEAD (1 request). Report staleness. Read-only.

### `/pmem sync`
Force full rebuild from current code:
1. Scan model/entity/ORM/migration files.
2. Extract entities + relationships + business rules + non-standard APIs.
3. Write to files WITH fresh anchors for every entry.
4. **Bump `loaded_version` in VERSION**, set `code_fingerprint` to HEAD, append changes to `recent_changes`.
5. Display updated status summary.
6. Emit new marker `[PMEM_LOADED:Vx+1]`.

⚠️ `sync` overwrites — including drafts in `temp/drafts/`. Use `verify` to preserve drafts.

### `/pmem verify`
Incremental repair (safe default for migrating old knowledge bases):
1. Walk every entry.
2. Missing anchor or hash mismatch → locate in code, add/refresh anchor (self-heal).
3. Not found in code → flag for review (don't auto-delete).
4. **Bump `loaded_version` if any anchor was added/healed.**
5. Output diff. Drafts preserved.

## Update Mechanism

When updating knowledge files:
1. Read the current file first (Read before Edit/Write).
2. Precisely replace the target entry — overwrite, never append history.
3. Always write/update the `anchor` (file/line/symbol/hash).
4. **Update `VERSION`**: bump `loaded_version`, append a one-line summary to `recent_changes` (keep max 10, drop oldest).
5. Clean up confirmed `temp/drafts/` entries.

## Forced Archiving + Marker (mandatory every turn)

<HARD-GATE>
After EVERY turn that touches code or the knowledge base, you MUST output BOTH:
1. The knowledge base update summary (even if "no change").
2. The load marker `[PMEM_LOADED:Vx]` reflecting the CURRENT knowledge-base version.

The marker is the load state — without it, the next turn cannot tell it is in continuation mode and will wastefully reload. NEVER omit it.
</HARD-GATE>

**Format (with changes):**
```
## 📚 知识库更新
- [实体] 新增/修改/删除 XXX（表名）@ file:line
- [关系] 新增/修改/删除 A → B（类型，级联）@ file:line
- [业务规则] 新增/修改/删除：描述 @ file:line
- [接口契约] 新增/修改/删除：路径/格式 @ file:line
- [待确认] 草稿已保存至 temp/drafts/xxx

[PMEM_LOADED:Vx]
```

**Format (no changes):**
```
## 📚 知识库更新
无（本次变更不涉及跨表关系、业务规则或特殊接口格式）

[PMEM_LOADED:Vx]
```

**When this turn bumped the version** (you wrote/updated archive entries), use `Vx+1` and that becomes the new current version. When no version bump, reuse the same `Vx` from context.

## Multi-Machine Collaboration

Knowledge files + VERSION are committed alongside code. `VERSION.loaded_version` + `code_fingerprint` enable precise staleness detection when pulling others' work — only the changed entries need re-examination, not the whole base.

## Status Summary Format

```
📚 项目知识库已加载 [PMEM_LOADED:Vx]
- 实体：N 个
- 关系：N 条
- 业务规则：N 条
- 接口约定：N 条
- 基于代码版本：<fingerprint>（<HEAD 或 stale>）
```

## Quick Reference

| Command | Purpose | Requests |
|---------|---------|----------|
| `/pmem` | Activate via state machine | 0 (continuation) / ~1 (first turn, via cat) |
| `/pmem check` | Staleness report | 1 |
| `/pmem verify` | Incremental repair, preserve drafts | varies |
| `/pmem sync` | Full rebuild (overwrites) | varies |

| Scenario | Action | Requests |
|----------|--------|----------|
| New window, first turn | Full load via cat | ~1 |
| Same window, later turn | Nothing — already loaded | **0** |
| User: "我pull了/更新了" | Read VERSION only | 1 |
| Self-written archive this window | Nothing — already in context | **0** |
| Answer "what does X affect?" | From in-context relationships | **0** |

## References

- `references/retrieval-protocol.md` — hash strategy, fallback ladder, what-to-commit.
- `references/templates/` — annotated templates (with anchor fields) for each knowledge file.
- `references/update-checklist.md` — per-scenario update criteria + anchor maintenance.
