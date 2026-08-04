---
name: project-memory
description: 项目代码知识图谱记忆系统。将实体/关系/规则/API契约存储为单一 JSON 知识图谱，支持 1-hop 影响分析、冗余镜像（redundant_mirror）检测、hook 驱动的自动归档、浏览器可视化查看（/pmem view）。使用 /pmem 命令管理。
---

# Project Memory · 代码知识图谱

> 把项目里的表、字段、关系、业务规则、API 契约固化为单一 JSON 知识图谱，让 AI 在后续会话中"记得"项目结构，避免反复重新理解。

## 0. 何时触发本 Skill

**自动匹配场景**（无需用户显式调用）：
- 用户询问"改 X 会影响谁" / "X 和 Y 是什么关系" / "这个字段干嘛的"
- 用户要新增表/字段/接口/业务规则，需要确认现有结构
- 用户提到"工单"、"被试件"、"中间表"、"冗余字段"等领域术语，需要查阅图谱

**显式调用**：用户输入 `/pmem <子命令>`（见 commands/pmem.md）。

## 1. 知识库结构

数据目录（用户项目内）：`.zcode_skills_temp/.aiknowledge/`

```
.aiknowledge/
├── knowledge-graph.json    # ⭐ 统一图模型（nodes/edges/rules/contracts/fingerprints）
├── VERSION                 # 版本指纹（loaded_version / schema_version）
├── fingerprints.json       # 文件指纹库（增量更新用）
├── pending-archive.json    # hook 待归档标记（gitignored，自动管理）
└── legacy/                 # 旧 YAML 迁移备份
```

**单一 JSON 承载全部**：实体、关系、规则、契约、指纹都在 `knowledge-graph.json` 一个文件里。不再使用分散的 YAML/MD 文件。

## 2. 图模型速览

详细规范见 `references/graph-protocol.md`。核心结构：

- **nodes[]**：实体节点（id=`entity:<Name>`，含 type/name/summary/tags/layer/anchor/fields）
- **edges[]**：关系边（source/target id + type/via/cascade/weight）
- **rules[]**：业务规则与同步约束（trigger.edge + must_also_update）
- **contracts[]**：API 契约（path/format/special_handling）
- **fingerprints{}**：文件指纹（contentHash + structKeys）

### 边类型（重点关注 redundant_mirror）

| 类别 | type | weight | 场景 |
|---|---|---|---|
| 标准关系 | `one_to_many` 等 | 0.8 | 外键关系 |
| 隐式 | `implicit` | 0.5 | 应用层维护无DB外键 |
| **冗余镜像** | **`redundant_mirror`** | **0.3** | **逗号拼接字段镜像主关系，必须配 sync 规则** |
| 级联 | `cascade_delete` | 0.9 | 删父级自动删子级 |

## 3. Load State Machine（加载状态机）

控制知识图谱的加载时机，避免每轮重复 cat：

```
首轮（上下文无 [PMEM_LOADED:Vx] 标记）:
  → cat .zcode_skills_temp/.aiknowledge/knowledge-graph.json（1 次请求，全图加载）
  → 输出状态摘要 + [PMEM_LOADED:Vx] 标记（x = meta.loaded_version）

续轮（已有 [PMEM_LOADED:Vx] 标记）:
  → 默认 0 请求，图已在上下文
  → 触发重读的情况：
      - 自己刚归档了变更 → 图已更新在上下文，bump 标记为 [PMEM_LOADED:Vx+1]
      - pending-archive.json 存在 → hook 拽回续做，按归档流程处理
      - 用户执行 /pmem sync/check/verify → 按命令流程
```

### 状态标记格式
每轮回复结尾必须输出加载标记：
- 已加载且无变更：`[PMEM_LOADED:V3]`
- 本轮归档了变更：`[PMEM_LOADED:V4]`（bump 后的版本）

## 4. HARD-GATE（强制归档兜底）

**这是双保险中的"软约束"**。hook 是主防线，但 hook 可能未启用或异常，故保留此提示词约束：

```
<HARD-GATE>
每次涉及代码变更的任务结束后，必须判断是否触发归档条件：

【触发归档的条件】（满足任一即触发）：
- 新增/删除/重命名实体（表、类、接口）
- 新增/删除/修改字段（尤其外键字段、ref 引用）
- 新增/删除/修改关系（edges）
- 新增/删除/修改业务规则（rules）
- 发现冗余字段（疑似 redundant_mirror）
- 新增/修改 API 契约（非标准 CRUD 格式）

【不触发归档的情况】：
- 纯 CRUD 业务逻辑（增删改查实现）
- 纯 UI/CSS/样式改动
- 方法体内部逻辑调整（未改签名/字段）
- 注释/文档更新

【若触发】：
1. 读取变更涉及的文件
2. 按 update-checklist.md 流程提取结构
3. 执行"别名归一"（见 graph-protocol.md 第 7 节）后再写入 knowledge-graph.json
4. 检测 redundant_mirror：发现逗号拼接字段（字段名含 Ids/List/集合 且为 String 类型）→ 提示用户确认是否冗余镜像
5. bump meta.loaded_version +1，追加 recent_changes
6. 更新 fingerprints.json（为新/改文件算指纹）
7. 输出归档摘要 + [PMEM_LOADED:Vx+1] 标记

【若未触发】：输出"无结构变更" + [PMEM_LOADED:Vx] 标记
</HARD-GATE>
```

