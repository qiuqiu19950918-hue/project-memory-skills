# 更新检查清单（update-checklist）

定义何时更新 knowledge-graph.json、如何维护 node/edge/rule、如何检测 redundant_mirror、如何做别名归一和指纹更新。

## 1. 触发归档的条件

### 必须记录（MUST Record）

| 变更场景 | 更新动作 |
|---|---|
| 新增表/实体类 | nodes[] 加新 node（id=`entity:<Name>`）|
| 删除表/实体 | nodes[] 移除该 node + 关联 edges + 关联 rules |
| 重命名实体 | 改 node.id/name + 同步所有引用此 id 的 edges/rules/fields.ref |
| 新增字段 | node.fields[] 加字段；若是外键 → 加对应 edge |
| 删除字段 | node.fields[] 移除；若是外键 → 移除对应 edge |
| 字段类型变更 | 更新 field.type；若是外键类型变化 → 更新 edge.via |
| 新增外键关系 | edges[] 加 edge（source/target/via/type）|
| 新增业务规则 | rules[] 加 rule（trigger/must_also_update/constraints）|
| 发现冗余字段 | edges[] 加 redundant_mirror 边 + rules[] 加 sync 规则 |
| 新增非标准 API | contracts[] 加 contract（若格式偏离标准 CRUD）|
| 修改中间表关系 | 检查是否有 redundant_mirror 联动 → 触发 sync 规则 |

### 不记录（Do NOT Record）

- 纯 CRUD 业务实现（增删改查方法体）
- 纯 UI/CSS/样式/布局改动
- 方法体内部逻辑（未改签名/字段/关系）
- 注释、文档、日志语句更新
- 单元测试代码（除非测试揭示了新规则）
- 配置文件值调整（除非改变实体结构）

## 2. node 维护规范

新增 node 必须包含：
```json
{
  "id": "entity:<Name>",        // 必填，统一 ID
  "type": "table|service|controller|config|document",
  "name": "<与代码一致的类名/表名>",
  "summary": "<一句话描述>",
  "tags": ["<域标签>"],          // 建议填，便于分组
  "layer": "data|model|service|controller",
  "anchor": {
    "file": "<项目相对路径>",     // 禁止绝对路径
    "symbol": "<类名/方法名>",
    "lines": "<起-止>",
    "hash": "<SHA-256 前12位 或 PLACEHOLDER>"
  },
  "fields": [...]                // 实体类建议填
}
```

## 3. edge 维护规范

新增 edge 必须包含：
```json
{
  "source": "entity:<A>",       // 统一 ID 引用
  "target": "entity:<B>",
  "type": "<见 graph-protocol 权重表>",
  "via": "<外键字段说明>",
  "weight": <0-1>,              // 按类型约定
  "description": "<可选说明>"
}
```

**禁止用裸 name 字符串做 source/target**，必须用 `entity:XXX` 格式。

## 4. redundant_mirror 检测流程

### 检测信号
字段同时满足以下条件 → 疑似冗余镜像：
1. 字段名含 `Ids` / `List` / `集合` / `Array` / `s`（复数）
2. 字段类型为 `String` / `varchar` / `text`
3. 字段值是逗号拼接的 id 集合（看注释或使用方式确认）

### 确认后的记录流程
发现疑似冗余镜像，向用户确认后：

**步骤 1：加 redundant_mirror 边**
```json
{
  "source": "entity:<持有冗余字段的实体>",
  "target": "entity:<冗余字段指向的实体>",
  "type": "redundant_mirror",
  "via": "<字段名> (逗号拼接字符串)",
  "role": "denormalized_snapshot",
  "mirrors": "entity:A→entity:中间表→entity:B",  // 主关系完整路径
  "weight": 0.3
}
```

**步骤 2：加 sync 规则**
```json
{
  "id": "rule:sync_<字段名>",
  "summary": "修改<主关系>时必须同步重拼 <字段名>",
  "trigger": {
    "edge": "entity:A→entity:中间表",   // 主关系（不是 mirror 边）
    "operations": ["insert", "delete", "update"]
  },
  "must_also_update": [
    { "entity": "entity:A", "field": "<字段名>", "action": "重新拼接逗号字符串" }
  ],
  "constraints": ["<校验规则，如：状态不符合要求的移除>"],
  "anchor": { "file": "...", "symbol": "...", "lines": "...", "hash": "..." }
}
```

**两部分缺一不可**：edge 建立拓扑可见性，rule 建立操作联动。

## 5. 别名归一（normalize before write）

写入前必须将非规范值转为规范值。完整别名表见 graph-protocol.md 第 7 节。

**执行时机**：在写入 knowledge-graph.json 前，对每个 edge.type / cascade / node.layer 做一次归一。

**示例**：
- LLM 输出 `one-to-many` → 归一为 `one_to_many`
- LLM 输出 `hasMany` → 归一为 `one_to_many`
- LLM 输出 `cascade` → 归一为 `cascade_delete`
- LLM 输出 `entity` (作为 layer) → 归一为 `data`

## 6. 指纹更新流程

### 归档时更新指纹
每次归档涉及文件 F：
1. 用 `hooks/fingerprint.mjs` 的 computeFingerprint(F) 算新指纹
2. 更新 fingerprints.json[F] = { contentHash, structKeys, lastScan }
3. 同步更新 knowledge-graph.json 的 fingerprints[F]（持久化副本）

### 指纹库保护（LOAD-PATCH-SAVE）
更新 fingerprints.json 时必须"全量加载 → 修补变更条目 → 写回全部"：
1. 读取完整 fingerprints.json
2. 仅修改本次涉及的文件条目
3. 写回完整内容

**Guard**：若加载后发现指纹数量骤降（如从 50 降到 3），拒绝写入（防止误清空）。

## 7. 版本号 bump 规则

每次成功归档：
- `meta.loaded_version` += 1
- VERSION 文件 `loaded_version` 同步更新
- `meta.last_sync` 更新为当前 ISO8601 时间戳
- `meta.recent_changes` 追加本次变更摘要（保留最近 10 条）
- `meta.node_count/edge_count/rule_count/contract_count` 重新统计

## 8. 归档摘要输出格式

归档完成后，在回复中输出：

```
📦 知识图谱归档完成 [PMEM_LOADED:V<新版本号>]

变更摘要:
  + 新增节点: entity:XxxTable
  ~ 修改节点: entity:YyyService (加字段 status)
  + 新增边: entity:A →entity:B (one_to_many)
  + 新增规则: rule:sync_xxx_ids (redundant_mirror 联动)
  + 更新指纹: 3 个文件

⚠️ 提醒:
  - 发现疑似冗余字段 YyyService.xxxIds，已记录为 redundant_mirror
  - 改中间表时记得同步重拼该字段
```
