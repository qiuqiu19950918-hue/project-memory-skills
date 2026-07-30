# 🧠 Project Memory — ZCode Skill 族

[![Skill Type](https://img.shields.io/badge/type-project--memory-blue?style=flat-square)](#)
[![Slash Command](https://img.shields.io/badge/command-/pmem-333?style=flat-square)](#)
[![Platform](https://img.shields.io/badge/platform-ZCode%20%7C%20OpenCode-7c3aed?style=flat-square)](#)
[![Repo](https://img.shields.io/badge/repo-qiuqiu19950918--hue%2Fproject--memory--skills-181717?style=flat-square&logo=github)](https://github.com/qiuqiu19950918-hue/project-memory-skills)

> 让 AI 拥有「项目长期记忆」：维护版本化的结构化知识库，映射代码的实体、关系、业务规则、接口契约。每个条目携带精确的文件+行号锚点，让 AI 用 Read 直达目标——替代盲目 grep。

**仓库地址**：https://github.com/qiuqiu19950918-hue/project-memory-skills

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

## 📦 安装

```bash
# 克隆仓库
git clone https://github.com/qiuqiu19950918-hue/project-memory-skills.git
cd project-memory-skills

# 变体 A：请求次数最少（GLM-5.2 等）
cp -r project-memory/.agents/* ~/.agents/

# 或 变体 B：token 最少（DeepSeek 等）
cp -r project-memory-compact/.agents/* ~/.agents/
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

## 🔄 切换变体

1. `rm -rf ~/.agents/skills/<旧变体名> ~/.agents/commands/pmem.md`
2. 安装新变体
3. 知识库文件**保持不变**——格式兼容

---

## 🗂 仓库目录

```
project-memory-skills/
├── README.md                          # ← 你在这里
├── project-memory/                    # 变体 A（请求次数最少）
│   └── .agents/
├── project-memory-compact/            # 变体 B（token 最少）
│   └── .agents/
└── github/                            # GitHub 发布版本（含独立 README + .gitignore）
```

---

## 📄 License

MIT
