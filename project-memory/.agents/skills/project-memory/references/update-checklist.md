# Update Criteria — Detailed Checklist

Use this reference when unsure whether a code change warrants a knowledge base update.

---

## ✅ MUST Record — Detailed Scenarios

### 1. Entity / Table Changes

| Scenario | Record? | What to record |
|----------|---------|---------------|
| New table created | ✅ Yes | Entity name, table name, all fields, primary key, AND a fresh anchor |
| Existing table gets a new FK column | ✅ Yes | Add field, refresh anchor's `lines`, AND add a relationship entry |
| Primary key changes | ✅ Yes | Update PK, refresh anchor, check referencing relationships |
| Unique constraint added/removed | ✅ Yes | Update field metadata, refresh anchor's `hash` |
| Table renamed | ✅ Yes | Update name, fix references, refresh anchors |
| Table deleted | ✅ Yes | Remove entity + all relationships |

### 2. Relationship Changes

| Scenario | Record? | What to record |
|----------|---------|---------------|
| New foreign key | ✅ Yes | from → to, type, cascade, via, AND dual anchors |
| FK cascade changes | ✅ Yes | Update cascade, refresh both anchors' `hash` |
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
- Lines added/removed above → recompute `lines`.
- Symbol's body changed → recompute `hash`.
- Symbol renamed → update `symbol`.
- File moved → update `file`.

### When to RELOCATE (self-heal)
If `hash` mismatches or `lines` no longer contains `symbol`:
1. One scoped `Grep` for `anchor.symbol`.
2. Read the hit, determine new line range.
3. Rewrite anchor immediately.

---

## Version Bumping (this variant)

Every archive write must bump `VERSION.loaded_version`:
- Write/update entry in entities/relationships/etc.
- `loaded_version`: V3 → V4
- Append one line to `recent_changes` (max 10, drop oldest)
- Emit `[PMEM_LOADED:V4]` at end of turn

**Why bump every time:** the marker carries version forward across turns. A bump signals "the KB changed this turn" so the next turn knows the latest state. Even single-entry edits bump — versioning is per-write, not per-entity.

---

## Self-Heal Closed Loop

```
anchor stale?
  → grep symbol (scoped, 1 search)
  → Read to confirm
  → REWRITE anchor (file/line/symbol/hash)
  → bump loaded_version
  → next turn: marker shows new version, no reload
```

Without rewriting + bumping, drift accumulates and the next turn reloads everything. Always close the loop.
