# 🧠 Project Memory · 代码知识图谱记忆系统

> 把项目里的表、字段、关系、业务规则、API 契约固化为**单一 JSON 知识图谱**，让 AI 在后续会话中"记得"项目结构。支持 **hook 驱动的自动归档** 与 **冗余镜像（redundant_mirror）检测**。

---

## 📢 本版本（v2.0 知识图谱版）相对旧版的改进

本版本是对 v1（YAML 多文件版）的**架构级重写**。下表是改进总览，详情见后文。

| 维度 | v1（旧版）| v2.0（本版本）| 改进类型 |
|---|---|---|---|
| **存储格式** | 5 个分散文件（entities/relationships/business-rules/api-contracts/sources）| 单一 `knowledge-graph.json` | 🔧 架构重构 |
| **检索算法** | 全量 cat + 字符串匹配 | 1-hop 邻居图遍历 + 规则引擎联动 | ⚡ 性能优化 |
| **冗余字段** | 无专项机制（写死在自由文本里）| redundant_mirror 边 + sync 规则协同 | 🆕 新增能力 |
| **自动归档** | 靠 AI 自觉（HARD-GATE 提示词）| hook 强制（PostToolUse+Stop）+ HARD-GATE 双保险 | 🆕 新增能力 |
| **别名容错** | 无（LLM 写错就废）| normalize before write（别名表自动归一）| 🔧 健壮性 |
| **增量更新** | 全量重扫 | 指纹三级分类（NONE/COSMETIC/STRUCTURAL）| ⚡ 性能优化 |
| **变体数量** | 双变体（standard + compact）| 单一变体（已合并）| 🔧 简化 |

### 🔧 针对"检索低效"的改进：知识图谱化

**痛点**：旧版 5 个文件各自独立，无统一 ID。查"改工单影响谁"时，AI 要 cat 全部 5 个文件到上下文，再用 `from==X or to==X` 做字符串匹配——这是一跳的扁平搜索，不是图遍历，无法发现"X 影响 Y，Y 影响 Z"这种传递关系。

**优化**：全部实体/关系/规则/契约合并进单一 `knowledge-graph.json`，统一 ID 命名空间（`entity:XXX`）。检索改为 **1-hop 邻居扩展算法**：找 node → 扩 edges → 查 rules 联动 → 查 redundant_mirror。详见 `references/retrieval-protocol.md`。

### 🆕 针对"冗余字段易遗漏"的改进：redundant_mirror 机制

**痛点**：很多项目存在反范式设计——比如工单表 `WsWorkOrder.repairPartIds`（逗号拼接的被试件 id）冗余记录了中间表 `WsWorkOrderRepairPart` 的关系。旧版只能把这种约束写死在 `business-rules.md` 的自然语言里，AI 经常读不到、读不懂、忘记同步，导致改了中间表却忘了重拼字符串，数据不一致。

**优化**：新增 `redundant_mirror` 边类型 + 配套 sync 规则。由两部分协同记录：
- **edges[] 一条 mirror 边**：建立拓扑可见性（`mirrors` 字段指向主关系路径）
- **rules[] 一条 sync 规则**：建立操作联动（`trigger.edge` 指主关系，`must_also_update` 指冗余字段）

查询命中主关系时，规则引擎**自动**返回 must_also_update 提醒，不依赖 AI 读 description 文本去猜。检测时机：`/pmem sync` 扫描 + HARD-GATE 归档时。详见 `references/graph-protocol.md` 第 8 节。

### 🆕 针对"忘记更新知识库"的改进：hook 自动归档

**痛点**：旧版归档完全靠 AI"自觉"（SKILL.md 里写 `<HARD-GATE>你必须归档</HARD-GATE>`），但 AI 经常忘记。用户痛点："本地开发完一个功能，重要的逻辑关系以后用得到，但 AI 没归档，下次会话又不知道了。"

**优化**：引入 ZCode hook 三件套（位于 `hooks/`，零依赖纯 Node.js）：
- **SessionStart**：会话启动时提示加载图谱
- **PostToolUse**（监听 Write|Edit）：算文件指纹判定变更级别
- **Stop**：若有 STRUCTURAL 待归档，拽回 AI 继续归档（≤3 次）

