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

## 7. API 反查协议（URL → 后台接口）

根据前端请求 URL 快速定位后台接口，无需 grep 项目代码。

触发场景：用户给出 URL 如 `GET /api/workorders/123/parts`，问"这是哪个接口/哪个 Controller 方法"。

检索步骤：
1. 从 URL 提取 HTTP 方法 + 路径：`GET /api/workorders/123/parts`
2. 遍历 knowledge-graph.json 的 contracts[] 做**参数化匹配**：
   - 把 URL 路径的每一段与 contract.path 的路径段逐段对比
   - contract.path 中以 `:` 开头的段（如 `:id`）视为**参数通配符**，匹配 URL 中对应位置的任意非空段
   - HTTP 方法也必须匹配（GET/POST/PUT/DELETE）
3. 命中 contract 后返回完整信息：
   - contract.path（原始参数化路径）
   - contract.summary（功能说明，理解接口做什么）
   - contract.format（nested/flat/hybrid，前端需注意的响应格式）
   - contract.special_handling（前端特殊处理点）
   - contract.anchor.symbol + contract.anchor.file（后台代码定位）
4. 若未命中：告知用户"该 URL 未在知识图谱中记录"，建议 /pmem sync 或提醒归档

示例：
```
输入：GET /api/workorders/123/parts
contracts[] 中 "path": "GET /api/workorders/:id/parts"
逐段匹配：GET==GET, api==api, workorders==workorders, 123 matches :id, parts==parts
命中 contract:get_workorder_parts
返回：WsWorkOrderController.java, getWorkOrderWithParts
```

## 8. 合约搜索协议（新需求 → 接口复用分析）

根据业务需求描述，查找是否已有接口实现了类似逻辑，支持接口复用决策。

触发场景：用户说"新需求是 XXX，有没有现成接口可以复用"。

检索步骤：
1. **解析需求语义**：从需求描述中提取核心实体和操作
   - 例："根据被试件状态筛选工单列表"→ 实体: 工单 + 被试件，操作: 筛选/查询
2. **定位关联实体节点**：在 knowledge-graph.json 的 nodes[] 中找到对应实体
   - 找到 entity:WsWorkOrder、entity:ReRepairPart
3. **沿 contract↔entity 边查合约**（若有边连接）：
   - 找 edges where type 为 serves/queries 且 target 为上述 entity
   - 通过这些 edges 快速确定"哪些合约涉及这些实体"
   - 若 contract↔entity 边缺失，退化到步骤 4
4. **退化扫描全部 contracts[]**（无 contract↔entity 边时）：
   - 在 contracts[].summary 和 contracts[].path 中做文本匹配
   - 用搜索协议（第 6 节）的加权方案：path 匹配权重 0.4，summary 匹配权重 0.3
   - 提取匹配的候选 contract
   - ⚠️ 当前 knowledge-graph.json 中 contracts 和 entities 之间**可能没有边连接**（取决于归档时是否记录了 contract→entity 的边）
5. **语义对比**：将需求描述与候选 contract 的 summary + special_handling 进行语义对比
   - 判断是否可直接复用、需要包装调用、还是必须新增
6. **返回复用建议**：
   - 候选 contract 列表（path + summary + 相似度评估）
   - 推荐动作（复用/包装/新增）及理由
   - 每个候选的 anchor（定位到后台代码）

示例：
```
输入："需要一个新接口，根据被试件状态筛选工单列表"
Step 2: entities → entity:WsWorkOrder, entity:ReRepairPart
Step 4: 扫描 contracts[] → 候选: contract:get_workorder_parts（summary 含"被试件"、path 含 "workorders"）
Step 5: 语义对比 → get_workorder_parts 已实现"某工单的被试件列表"，新需求是"按被试件状态查工单"
        → 不完全等价，但 getWorkOrderWithParts 方法的底层逻辑可复用
Step 6: 建议"包装复用"——新建接口外层加状态筛选，内层调用已有方法
```

> 注意：
> - 本协议依赖 contracts[].summary 字段质量——归档时务必写清楚"做什么"而非"怎么实现"
> - 若 contracts 和 entities 之间没有边连接，协议自动退化到文本扫描（步骤 4）
> - 搜索协议（第 6 节）的加权匹配方法同样适用于 contracts[].summary 的匹配

## 9. 检索结果输出格式

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
