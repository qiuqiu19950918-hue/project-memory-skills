# 🧠 Project Memory — Request-Count Variant

[![Optimized For](https://img.shields.io/badge/optimized%20for-request%20count-2ea44f?style=flat-square)](https://github.com/qiuqiu19950918-hue/project-memory-skills)
[![Command](https://img.shields.io/badge/command-/pmem-333?style=flat-square)](#)
[![Compatible](https://img.shields.io/badge/OpenCode-✅-7c3aed?style=flat-square)](#)

> 让 AI 真正「记住」你的项目：自动捕获每次开发中涉及的实体关系与业务规则，形成结构化的业务映射图。后续改动时即时感知关联影响，防止遗漏关键逻辑。即使开启新对话，也能秒级还原完整的项目记忆。**以请求次数最少为优化目标**。

**仓库地址**：https://github.com/qiuqiu19950918-hue/project-memory-skills （本变体位于 `project-memory/` 子目录）

---

## 🎯 适用场景

| 你用的模型 / 套餐 | 该选哪个变体 |
|:---|:---|
| **GLM-5.2 / 按请求次数计费** | ✅ **这个**（请求次数最少） |
| 上下文窗口很大（≥ 128K），不敏感 | ✅ **这个** |
| 需要多轮追问同一个项目的多个问题 | ✅ **这个** |

> 如果你用的模型按 **输入/输出 token** 计费（如 DeepSeek），请换 [project-memory-compact](../project-memory-compact)。

---

## ⚡ 请求次数明细

| 场景 | 请求次数 | 说明 |
|:---|:---:|:---|
| **新窗口首轮** | ~1 | `cat` 一条命令加载全部 5 个知识库文件 |
| **同窗口续轮** | **0** | `[PMEM_LOADED:Vx]` 标记驱动——上下文已全量加载，不重读 |
| 用户说"我 git pull 了" | 1 | 只读 `VERSION` 检测增量 |
| 自己写归档后继续 | **0** | 自己写入的内容上下文已知，不重读 |
| 回答"改 X 会影响什么" | **0** | 关系数据已在上下文中 |

---

## 📦 安装

```bash
# 克隆仓库（本变体是 monorepo 的一部分）
git clone https://github.com/qiuqiu19950918-hue/project-memory-skills.git
cd project-memory-skills

# 全局安装
cp -r project-memory/.agents/* ~/.agents/

# 或项目级安装
cp -r project-memory/.agents/* /path/to/your-project/
```

> ⚠️ 与 project-memory-compact **不能同时安装**（命令同名、目录冲突）。

---

## 🧩 目录结构

```
project-memory/.agents/
├── commands/
│   └── pmem.md                    # /pmem 命令入口
└── skills/
    └── project-memory/
        ├── SKILL.md               # 主技能指令（Load State Machine + cat 合并 + 被动检测）
        └── references/
            ├── retrieval-protocol.md
            ├── update-checklist.md
            └── templates/  (VERSION + entities.yaml + relationships.yaml + ...)
```

---

## 🔧 使用

1. 安装后重启你的 AI 编码工具
2. 在任意项目根目录输入 `/pmem`
3. AI 自动扫描代码，生成知识库
4. 后续开发中 AI **自动归档**

| 命令 | 作用 | 请求次数 |
|:---|:---|:---:|
| `/pmem` | 加载知识库 | ~1（首轮）/ 0（续轮） |
| `/pmem check` | 检查是否过期 | 1 |
| `/pmem sync` | 全量重建 | varies |
| `/pmem verify` | 增量修复 | varies |

---

## 📄 License

MIT
