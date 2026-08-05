# 图模型规范（graph-protocol）

本规范定义 Project Memory 知识图谱的节点、边、规则、契约结构，以及 ID 命名空间、权重约定、别名容错、冗余镜像（redundant_mirror）机制。

## 1. 顶层结构

knowledge-graph.json 顶层字段：
- `meta`：元数据（版本、计数、时间戳）
- `nodes[]`：实体节点
- `edges[]`：关系边
- `rules[]`：业务规则与同步约束
- `contracts[]`：API 契约
- `fingerprints{}`：文件指纹（持久化副本，与 fingerprints.json 同步）

## 2. 节点（node）规范

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | string | ✅ | 统一 ID，格式 `entity:<Name>` |
| type | string | ✅ | 节点类型，见下表 |
| name | string | ✅ | 实体名（与代码中的类名/表名一致）|
| summary | string | ✅ | 一句话描述 |
| tags | string[] | ➖ | 域标签，用于分组过滤（如 `工单域`）|
| layer | string | ➖ | 架构层（`data`/`model`/`service`/`controller`）|
| anchor | object | ✅ | 代码定位 { file, symbol, lines?, hash }。symbol 为稳定主键（类名/方法名），lines 为可选辅助定位 |
| fields | object[] | ➖ | 字段定义 { name, type, primary?, unique?, ref?, comment? } |

> **anchor 定位规则**：检索时优先用 symbol（稳定索引，不受代码增删行影响）定位代码；lines 仅作辅助快速滚动。归档时 symbol 必填，lines 可选填。若只记录 symbol 不含 lines，在"API 反查"或"合约搜索"中仍可精确定位到方法级别。

节点 type 取值：`table`（数据库表）、`service`（服务类）、`controller`（控制器）、`config`（配置）、`document`（文档）。

## 3. 边（edge）规范

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| source | string | ✅ | 起点节点 id |
| target | string | ✅ | 终点节点 id |
| type | string | ✅ | 边类型，见下表 |
| via | string | ➖ | 外键字段或连接方式说明 |
| cascade | string | ➖ | 级联策略 `none`/`cascade_delete` |
| role | string | ➖ | 角色说明（如 `primary_source`/`denormalized_snapshot`）|
| weight | number | ✅ | 权重 0-1，影响检索排序 |
| mirrors | string | ➖ | **仅 redundant_mirror**：指向被镜像的主关系路径 |
| description | string | ➖ | 人类可读说明 |

### 边类型与权重约定

| 类别 | type | weight | 说明 |
|---|---|---|---|
| 标准关系 | `one_to_many` | 0.8 | 一对多外键 |
| 标准关系 | `many_to_one` | 0.8 | 多对一外键 |
| 标准关系 | `one_to_one` | 0.8 | 一对一 |
| 标准关系 | `many_to_many` | 0.8 | 多对多（通常经中间表）|
| 隐式 | `implicit` | 0.5 | 无 DB 外键，应用层维护 |
| **冗余镜像** | **`redundant_mirror`** | **0.3** | **冗余字段镜像主关系，必须配 sync 规则** |
| 级联 | `cascade_delete` | 0.9 | 删父级自动删子级 |
| 依赖 | `depends_on` | 0.6 | 跨模块隐式依赖 |
| 契约 | `serves` | 0.5 | 合约提供对实体的服务（contract→entity） |
| 契约 | `queries` | 0.5 | 合约查询的实体（contract→entity） |

## 4. 规则（rule）规范

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | string | ✅ | 格式 `rule:<name>` |
| summary | string | ✅ | 规则一句话描述 |
| trigger.edge | string | ✅ | 触发此规则的关系（`source→target` 格式）|
| trigger.operations | string[] | ✅ | 触发操作 `insert`/`delete`/`update` |
| must_also_update | object[] | ➖ | 联动更新项 { entity, field, action } |
| constraints | string[] | ➖ | 约束条件（校验规则、前置检查）|
| reason | string | ➖ | 规则存在原因 |
| anchor | object | ✅ | 代码定位 |

## 5. 契约（contract）规范

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | string | ✅ | 格式 `contract:<name>` |
| path | string | ✅ | API 路径（如 `GET /api/users/:id`）|
| format | string | ✅ | `nested`/`flat`/`hybrid` |
| summary | string | ✅ | 契约说明 |
| special_handling | string[] | ➖ | 前端需特殊处理的点 |
| anchor | object | ✅ | 代码定位 |

