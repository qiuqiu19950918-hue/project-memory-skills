# Retrieval Protocol — Hash Strategy, Fallback Ladder, Commit Rules

Detailed mechanics behind the on-demand fetch protocol in SKILL.md.

---

## Token-Saving Logic (this variant's priority)

This variant optimizes for **smallest context**, not fewest requests. Therefore:

- First turn loads the **lightweight index**, never the full entities.yaml.
- Entity field details are fetched **per-entity via anchor** — scoped Read of the exact line range.
- Relationships ARE loaded wholesale (they're the impact graph and relatively compact), but entities are NOT.
- Active VERSION check each turn (1 small request) guarantees no missed external change.

---

## On-Demand Fetch Ladder

When entity X's structure is needed:

| Step | Trigger | Action | Cost |
|------|---------|--------|------|
| 1 | normal | Read `anchor.file` at `anchor.lines` (from INDEX.yaml) | 1 request, ~500 tokens |
| 2 | lines drifted / hash mismatch | `Grep anchor.symbol` in `anchor.file` | 1 request |
| 3 | file moved | `Grep anchor.symbol` repo-wide | 1 request |
| 4 | renamed/gone | flag `orphaned`, ask user; do NOT delete | — |

After step ≥ 2 success → rewrite the anchor in BOTH INDEX.yaml and entities.yaml (self-heal loop).

**Mental cache rule:** within the same window, once an entity's fields have been fetched, do NOT re-Read them. Reuse the in-context result. (This is what keeps per-query cost bounded across multi-turn exploration of the same entity.)

---

## Hash Strategy

`anchor.hash` is a short content fingerprint of the anchored code region.

### How to compute
1. Read `anchor.file` at `anchor.lines`.
2. Strip trailing whitespace per line; drop blank lines.
3. Hash (SHA-1/256, first 6–8 hex chars, lowercase).
4. Compare to stored `hash`.

### Why per-anchor hash (not just HEAD)
HEAD changes don't tell you which entity definition changed. A controller edit shouldn't invalidate the User entity's anchor. Per-anchor hashes localize staleness to the exact region → only that entity needs re-fetching in continuation mode.

---

## What to Commit

| Path | Commit? | Why |
|------|---------|-----|
| `.zcode_skills_temp/.aiknowledge/VERSION` | ✅ Yes | Version fingerprint |
| `.zcode_skills_temp/.aiknowledge/INDEX.yaml` | ✅ Yes | Lightweight index — this variant's first-load file |
| `.zcode_skills_temp/.aiknowledge/entities.yaml` | ✅ Yes | Full backing store (fetched per-entity) |
| `.zcode_skills_temp/.aiknowledge/relationships.yaml` | ✅ Yes | Impact graph |
| `.zcode_skills_temp/.aiknowledge/business-rules.md` | ✅ Yes | Business rules |
| `.zcode_skills_temp/.aiknowledge/api-contracts.md` | ✅ Yes | API contracts |
| `.zcode_skills_temp/.aiknowledge/sources.yaml` | ✅ Yes | Scan config |
| `.zcode_skills_temp/.aiknowledge/temp/` | ❌ No | Machine-local scratch |

**Recommended `.gitignore`:**
```
.zcode_skills_temp/.aiknowledge/temp/
```

---

## Active VERSION Check (this variant's signature)

Each continuation turn reads VERSION (1 request, ~200 tokens) and compares `loaded_version` to the context marker. This is the trade this variant deliberately accepts:

- **+** Never misses an external `git pull`.
- **+** The ~200-token VERSION read is negligible for token-billed models.
- **−** Costs 1 request per continuation turn (the request-count variant avoids this via passive checking).

When `loaded_version` differs from the marker, read ONLY `VERSION.recent_changes` listed entities (per-anchor fetch), not the whole base.

---

## State Machine — why the marker still works

Same principle as the request-count variant: context is cumulative within a window, so the `[PMEM_LOADED:Vx]` marker carries the load state forward turn-to-turn without reload.

The difference: this variant pairs the marker with an active VERSION read each turn to catch external drift, whereas the request-count variant trusts the marker unless the user signals a pull.

**Marker MUST be emitted every turn** (even "no change") — otherwise the next turn can't find it and reloads the index.
