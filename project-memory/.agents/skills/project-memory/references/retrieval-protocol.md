# 检索协议（retrieval-protocol）

定义如何从 knowledge-graph.json 检索信息。核心是 1-hop 邻居扩展算法。

## 1. 前提：图已加载

执行任何检索前，确认上下文已有 `[PMEM_LOADED:Vx]` 标记。若无，先 cat 加载：
```bash
cat .zcode_skills_temp/.aiknowledge/knowledge-graph.json
```

## 2. 核心算法：1-hop 邻居扩展（影响分析）

查询"改 X 会影响谁" / "X 依赖什么" / "删除 X 要注意什么"：

```
步骤 1：定位起点
  找 node where id == "entity:X" 或 name 匹配 X
  → 得到起点 nodeId

步骤 2：收集直接邻居（1-hop）
  筛 edges where source == nodeId OR target == nodeId
  → 收集所有对端 node id（邻居集合）
  → 记录每条边的 type/via/cascade（区分标准关系/冗余镜像/级联）

步骤 3：规则引擎联动
  筛 rules where trigger.edge 涉及 nodeId 或任一邻居
  → 提取 must_also_update（联动更新项）
  → 提取 constraints（约束条件，如"删除前检查 XX"）

步骤 4：冗余镜像检测（redundant_mirror 专项）
  筛 edges where source == nodeId AND type == "redundant_mirror"
  → 若存在，提醒："存在冗余镜像字段，改主关系时必须同步以下字段"
  → 列出 mirrors 路径 + 对应 rule 的 must_also_update

步骤 5：汇总返回
  完整影响范围 = {
    直接邻居: [邻居 node 列表 + 关系类型],
    规则联动: [must_also_update + constraints],
    冗余镜像: [mirror 边 + 同步提醒],
    级联风险: [cascade_delete 的下游]
  }
```

### 示例：查"改 WsWorkOrder 影响谁"

```
步骤1: node[id="entity:WsWorkOrder"] 找到
步骤2: edges 筛 source==WsWorkOrder:
       → WsWorkOrder→WsWorkOrderRepairPart (one_to_many, cascade_delete) ⚠️级联风险
       → WsWorkOrder→ReRepairPart (redundant_mirror) ⚠️冗余镜像
步骤3: rules where trigger.edge 涉及 WsWorkOrder:
       → rule:sync_repair_part_ids
         must_also_update: [{entity:WsWorkOrder, field:repairPartIds, action:"重拼逗号字符串"}]
         constraints: ["校验被试件状态符合要求，不符合的从中间表移除并重拼"]
步骤4: redundant_mirror 边 source==WsWorkOrder:
       → mirrors="WsWorkOrder→WsWorkOrderRepairPart→ReRepairPart"
       → 提醒："改中间表关系时必须同步重拼 repairPartIds 字段"
步骤5: 返回影响范围 + 级联风险 + 冗余字段同步提醒 + 校验约束
```

## 3. 实体详情查询

查询"X 是什么 / X 有哪些字段 / X 的定义在哪"：

```
1. 找 node where id == "entity:X"
2. 返回: name/summary/tags/layer/anchor/fields
3. 若需定位代码: 输出 anchor.file:anchor.lines
```

## 4. 关系溯源查询

查询"X 和 Y 是什么关系 / 为什么 X 引用 Y"：

```
1. 找所有 edges where (source==X AND target==Y) OR (source==Y AND target==X)
2. 返回每条边的 type/via/cascade/description
3. 若 type == redundant_mirror: 额外返回 mirrors 路径 + 关联 rule
```

## 5. 退化阶梯（图数据不完整时的降级）

当 knowledge-graph.json 信息不足时，按以下顺序退化：

```
Level 0（最优）: 图谱完整 → 直接 1-hop 扩展返回
Level 1（图缺）: 图谱有 node 但缺 edge → 返回 node 详情，提示"关系未记录，建议 /pmem sync"
Level 2（图空）: 图谱无此实体 → 读 anchor 指向的源码文件，现场提取结构
Level 3（兜底）: anchor 失效 → 全局搜索代码（grep/glob），重新发现实体
```

每次退化后，若发现了应该记录的结构，在回复末尾提醒用户归档（触发 HARD-GATE）。

## 6. 搜索协议（轻量，无外部依赖）

不引入 Fuse.js 等搜索库。LLM 直接遍历 nodes 数组做加权匹配：

```
查询词 Q，遍历 nodes:
  score = 0
  if node.name 含 Q:           score += 0.4  (最高权重)
  if node.tags 含 Q:           score += 0.3
  if node.summary 含 Q:        score += 0.2
  if node.fields[].name 含 Q:  score += 0.1

返回 score > 0 的 node，按 score 降序。
```

## 7. 检索结果输出格式

```
📍 影响分析：改 <X> 的影响范围

【直接邻居】
  → <邻居1> (关系: one_to_many, via: workOrderId) ⚠️cascade_delete
  → <邻居2> (关系: redundant_mirror, via: repairPartIds)

【规则联动】
  ⚠️ 规则 rule:sync_repair_part_ids
     改此关系时必须: 重新拼接 repairPartIds 逗号字符串
     约束: 校验被试件状态符合要求，不符合的移除

【级联风险】
  删除 <X> 会级联删除: <邻居1>

【冗余字段同步】
  mirror 路径: X→中间表→被试件
  必须同步字段: repairPartIds
```
