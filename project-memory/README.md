# 🧠 Project Memory — Request-Count Variant

[![Optimized For](https://img.shields.io/badge/optimized%20for-request%20count-2ea44f?style=flat-square)](https://github.com)
[![Command](https://img.shields.io/badge/command-/pmem-333?style=flat-square)](#)
[![Compatible](https://img.shields.io/badge/ZCode-✅-0a84ff?style=flat-square)](#)
[![Compatible](https://img.shields.io/badge/OpenCode-✅-7c3aed?style=flat-square)](#)

> 为 AI 提供「项目长期记忆」：维护一个版本化的结构化知识库，映射项目的实体、关系、业务规则、接口契约。新会话秒级加载，同窗口零重读。**以请求次数最少为优化目标**。

---

## 🎯 This Variant — For Whom?

| 你用的模型 / 套餐 | 计费方式 | 该选哪个变体 |
|:---|:---|:---|
| **GLM-5.2 / 按请求次数计费** | 每次 API 调用独立计费 | ✅ **这个**（请求次数最少） |
| 上下文窗口很大（≥ 128K），不敏感 | 单次内容的 token 量影响很小 | ✅ **这个** |
| 需要多轮追问同一个项目的多个问题 | 每次追问不额外计请求费 | ✅ **这个** |

> 如果你用的模型按 **输入/输出 token** 计费（如 DeepSeek），请换 [project-memory-compact](../project-memory-compact)。

---

## 🚀 What It Does

新会话输入 `/pmem`，几秒内 AI 就知道：

- 项目有多少张表、每个表有哪些字段
- 表之间的外键关系、级联策略
- 哪些业务规则跨表约束（互斥、状态机、删前检查）
- 哪些接口返回了嵌套/扁平混合格式，前端需要特殊处理
- 改一个实体会影响哪些模块——**全程 0 次 grep**

---

## ⚡ Request Count Breakdown

| 场景 | 请求次数 | 说明 |
|:---|:---:|:---|
| **新窗口首轮** | ~1 | `cat` 一条命令加载全部 5 个知识库文件 |
| **同窗口续轮** | **0** | `[PMEM_LOADED:Vx]` 标记驱动——上下文已全量加载，不重读 |
| 用户说"我 git pull 了" | 1 | 只读 `VERSION` 检测增量 |
| 自己写归档后继续 | **0** | 自己写入的内容上下文已知，不重读 |
| `/pmem check` | 1 | 只读 VERSION 对比 HEAD |
| 回答"改 X 会影响什么" | **0** | 关系数据已在上下文中 |

> 对比旧版（每轮都 7 次请求 Read 5 个文件）：6 轮对话从 ~42 次请求降到 **累计 ~3 次**。

---

## 📦 Installation

### 全局安装（所有项目可用）

```bash
# 克隆或下载本项目
git clone https://github.com/your-org/project-memory.git

# 安装（将 .agents 合并到用户目录）
cp -r project-memory/.agents/* ~/.agents/
```

### 项目级安装（仅当前项目可用）

```bash
# 在项目根目录下
cp -r project-memory/.agents/* /path/to/your-project/.agents/
```

> ⚠️ 与 [project-memory-compact](../project-memory-compact) **不能同时安装**（命令同名、目录冲突）。先删旧再装新。

---

## 🧩 What's Inside

```
.agents/
├── commands/
│   └── pmem.md                    # /pmem 命令入口
└── skills/
    └── project-memory/
        ├── SKILL.md               # 主技能指令（包含 Load State Machine）
        └── references/
            ├── retrieval-protocol.md    # 哈希策略、退化阶梯、提交规则
            ├── update-checklist.md      # 详细更新条件 + 锚点维护
            └── templates/               # 知识库模板（首次初始化用）
                ├── VERSION              # 版本指纹文件
                ├── entities.yaml        # 实体定义模板（带 anchor）
                ├── relationships.yaml   # 关系定义模板（双向 anchors）
                ├── business-rules.md    # 业务规则模板
                ├── api-contracts.md     # API 契约模板
                └── sources.yaml         # 扫描路径配置
```

---

## 🔧 Quick Start

1. 安装后重启 ZCode/OpenCode
2. 在任意项目根目录输入 `/pmem`
3. AI 自动扫描代码，生成知识库（`.zcode_skills_temp/.aiknowledge/`）
4. 后续开发中涉及新实体/关系/规则时，AI **自动归档**，每轮末尾输出 `📚 知识库更新` 摘要

### 命令一览

| 命令 | 作用 | 请求次数 |
|:---|:---|:---:|
| `/pmem` | 加载知识库（首轮全量，续轮 0 请求） | ~1 / 0 |
| `/pmem check` | 检查知识库是否过期 | 1 |
| `/pmem sync` | 全量重建知识库 | varies |
| `/pmem verify` | 增量修复（补锚点、治愈失效） | varies |

---

## 🔄 Switching from the compact variant

1. `rm -rf ~/.agents/skills/project-memory-compact ~/.agents/commands/pmem.md`
2. 安装本变体（见上）
3. 知识库（`.zcode_skills_temp/.aiknowledge/`）**无需重建**——格式兼容
4. 新会话中执行 `/pmem` 即可

---

## 🤝 Contributing

两个变体的知识库文件格式完全兼容。仅 skill 指令不同。欢迎提 PR 改进状态机逻辑、锚点策略或指令清晰度。

---

## 📄 License

MIT
