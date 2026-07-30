# Retrieval Protocol — Hash Strategy, Fallback Ladder, Commit Rules

Detailed mechanics behind the Retrieval Protocol in SKILL.md.

---

## Request-Count Logic (this variant's priority)

This variant optimizes for **fewest requests**, not fewest tokens. Therefore:

- Prefer answering **directly from in-context knowledge** (zero requests) over reading source.
- Use a single `cat` of multiple files over many `Read` calls when bulk loading is unavoidable.
- The anchor's job is to make source-level verification a **scoped** 1-request operation when truly needed — not a default step.

---

## Hash Strategy

`anchor.hash` is a short content fingerprint of the anchored code region. It detects "has this definition changed?" without trusting a git commit.

### How to compute
1. Read `anchor.file` at `anchor.lines`.
2. Strip trailing whitespace per line; drop blank lines.
3. Hash (SHA-1/256, first 6–8 hex chars, lowercase).
4. Compare to stored `hash`.

No strict algorithm — only **stability across runs** matters.

### Why not just trust `code_fingerprint` (HEAD)
- HEAD says "repo is at X" — not "this definition changed". One commit can touch 50 files.
- Per-anchor hashes pin staleness to the exact region.

---

## Fallback / Escalation Ladder

When you actually need source-level truth (not the default path here):

| Step | Trigger | Action | Cost |
|------|---------|--------|------|
| 1 | normal | answer from in-context knowledge | 0 |
| 2 | need source proof | `Read anchor.file` at `anchor.lines` | 1 |
| 3 | lines drifted / hash mismatch | `Grep anchor.symbol` in `anchor.file` only | 1 |
| 4 | file moved | `Grep anchor.symbol` repo-wide | 1 |
| 5 | renamed/gone | flag `orphaned`, ask user; do NOT delete | — |

After any step ≥ 3 success → rewrite the anchor (self-heal loop).

---

## What to Commit (multi-machine)

`.zcode_skills_temp/` mixes durable knowledge with ephemeral scratch. Commit selectively:

| Path | Commit? | Why |
|------|---------|-----|
| `.zcode_skills_temp/.aiknowledge/VERSION` | ✅ Yes | Shared version fingerprint — drives state machine |
| `.zcode_skills_temp/.aiknowledge/entities.yaml` | ✅ Yes | Shared knowledge |
| `.zcode_skills_temp/.aiknowledge/relationships.yaml` | ✅ Yes | Shared knowledge |
| `.zcode_skills_temp/.aiknowledge/business-rules.md` | ✅ Yes | Shared knowledge |
| `.zcode_skills_temp/.aiknowledge/api-contracts.md` | ✅ Yes | Shared knowledge |
| `.zcode_skills_temp/.aiknowledge/sources.yaml` | ✅ Yes | Shared knowledge |
| `.zcode_skills_temp/.aiknowledge/temp/` | ❌ No | Machine-local scratch |

**Recommended `.gitignore`:**
```
.zcode_skills_temp/.aiknowledge/temp/
```

---

## The State Machine — why the marker works

The `[PMEM_LOADED:Vx]` marker relies on a property of LLM context: **it is cumulative within a window**. What was loaded in turn 1 is still present in turn 6. So:

- Turn 1 emits the marker after loading.
- Turn 2+ sees the marker → knows the KB is already in context → skips reload.

This converts "reload every turn" into "load once per window". It is the single biggest request-count saving in this variant.

**The marker MUST be emitted every turn** (even "no change" turns), because each turn's context is evaluated independently — if turn N omits the marker, turn N+1 cannot find it and will reload.

---

## VERSION File Contract

`VERSION` is the load state persisted to disk. The in-context marker is the load state within the window.

| Field | Purpose |
|-------|---------|
| `loaded_version` | Monotonically increasing integer (V1, V2, ...). Bumped on every archive write. |
| `code_fingerprint` | Current HEAD short hash (or "no-git"). Compared on `check`. |
| `last_sync` | ISO timestamp of last sync/verify/write. |
| `recent_changes` | Last ≤10 one-line change summaries. Read in continuation mode when external change is signaled. |

**Invariant:** `loaded_version` in VERSION (on disk) and the marker `[PMEM_LOADED:Vx]` (in context) refer to the same logical version. When you bump the disk version, the next marker you emit must use the new number.
