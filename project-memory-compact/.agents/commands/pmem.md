---
description: 激活项目记忆知识库（token 最少变体），支持 check/sync/verify
argument-hint: "[check|sync|verify]"
skills: project-memory-compact
---

Use the `project-memory-compact` skill to handle this request. Arguments: $ARGUMENTS

If no subcommand is given, run the Load State Machine:
- No [PMEM_LOADED:Vx] marker in context → first-turn mode → load INDEX.yaml + relationships.yaml + VERSION (small footprint) via single `cat` → emit marker.
- Marker present → continuation mode → ACTIVE check: read VERSION (1 request), compare loaded_version to marker. Match → zero further load. Mismatch → fetch only the changed entities via their anchors.

Subcommands:
- `check`  — read-only staleness report (VERSION vs current HEAD), 1 request
- `verify` — incremental repair: fill/heal anchors + resync INDEX.yaml, preserve drafts
- `sync`   — full rebuild from current code + regenerate INDEX.yaml (overwrites, including drafts)
