# 🧠 Project Memory — Token-Minimal Variant

[![Optimized For](https://img.shields.io/badge/optimized%20for-token%20usage-2ea44f?style=flat-square)](https://github.com)
[![Command](https://img.shields.io/badge/command-/pmem-333?style=flat-square)](#)
[![Compatible](https://img.shields.io/badge/ZCode-✅-0a84ff?style=flat-square)](#)
[![Compatible](https://img.shields.io/badge/OpenCode-✅-7c3aed?style=flat-square)](#)

> 为 AI 提供「项目长期记忆」：维护一个版本化的结构化知识库，映射项目的实体、关系、业务规则、接口契约。**以单次上下文 token 最少为优化目标**——首轮只加载轻量索引（~1.5K token），字段定义按锚点按需读取。

---

## 🎯 This Variant — For Whom?

| 你用的模型 / 套餐 | 计费方式 | 该选哪个变体 |
|:---|:---|:---|
| **DeepSeek V4 / 按输入输出 token 计费** | 每 token 计费，上下文越大越贵 | ✅ **这个**（token 最少） |
| 上下文窗口有限（如 64K），需要精打细算 | 大文件一次加载就耗尽窗口 | ✅ **这个** |
| 查询通常是"查一两个表"而非全库遍历 | 按需获取比全量加载更经济 | ✅ **这个** |

> 如果你用的模型按 **请求次数** 计费（如 GLM-5.2，1M 上下文窗口），请换 [project-memory](../project-memory)。

---

## 🚀 What It Does — Differently

这个变体**不会**首轮加载 40K token 的 entities.yaml。取而代之：

1. **首轮**：只加载 `INDEX.yaml`（每个实体：name + table + 一句话描述 + anchor，无字段清单）+ `relationships.yaml`（关系图）+ `VERSION`。总计 **~1–3K token**。
2. **查询实体字段**：按 `INDEX.yaml` 的 anchor 坐标，用 `Read` 的 offset/limit **只读那一个实体的源码块**（~500 token，1 次请求）。
3. **续轮主动检测**：每轮自动读 `VERSION`（~200 token）对比版本——不漏检 `git pull` 进来的外部变更。

| 场景 | Token 量 | 请求次数 |
|:---|:---:|:---:|
| 新窗口首轮 | ~1–3K | ~1（cat INDEX + relationships + VERSION） |
| 同窗口续轮 | ~200 | 1（读 VERSION 主动检测） |
| 查询"User 有哪些字段" | ~500（一次 scoped Read） | 1 |
| 查询"改 User 影响谁" | ~0（关系已在上下文） | 0 |
| `/pmem check` | ~200 | 1 |

---

## 📦 Installation

### 全局安装

```bash
git clone https://github.com/your-org/project-memory-compact.git
cp -r project-memory-compact/.agents/* ~/.agents/
```

### 项目级安装

```bash
cp -r project-memory-compact/.agents/* /path/to/your-project/.agents/
```

> ⚠️ 与 [project-memory](../project-memory) **不能同时安装**。先删旧 variant 再装新的。

---

## 🧩 What's Inside

```
.agents/
├── commands/
│   └── pmem.md
└── skills/
    └── project-memory-compact/
        ├── SKILL.md                     # 主技能指令（精简索引 + 主动 VERSION 检测 + anchor 按需读）
        └── references/
            ├── indexing-protocol.md     # ⭐ INDEX.yaml 结构说明与重生规则（本变体特有）
            ├── retrieval-protocol.md    # 按需获取阶梯 + 哈希策略 + 提交规则
            ├── update-checklist.md      # 详细更新条件 + 锚点 + INDEX 同步维护
            └── templates/
                ├── VERSION              # 版本指纹文件
                ├── INDEX.yaml           # ⭐ 轻量实体索引（本变体特有，派生自 entities.yaml）
                ├── entities.yaml        # 完整实体定义（按需读取的 backing store）
                ├── relationships.yaml   # 关系定义（全量加载——它是影响图）
                ├── business-rules.md    # 业务规则模板
                ├── api-contracts.md     # API 契约模板
                └── sources.yaml         # 扫描路径配置
```

---

## 🔧 Quick Start

1. 安装后重启 ZCode/OpenCode
2. 在项目根目录输入 `/pmem`
3. AI 自动扫描代码，生成 `entities.yaml` → 然后从它派生 `INDEX.yaml`
4. 之后每次查询实体字段，AI 会按 INDEX 中的 anchor **精确 Read** 对应源码块，不加载整份 entities.yaml

### 命令一览

| 命令 | 作用 | 特征 |
|:---|:---|:---|
| `/pmem` | 加载知识库（首轮 INDEX+rels，续轮 VERSION 主动检测） | token 少 |
| `/pmem check` | 检查知识库是否过期 | 1 请求，~200 token |
| `/pmem sync` | 全量重建 + 重新生成 INDEX.yaml | 覆盖草稿 |
| `/pmem verify` | 增量修复 + 重新同步 INDEX.yaml | 保留草稿 |

---

## 🔄 Switching from the request-count variant

1. `rm -rf ~/.agents/skills/project-memory ~/.agents/commands/pmem.md`
2. 安装本变体（见上）
3. 知识库文件**无需重建**——格式兼容
4. 在项目目录执行 `/pmem sync` 生成 `INDEX.yaml`（或 `/pmem verify` 增量生成）

---

## 💡 When INDEX out-of-sync

`INDEX.yaml` 和 `entities.yaml` 必须保持一致。以下情况 INDEX 可能过期：

- 编辑了 entities.yaml 但未重新生成 INDEX
- `/pmem verify` 治愈了锚点但忘记同步到 INDEX

**修复**：执行 `/pmem verify`（会自动重新同步 INDEX）或 `/pmem sync`（全量重建）。

---

## 📄 License

MIT
