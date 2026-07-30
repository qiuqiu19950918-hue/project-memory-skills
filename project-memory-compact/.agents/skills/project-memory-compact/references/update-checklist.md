# Update Criteria — Detailed Checklist

Use this reference when unsure whether a code change warrants a knowledge base update.

---

## ✅ MUST Record — Detailed Scenarios

### 1. Entity / Table Changes — ⚠️ also update INDEX.yaml

| Scenario | Record? | What to record |
|----------|---------|---------------|
| New table created | ✅ Yes | Entity + anchor in entities.yaml, AND add a matching index entry (name/table/desc/anchor) in INDEX.yaml |
| Existing table gets a new FK column | ✅ Yes | Add field, refresh anchor, add relationship entry |
| Primary key changes | ✅ Yes | Update PK, refresh anchor, check referencing relationships |
| Unique constraint added/removed | ✅ Yes | Update metadata, refresh hash |
| Table renamed | ✅ Yes | Update name, fix references, refresh anchors, update INDEX |
| Table deleted | ✅ Yes | Remove entity + INDEX entry + all relationships |

> **Rule of thumb:** any entities.yaml change ⇒ INDEX.yaml change. They are a pair.

### 2. Relationship Changes

| Scenario | Record? | What to record |
|----------|---------|---------------|
| New foreign key | ✅ Yes | from → to, type, cascade, via, dual anchors |
| FK cascade changes | ✅ Yes | Update cascade, refresh both anchors' hash |
| New many-to-many via join table | ✅ Yes | Both directions + join-table anchor |
| New implicit relationship | ✅ Yes | Mark `type: implicit`, anchor the field |
| Relationship removed | ✅ Yes | Delete entry + anchors |

### 3. Business Rules

| Scenario | Record? | What to record |
|----------|---------|---------------|
| Mutual exclusion constraint | ✅ Yes | Rule + anchor to enforcement function |
| Non-trivial state machine | ✅ Yes | Transitions + anchor |
| Pre-deletion check | ✅ Yes | Condition + anchor |
| Conditional field requirement | ✅ Yes | Condition + anchor |

### 4. API Contracts

| Scenario | Record? | What to record |
|----------|---------|---------------|
| Nested sub-resources in response | ✅ Yes | Path, format, example, anchor |
| Flat response combining multiple tables | ✅ Yes | Field origins, anchor |
| Non-standard param assembly | ✅ Yes | How params assembled, anchor |

### 5. Cross-Module Implicit Dependencies

| Scenario | Record? | What to record |
|----------|---------|---------------|
| Module A reads Module B's entity ID | ✅ Yes | Dependency, field, anchor in A |
| Denormalized field from another table | ✅ Yes | Source, sync strategy, anchor |

---

## ❌ Do NOT Record

| Scenario | Why not |
|----------|---------|
| Standard single-table CRUD | No cross-table logic |
| Adding a remark/note field (no relations) | No relational impact |
| Changing a display label | Pure UI/UX |
| Adding a filter option | Standard pattern |
| CSS/style changes | No data flow impact |
| Internal refactor without structural change | Tracks structure, not style |
| Adding a DB index | Performance, not structural |

---

## Anchor Maintenance Rules

### When to UPDATE an anchor
Any time you edit the code region an anchor points to:
- Lines added/removed above → recompute `lines` (in BOTH entities.yaml and INDEX.yaml).
- Symbol's body changed → recompute `hash` (in BOTH).
- Symbol renamed → update `symbol` (in BOTH).
- File moved → update `file` (in BOTH).

> **Critical for this variant:** an anchor appears in TWO places (entities.yaml AND INDEX.yaml). When healing, update BOTH. A stale INDEX anchor sends on-demand fetch to the wrong place.

### When to RELOCATE (self-heal)
If `hash` mismatches or `lines` no longer contains `symbol`:
1. One scoped `Grep` for `anchor.symbol`.
2. Read the hit, determine new line range.
3. Rewrite anchor in entities.yaml AND INDEX.yaml.
4. Bump loaded_version.

---

## Version Bumping

Every archive write bumps `VERSION.loaded_version`:
- Write/update entry (+ INDEX if entity).
- `loaded_version`: V3 → V4.
- Append one line to `recent_changes` (max 10).
- Emit `[PMEM_LOADED:V4]` at end of turn.

---

## Self-Heal Closed Loop

```
anchor stale (found during on-demand fetch)?
  → grep symbol (scoped, 1 search)
  → Read to confirm
  → REWRITE anchor in entities.yaml AND INDEX.yaml
  → bump loaded_version
  → next turn: marker shows new version
```

Without rewriting + bumping, the next fetch hits the same stale anchor. Always close the loop.