## 6. ID 命名空间（统一引用）

所有跨结构引用必须用统一 ID 格式：
- 实体节点：`entity:<Name>`（如 `entity:WsWorkOrder`）
- 规则：`rule:<name>`（如 `rule:sync_repair_part_ids`）
- 契约：`contract:<name>`（如 `contract:get_user_devices`）

edges 的 source/target、rules 的 trigger.edge/must_also_update.entity、fields 的 ref —— 全部用上述格式。**禁止用裸字符串 name 相互引用**。

## 7. 别名容错表（normalize before write）

LLM 写入知识图谱前，必须将下列非规范值归一为规范值：

### 边类型别名
| 规范值 | 接受的别名 |
|---|---|
| `one_to_many` | `one-to-many`, `OneToMany`, `1:N`, `has_many`, `hasMany` |
| `many_to_one` | `many-to-one`, `ManyToOne`, `N:1`, `belongs_to`, `belongsTo` |
| `one_to_one` | `one-to-one`, `OneToOne`, `1:1` |
| `many_to_many` | `many-to-many`, `ManyToMany`, `N:N` |
| `redundant_mirror` | `redundant-mirror`, `redundantMirror`, `mirror`, `denormalized`, `denormalized_snapshot` |
| `cascade_delete` | `cascade`, `cascade-delete`, `on_delete_cascade`, `onDeleteCascade` |
| `implicit` | `implicit-relation`, `application_level`, `app-level` |
| `depends_on` | `depends-on`, `depends`, `uses` |

### 级联别名
| 规范值 | 接受的别名 |
|---|---|
| `cascade_delete` | `cascade`, `delete`, `all` |
| `none` | `no`, `null`, `""` |

### 节点 layer 别名
| 规范值 | 接受的别名 |
|---|---|
| `data` | `db`, `database`, `entity`, `table`, `model` |
| `service` | `services`, `biz`, `business` |
| `controller` | `api`, `rest`, `endpoint` |

## 8. redundant_mirror 冗余镜像机制（核心专项）

用于处理"某字段冗余记录了另一条主关系"的场景（如工单表 `repairPartIds` 逗号拼接字段镜像中间表关系）。

### 必须由两部分协同记录

**① edges[] 一条 redundant_mirror 边**：
- `type: "redundant_mirror"`
- `via`: 冗余字段名及格式说明
- `role: "denormalized_snapshot"`
- `mirrors`: 指向被镜像的主关系完整路径（`A→B→C` 格式）
- `weight: 0.3`（低于标准关系，避免影响主路径检索）

**② rules[] 一条 sync 规则**：
- `trigger.edge`: 指向**主关系**（不是 mirror 边本身）
- `trigger.operations`: 改主关系时哪些操作触发同步（通常 insert/delete/update 全包含）
- `must_also_update`: 指明要同步的冗余字段及 action

### 检测时机
1. **/pmem sync 扫描时**：发现字段名含 `Ids`/`List`/`集合` 且类型为 String/varchar → 标记疑似冗余镜像，提示确认
2. **HARD-GATE 归档时**：修改中间表关系，AI 检查关联实体是否有疑似冗余字段

### 查询时自动触发
影响分析命中主关系或冗余实体时，1-hop 扩展 + 规则引擎自动返回 must_also_update 提醒。**不依赖 AI 阅读 description 文本**。

## 9. schema 版本约定

- `meta.schema_version`：图模型结构版本（当前 `2.0`）。结构不兼容变更时升版本。
- `meta.loaded_version`：数据版本，每次归档 bump +1。用于检测本地知识库是否最新。
- VERSION 文件同步记录这两个版本，供 hook 快速读取。

## 10. 数据卫生

- **anchor 消毒**：anchor.file 必须是项目相对路径（如 `src/models/X.java`），禁止绝对路径（防泄露开发者目录）。
- **_comment 处理**：模板中的 `_comment`/`_doc`/`_xxx` 字段仅用于说明，生产 knowledge-graph.json 中应删除这些字段。
- **hash 占位**：未计算 hash 的 anchor 用 `"PLACEHOLDER"`，归档时由 fingerprint 流程填充。