**重要边界**：hook 完全不碰 git。本地开发任务自动归档 ✅；跨版本控制同步（pull/commit/push）仍由用户手动 `/pmem sync`。

### ⚡ 针对"全量重扫浪费"的改进：指纹增量更新

**痛点**：旧版 `/pmem sync` 每次都全量重扫项目所有文件，几百个文件全扫一遍，token 和时间浪费严重。

**优化**：`fingerprints.json` 记录每个文件的 SHA-256 + 结构签名（类/字段/方法/import 名单）。三级分类决定要不要重扫：
- `NONE`（hash 同）→ 跳过
- `COSMETIC`（hash 变但结构签名同，即只改了方法体）→ 跳过
- `STRUCTURAL`（结构签名变，即加了字段/改了类）→ 才重扫

正则提取结构签名（零依赖），精度 ~80%，对"判断表/字段是否新增"足够。

### 🔧 针对"LLM 写错就废"的改进：别名容错

LLM 手写 JSON 时常出现 `one-to-many`/`OneToMany`/`1:N`/`has_many` 等不一致写法。旧版遇到非规范值会污染数据。本版本在写入前做 normalize（别名表见 `graph-protocol.md` 第 7 节），大幅降低数据丢弃率。

### 🔧 针对"双变体维护负担"的改进：合并为单一变体

**痛点**：旧版维护 standard 和 compact 两个变体，功能同步成本翻倍，且 compact 的"按需读字段"优化在图模型下已无必要（单 JSON 首轮一次加载即全图在上下文）。

**优化**：废弃 compact，合并为单一 `project-memory` 变体。若你是旧 compact 用户，迁移后功能等价且更简单。

---

## 🚀 快速开始

### 安装
将 `project-memory/` 目录复制到：
- 用户级：`~/.agents/skills/project-memory/`
- 项目级：`<项目>/.agents/skills/project-memory/`

命令文件 `pmem.md` 复制到 `~/.agents/commands/`。

### 初始化项目知识图谱
在你的项目里执行：
```
/pmem init
```
创建 `.zcode_skills_temp/.aiknowledge/` 数据目录，引导安装 hook。

### 从旧版迁移
若你已有 v1 的 YAML 知识库：
```
/pmem migrate
```
自动转换 entities/relationships/business-rules/api-contracts，旧文件备份到 `legacy/`，并首次生成基线指纹 + redundant_mirror 扫描。

---

## 📁 目录结构

```
project-memory/                  # skill 本体
├── README.md                    # 本 skill 的安装说明
└── .agents/
    ├── skills/project-memory/
    │   ├── SKILL.md             # 核心指令（AI 首先读这个）
    │   ├── hooks/               # ⭐ 自动归档脚本（v2.0 新增）
    │   │   ├── fingerprint.mjs         # 指纹计算（SHA-256 + 正则）
    │   │   ├── post-tool-archive.mjs   # PostToolUse hook
    │   │   ├── stop-archive.mjs        # Stop hook
    │   │   └── session-load.mjs        # SessionStart hook
    │   └── references/
    │       ├── graph-protocol.md       # 图模型规范 + 别名表 + redundant_mirror
    │       ├── retrieval-protocol.md   # 1-hop 检索算法
    │       ├── update-checklist.md     # 归档检查清单
    │       └── templates/
    │           ├── knowledge-graph.json  # ⭐ 图谱模板（v2.0 核心）
    │           ├── fingerprints.json     # ⭐ 指纹库模板（v2.0 新增）
    │           ├── VERSION
    │           └── hooks/config.json.example  # hook 配置示例
    └── commands/pmem.md          # /pmem 命令（init/migrate/sync/check/verify/query/graph/hook test）
```

---

## 📜 版本历史

- **v2.0（本版本）**：知识图谱架构重写。单 JSON 存储 + 1-hop 图遍历 + redundant_mirror + hook 自动归档 + 指纹增量 + 别名容错。废弃 compact 变体。
- **v1（旧版）**：YAML 多文件 + 双变体（standard/compact）+ HARD-GATE 提示词归档。

---

## 📄 许可证

见 LICENSE。
