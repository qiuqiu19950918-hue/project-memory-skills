---
description: 激活项目记忆知识库（请求次数最少变体），支持 check/sync/verify
argument-hint: "[check|sync|verify]"
skills: project-memory
---

Use the `project-memory` skill to handle this request. Arguments: $ARGUMENTS

If no subcommand is given, run the Load State Machine:
- No [PMEM_LOADED:Vx] marker in context → first-turn mode → full load via single `cat` → emit marker.
- Marker present → continuation mode → zero reload.

Subcommands:
- `check`  — read-only staleness report (VERSION vs current HEAD), 1 request
- `verify` — incremental repair: fill/heal anchors, preserve drafts (use to migrate old knowledge bases)
- `sync`   — full rebuild from current code (overwrites, including drafts)
