# Indexing Protocol — INDEX.yaml structure & regeneration

This file documents the **lightweight index** that makes the compact variant token-efficient.
INDEX.yaml is a *derived* artifact: it is generated from entities.yaml and must stay in sync with it.

---

## Why an index

`entities.yaml` with 30 entities × full field lists ≈ 40K tokens. Loading it every first turn defeats the purpose of a token-minimal variant.

`INDEX.yaml` strips each entity down to **just enough to route a query** — name, table, one-line description, and the anchor. Field details are fetched on demand via the anchor. Result: ~1–2K tokens for the index vs 40K for the full file.

---

## INDEX.yaml structure

```yaml
# Lightweight entity index — derived from entities.yaml. Do not hand-edit field lists here.
# Regenerate via /pmem sync or /pmem verify. Keep in sync whenever entities.yaml changes.

git_commit: "PLACEHOLDER"

index:
  - name: User
    table: users
    description: "系统用户表，存储登录账户信息"
    anchor:
      file: src/models/User.ts
      symbol: class User
      lines: "12-48"
      hash: 9f8a2c

  - name: Device
    table: devices
    description: "设备表，记录用户持有的硬件设备"
    anchor:
      file: src/models/Device.ts
      symbol: class Device
      lines: "8-34"
      hash: 1c4b77
```

**What is kept:** `name`, `table`, `description`, `anchor`.
**What is stripped:** the full `fields` list (fetched on demand).

---

## Regeneration rules

### When to regenerate
- After EVERY change to `entities.yaml` (add/modify/delete/rename an entity).
- During `/pmem sync` (full rebuild).
- During `/pmem verify` (if any entity anchor was healed/added).
- On first-turn load if `INDEX.yaml` is missing but `entities.yaml` exists.

### How to regenerate (1 Bash + mental pass)
```bash
# Emit just the routing fields per entity — the field lists stay only in entities.yaml.
```
Concretely: for each `- name:` block in entities.yaml, copy `name`, `table`, `description`, `anchor` into a new INDEX.yaml `index` entry. Drop the `fields` list entirely.

### Consistency invariant
Every entity in entities.yaml MUST have exactly one matching entry in INDEX.yaml (by `name`), and vice versa. If they disagree, INDEX.yaml is stale → on-demand fetch may point at the wrong place.

---

## Detecting INDEX staleness

On `/pmem check`, compare:
- entity count in entities.yaml vs INDEX.yaml — must match.
- each entity's `anchor.hash` in INDEX vs entities.yaml — must match.

Mismatch → INDEX is stale → run `/pmem verify` (or `/pmem sync`) to regenerate.

---

## Cost model (why this is worth it)

For a 30-entity project (like the demo knowledge base):

| Approach | First-turn tokens | Per-entity-field-query tokens |
|----------|-------------------|-------------------------------|
| Full entities.yaml load (request-count variant) | ~25K | ~0 (already in context) |
| INDEX.yaml + on-demand anchor read (this variant) | ~1.5K | ~500 (one scoped Read) |

The compact variant pays a ~500-token cost per *new* entity field query, but saves ~23K on first load. For token-billed models where the same entity is rarely re-queried, this is the cheaper path.
