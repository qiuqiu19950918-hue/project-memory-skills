# Project Memory Skill · 代码知识图谱

> 把项目里的表、字段、关系、业务规则、API 契约固化为**单一 JSON 知识图谱**，让 AI 在后续会话中"记得"项目结构。支持 **hook 驱动的自动归档** 和 **冗余镜像（redundant_mirror）检测**。

## 核心特性

- 🧠 **知识图谱存储**：实体/关系/规则/契约统一存为 `knowledge-graph.json`，告别分散的 YAML 文件
- 🔍 **1-hop 影响分析**：查"改 X 影响谁"时，图遍历返回完整影响范围 + 规则联动
- 🪞 **冗余镜像检测**：自动识别"逗号拼接字段镜像中间表关系"等反范式设计，改主关系时提醒同步冗余字段
- ⚡ **hook 自动归档**：PostToolUse 监听代码变更 + Stop 续做归档，**无需手动 /pmem sync**（仅本地开发任务）
- 🔒 **完全不碰 git**：跨版本控制同步（pull/commit/push）由用户手动控制，hook 零侵入
- 🏷️ **别名容错**：LLM 写 `one-to-many`/`OneToMany`/`1:N` 自动归一为 `one_to_many`
- 📋 **指纹增量更新**：SHA-256 + 结构签名，只重扫真正变更的文件，省 token
- 👁️ **浏览器可视化**：`/pmem view` 一键打开 HTML 查看器，力导向图谱、redundant_mirror 红虚线高亮、悬停看详情、左下角规则面板点击联动高亮

## 快速开始

### 1. 安装
将 `project-memory/` 目录复制到你的 ZCode skills 目录（通常在 `~/.agents/skills/` 或项目 `.agents/skills/`）。

### 2. 初始化项目知识图谱
在你的项目里执行：
```
/pmem init
```
这会创建 `.zcode_skills_temp/.aiknowledge/` 数据目录，并引导你安装 hook。

### 3. 日常使用
- **正常开发**：hook 自动在任务结束后归档结构变更（非 CRUD 才归档）
- **跨 git 同步后**：手动执行 `/pmem sync` 重新扫描
- **查询影响**：问 AI "改工单表影响谁"，自动触发 1-hop 分析
- **可视化查看**：执行 `/pmem view`，浏览器打开图谱，直观查看节点关系与冗余镜像

## hook 工作机制

```
【任务前】SessionStart → 提示加载图谱
【开发中】Write/Edit → PostToolUse 算指纹判定（NONE/COSMETIC/STRUCTURAL）
【任务后】Stop → 若有 STRUCTURAL 待归档 → 拽回 AI 继续归档（≤3次）
```

**重要**：hook 完全不调用 git。本地开发自动归档 ✅；跨 git 同步靠手动 /pmem sync ✅。

## 目录结构

```
project-memory-skill/
├── project-memory/                  # 主 skill（单一变体，已合并 compact）
│   ├── .agents/
│   │   ├── skills/project-memory/
│   │   │   ├── SKILL.md             # 核心指令
│   │   │   ├── references/
│   │   │   │   ├── graph-protocol.md       # 图模型规范 + 别名表
│   │   │   │   ├── retrieval-protocol.md   # 1-hop 检索算法
│   │   │   │   ├── update-checklist.md     # 归档检查清单
│   │   │   │   └── templates/
│   │   │   │       ├── knowledge-graph.json  # 图谱模板
│   │   │   │       ├── fingerprints.json     # 指纹库模板
│   │   │   │       ├── VERSION
│   │   │   │       └── hooks/config.json.example  # hook 配置示例
│   │   │   └── hooks/                # 自动归档脚本
│   │   │       ├── fingerprint.mjs         # 指纹计算（SHA-256 + 正则）
│   │   │       ├── post-tool-archive.mjs   # PostToolUse hook
│   │   │       ├── stop-archive.mjs        # Stop hook
│   │   │       └── session-load.mjs        # SessionStart hook
│   │   └── commands/pmem.md          # /pmem 命令
│   └── README.md
├── github/                          # GitHub 发布备份
└── README.md                        # 本文件
```

## 与旧版的区别

| 维度 | 旧版（YAML 多文件）| 新版（知识图谱）|
|---|---|---|
| 存储 | 5 个分散 YAML/MD 文件 | 单一 knowledge-graph.json |
| 检索 | 全量 cat + 字符串匹配 | 1-hop 图遍历 + 规则引擎 |
| 冗余字段 | 无专项机制 | redundant_mirror 边 + sync 规则 |
| 自动更新 | 靠 AI 自觉（HARD-GATE）| hook 强制 + HARD-GATE 双保险 |
| 别名容错 | 无 | normalize before write |
| 变体 | 标准版 + compact 版 | 单一变体（已合并）|

## 从旧版迁移

若你已有 YAML 格式的知识库：
```
/pmem migrate
```
会自动转换 entities/relationships/business-rules/api-contracts，旧文件备份到 `legacy/`，并首次生成基线指纹。

## 设计文档

详细改造背景见 `.zcode/plans/` 目录。

## 许可证

见 github/LICENSE。
