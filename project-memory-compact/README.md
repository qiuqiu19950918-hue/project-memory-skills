# 🧠 Project Memory — Token-Minimal Variant

[![Optimized For](https://img.shields.io/badge/optimized%20for-token%20usage-2ea44f?style=flat-square)](https://github.com/qiuqiu19950918-hue/project-memory-skills)
[![Command](https://img.shields.io/badge/command-/pmem-333?style=flat-square)](#)
[![Compatible](https://img.shields.io/badge/OpenCode-✅-7c3aed?style=flat-square)](#)

> 让 AI 真正「记住」你的项目：自动捕获每次开发中涉及的实体关系与业务规则，形成结构化的业务映射图。后续改动时即时感知关联影响，防止遗漏关键逻辑。即使开启新对话，也能秒级还原完整的项目记忆。**以单次上下文 token 最少为优化目标**。

**仓库地址**：https://github.com/qiuqiu19950918-hue/project-memory-skills （本变体位于 `project-memory-compact/` 子目录）

---

## 🎯 适用场景

| 你用的模型 / 套餐 | 该选哪个变体 |
|:---|:---|
| **DeepSeek V4 / 按输入输出 token 计费** | ✅ **这个**（token 最少） |
| 上下文窗口有限（如 64K），需要精打细算 | ✅ **这个** |
| 查询通常是"查一两个表"而非全库遍历 | ✅ **这个** |

> 如果你用的模型按 **请求次数** 计费（如 GLM-5.2，1M 上下文窗口），请换 [project-memory](../project-memory)。

---

## 🚀 与其他变体的区别

| 场景 | Token 量 | 请求次数 |
|:---|:---:|:---:|
| 新窗口首轮 | ~1–3K | ~1（cat INDEX + relationships + VERSION） |
| 同窗口续轮 | ~200 | 1（读 VERSION 主动检测外部变更） |
| 查询"User 有哪些字段" | ~500（一次 scoped Read） | 1 |
| 查询"改 User 影响谁" | ~0（关系已在上下文） | 0 |

1. **首轮**：只加载 `INDEX.yaml`（name + table + 描述 + anchor，无字段清单），不加载 40K token 的 entities.yaml
2. **查询时**：按 INDEX 中的 anchor 坐标，Read 单实体源码块
3. **续轮主动检测**：每轮自动读 VERSION，不漏检 `git pull` 进来的外部变更

---

## 📦 安装

```bash
# 克隆仓库（本变体是 monorepo 的一部分）
git clone https://github.com/qiuqiu19950918-hue/project-memory-skills.git
cd project-memory-skills

# 全局安装
cp -r project-memory-compact/.agents/* ~/.agents/

# 或项目级安装
cp -r project-memory-compact/.agents/* /path/to/your-project/
```

> ⚠️ 与 project-memory **不能同时安装**（命令同名、目录冲突）。

---

## 🧩 目录结构

```
project-memory-compact/.agents/
├── commands/
│   └── pmem.md
└── skills/
    └── project-memory-compact/
        ├── SKILL.md                     # 精简索引 + 主动 VERSION 检测 + anchor 按需读
        └── references/
            ├── indexing-protocol.md     # ⭐ INDEX.yaml 结构说明（本变体特有）
            ├── retrieval-protocol.md
            ├── update-checklist.md
            └── templates/  (VERSION + INDEX.yaml + entities.yaml + relationships.yaml + ...)
```

---

## 🔧 使用

1. 安装后重启你的 AI 编码工具
2. 在项目根目录输入 `/pmem`
3. AI 自动扫描代码，生成 `entities.yaml` → 派生 `INDEX.yaml`
4. 之后每次查实体字段，按 anchor 精确 Read，不加载整份 entities.yaml

| 命令 | 作用 | 特征 |
|:---|:---|:---|
| `/pmem` | 加载知识库 | token 少，主动检测外部变更 |
| `/pmem check` | 检查是否过期 | 1 请求，~200 token |
| `/pmem sync` | 全量重建 + 重新生成 INDEX.yaml | 覆盖草稿 |
| `/pmem verify` | 增量修复 + 重新同步 INDEX.yaml | 保留草稿 |

---

## 📄 License

MIT