## 5. 自动归档机制（hook 驱动）

**这是双保险中的"硬约束"**。三个 hook 脚本（位于 skill 的 `hooks/` 目录，需安装到用户项目）：

### 5.1 SessionStart hook（session-load.mjs）
会话启动时检测知识图谱是否存在 → 注入"请加载图谱"提示。AI 首轮自动 cat 加载。

### 5.2 PostToolUse hook（post-tool-archive.mjs）
监听 `Write|Edit` 工具。每次写代码文件后：
1. 计算改动文件的指纹（SHA-256 + 正则提取结构签名）
2. 对比 `fingerprints.json`：
   - `NONE`（hash 同）→ 跳过
   - `COSMETIC`（hash 变但结构签名同）→ 跳过（仅内部逻辑变）
   - `STRUCTURAL`（结构签名变）→ 写入 `pending-archive.json` 标记待归档

### 5.3 Stop hook（stop-archive.mjs）
AI 准备结束回复时：
1. 读 `pending-archive.json`
2. 非空 → 输出 `decision:block` 请求 continuation，拽回 AI 继续归档
3. 归档完成（AI 清除 pending-archive.json）后才真正结束
4. 防 3 次以上无限循环

### 5.4 hook 不碰 git（重要边界）
**所有 hook 完全不调用任何 git 命令**（连只读的 git rev-parse 都不碰）。
- 本地开发任务后自动归档：✅ 由 hook 处理
- 跨版本控制同步（pull/commit/push）：❌ 由用户手动 `/pmem sync` 处理

### 5.5 hook 安装
首次使用执行 `/pmem init`，会引导用户把 hook 配置写入项目 `.zcode/config.json`（配置文件方式）或插件目录。详见 commands/pmem.md。

## 6. 别名归一（normalize before write）

写入 knowledge-graph.json 前，必须将 LLM 常见的非规范值归一为规范值。完整别名表见 `references/graph-protocol.md` 第 7 节。常用：

| 规范值 | 常见别名 |
|---|---|
| `one_to_many` | `one-to-many`, `OneToMany`, `1:N`, `has_many` |
| `redundant_mirror` | `mirror`, `denormalized`, `redundant-mirror` |
| `cascade_delete` | `cascade`, `on_delete_cascade` |

**归档流程里必须执行这一步**，否则非规范值会污染图谱。

## 7. 指纹增量更新

避免每次归档都全量重扫项目文件。`fingerprints.json` 记录每个文件的：
- `contentHash`：SHA-256（判定 NONE）
- `structKeys`：结构签名 { classes, fields, methods, imports }（判定 COSMETIC/STRUCTURAL）

`/pmem sync` 时只重扫 hash 变化的文件；`/pmem verify` 时逐 node 对比 hash，失效的自愈。

详见 `references/update-checklist.md`。

## 8. redundant_mirror 冗余镜像（核心专项）

处理"某字段冗余记录了另一条主关系"的场景。例如：

> 工单表 `WsWorkOrder.repairPartIds`（逗号拼接的被试件id）冗余记录了中间表 `WsWorkOrderRepairPart` 的关系。

**必须由两部分协同记录**（缺一不可）：

1. **edges[] 一条 redundant_mirror 边**：建立拓扑可见性
   - `type: "redundant_mirror"`, `via: "字段名(逗号拼接)"`, `mirrors: "主关系路径"`
2. **rules[] 一条 sync 规则**：建立操作联动
   - `trigger.edge: "主关系"`, `must_also_update: [{entity, field, action}]`

**检测时机**：
- `/pmem sync` 扫描：字段名含 Ids/List/集合 且为 String → 标记疑似，提示确认
- HARD-GATE 归档：改中间表关系时检查关联实体是否有冗余字段

**查询时**：1-hop 影响分析命中主关系或冗余实体 → 规则引擎自动返回 must_also_update 提醒。**不依赖 AI 读 description 文本**。

## 9. 检索协议

查询"改 X 影响谁"等影响分析时，按 `references/retrieval-protocol.md` 的 1-hop 邻居扩展算法执行：
1. 找 node[id="entity:X"]
2. 筛 edges where source==X OR target==X → 收集邻居
3. 查 rules where trigger.edge 涉及 X 或邻居 → 列出 must_also_update
4. 查 redundant_mirror 边 where source==X → 提醒同步冗余字段
5. 返回完整影响范围

## 10. 参考文档索引

- `references/graph-protocol.md` — 图模型完整规范（节点/边/规则/契约字段、ID 命名空间、权重、别名表、redundant_mirror 机制）
- `references/retrieval-protocol.md` — 检索协议（1-hop 算法 + 规则触发 + 冗余镜像提醒 + 退化阶梯）
- `references/update-checklist.md` — 归档检查清单（触发条件 + 维护规则 + redundant_mirror 检测 + 别名归一 + 指纹更新）
- `references/templates/knowledge-graph.json` — 图谱模板（含示例 node/edge/rule/contract）
- `references/templates/fingerprints.json` — 指纹库模板
- `references/templates/hooks/config.json.example` — hook 配置示例
- `references/templates/viewer.html` — 可视化查看器（浏览器打开，选 JSON 即看图；含左下角规则面板，点击规则高亮相关节点，详见 /pmem view）
- `hooks/*.mjs` — 自动归档 hook 脚本（fingerprint/post-tool-archive/stop-archive/session-load）
