# 🧠 Project Memory — ZCode Skill 族

[![Skill Type](https://img.shields.io/badge/type-project--memory-blue?style=flat-square)](#)
[![Slash Command](https://img.shields.io/badge/command-/pmem-333?style=flat-square)](#)
[![Platform](https://img.shields.io/badge/platform-ZCode%20%7C%20OpenCode-7c3aed?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE)

> 让 AI 真正「记住」你的项目：自动捕获每次开发中涉及的实体关系与业务规则，形成结构化的业务映射图。后续改动时即时感知关联影响，防止遗漏关键逻辑。即使开启新对话，也能秒级还原完整的项目记忆。

**仓库地址**：https://github.com/qiuqiu19950918-hue/project-memory-skills

本仓库包含**两个独立项目**，针对两种不同的 AI 模型计费模型做了相反的优化。命令都是 `/pmem`，不能同时安装。

---

## 🎯 快速选择 —— 你该装哪个？

```
你的模型 / API 套餐怎么计费？
│
├─ 📞 按请求次数计费（如 GLM-5.2，1M 上下文窗口）
│   → 装 project-memory（首轮全量加载，续轮 0 请求）
│
└─ 🪙 按输入/输出 token 计费（如 DeepSeek）
    → 装 project-memory-compact（首轮 1.5K token 精简索引，字段按需取）
```

---

## 📊 变体核心对比

| 维度 | [project-memory](./project-memory/) | [project-memory-compact](./project-memory-compact/) |
|:---|:---|:---|
| **优化目标** | **请求次数最少** | **单次上下文 token 最少** |
| **适合模型** | GLM-5.2 等按请求计费 | DeepSeek 等按 token 计费 |
| **首轮加载** | cat 5 文件全量（~1 请求） | INDEX + relationships + VERSION（~1–3K token） |
| **同窗口续轮** | **0 请求** | 1 请求（主动读 VERSION） |
| **外部变更检测** | 被动（用户说才查） | 主动（每轮自动查） |
| **实体字段查询** | 0 请求（已在上下文） | 按 anchor 单次 Read（~500 token） |
| **额外文件** | — | `INDEX.yaml`（轻量索引） |
| **6 轮对话累计请求** | ~3 | ~7（含主动检测） |
| **6 轮对话累计 token** | ~47K（首轮）+ 少量追加 | ~3K（首轮）+ 按需增加 |

### 共同特性
- 同一个命令 `/pmem`，同一套子命令（`check` \| `sync` \| `verify`）
- 同一个知识库目录：`.zcode_skills_temp/.aiknowledge/`
- **知识库文件格式完全兼容**：切换变体时知识库无需重建
- `[PMEM_LOADED:Vx]` 状态标记驱动，同窗口不重复加载
- Anchor 锚点机制（file + line + symbol + hash）

---

## 🧠 核心原理：怎么做到"不用 grep"？

### 传统方式
```
用户："改 User 表会影响哪些模块？"
AI：grep "User" 全项目 → 读几十个文件筛选 → 得出结论
     ↑ 大量无效检索，token 浪费，可能漏掉隐式关系
```

### Project Memory 方式
```
1. 查 knowledge base 中的 relationships.yaml → User 关联 Device、Order、Role
2. 每个关系都有 file + line 锚点 → 批量 Read 精确位置
3. 回答影响范围。全程零全局搜索。
```

### 首轮之后（同窗口）
```
第1轮：/pmem 全量加载，输出 [PMEM_LOADED:V3]
第2轮：看到标记 → 直接回答，0 次请求
第3轮：开发了新实体 → 归档写入 → 输出 [PMEM_LOADED:V4]
第4轮：看到 V4 标记 → 继续 0 请求
...
第N轮：始终 0 请求（除非外部 git pull 了别人的代码）
```

---

## 📦 安装

两个变体各自为独立子目录，选择一个。

### 全局安装（推荐）

```bash
# 克隆仓库
git clone https://github.com/qiuqiu19950918-hue/project-memory-skills.git
cd project-memory-skills

# 变体 A：请求次数最少（GLM-5.2 等）
cp -r project-memory/.agents/* ~/.agents/

# 或 变体 B：token 最少（DeepSeek 等）
cp -r project-memory-compact/.agents/* ~/.agents/
```

### 项目级安装

```bash
# 在项目根目录下
git clone https://github.com/qiuqiu19950918-hue/project-memory-skills.git
cp -r project-memory-skills/project-memory/.agents/* .
```

---

## 🔧 使用

1. 在任意项目根目录输入 `/pmem`
2. 首次使用会扫描代码，生成知识库
3. 日常开发中，涉及新实体/关系/规则时，AI **自动归档**，每轮末尾输出 `📚 知识库更新` 摘要

```
📚 项目知识库已加载 [PMEM_LOADED:V3]
- 实体索引：30 个
- 关系：45 条
- 业务规则：8 条
- 接口约定：5 条
- 基于代码版本：a1b2c3d（当前 HEAD）
```

---

## 🗂 仓库目录

```
project-memory-skills/
├── README.md                          # ← 你在这里
├── project-memory/                    # 变体 A（请求次数最少）
│   ├── README.md                      #   独立说明 + 使用场景
│   └── .agents/                       #   安装目录（cp 到 ~/.agents/）
│       ├── commands/pmem.md
│       └── skills/project-memory/
├── project-memory-compact/            # 变体 B（token 最少）
│   ├── README.md                      #   独立说明 + 使用场景
│   └── .agents/                       #   安装目录
│       ├── commands/pmem.md
│       └── skills/project-memory-compact/
└── LICENSE                            # MIT
```

---

## 🔄 切换变体

1. `rm -rf ~/.agents/skills/<旧变体名> ~/.agents/commands/pmem.md`
2. 安装新变体（`cp -r <新变体>/.agents/* ~/.agents/`）
3. 知识库（`.zcode_skills_temp/.aiknowledge/`）**保持不变**
4. 若切到 compact 变体：执行 `/pmem sync` 生成 `INDEX.yaml`

---

## 🤝 贡献

欢迎提 PR 改进状态机逻辑、锚点策略、模板质量或指令清晰度。两个变体的知识库文件格式完全兼容，请在修改时保持一致。

## 📄 License

MIT
