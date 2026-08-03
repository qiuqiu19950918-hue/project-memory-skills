# Project Memory · Skill 说明（v2.0 知识图谱版）

这是 Project Memory 的 skill 本体目录。本版本（v2.0）相对 v1 做了架构级重写。

## 📢 本版本改进点速览

| 改进 | 针对 | 优化 |
|---|---|---|
| 单一 knowledge-graph.json | v1 的 5 个分散 YAML 文件 | 统一 ID，支持图遍历 |
| 1-hop 邻居扩展检索 | v1 的字符串匹配 | 发现传递关系 + 规则联动 |
| redundant_mirror 机制 | v1 无专项处理 | 自动识别冗余字段并提醒同步 |
| hook 自动归档 | v1 靠 AI 自觉 | PostToolUse+Stop 强制，不漏归档 |
| 指纹增量更新 | v1 全量重扫 | NONE/COSMETIC/STRUCTURAL 三级跳过 |
| 别名容错 | v1 遇错即废 | normalize before write |
| 单一变体 | v1 双变体维护 | 废弃 compact，合并 |

详见根目录 README 的"本版本改进"章节。

## 安装

将本目录（`project-memory/`）整体复制到：
- 用户级：`~/.agents/skills/project-memory/`
- 项目级：`<项目>/.agents/skills/project-memory/`

命令文件 `.agents/commands/pmem.md` 复制到 `~/.agents/commands/pmem.md`。

## 首次使用

```
/pmem init
```
在用户项目创建 `.zcode_skills_temp/.aiknowledge/` 并引导安装 hook。

## 关键约束

- **hook 完全不碰 git**：跨版本控制同步靠手动 `/pmem sync`
- **零外部依赖**：hook 脚本仅用 Node.js 内置模块（crypto/fs/path）
- **单一变体**：本目录是唯一变体，已合并旧 compact 版（v1 用户迁移后功能等价）

## 文件清单

- `SKILL.md` — 核心，AI 首先读这个
- `references/graph-protocol.md` — 图模型规范（节点/边/规则/契约/别名表/redundant_mirror）
- `references/retrieval-protocol.md` — 1-hop 检索算法
- `references/update-checklist.md` — 归档检查清单
- `references/templates/` — 各类模板（knowledge-graph.json/fingerprints.json/VERSION/hooks 配置）
- `hooks/` — 自动归档脚本（v2.0 新增：fingerprint/post-tool-archive/stop-archive/session-load）
- `commands/pmem.md` — /pmem 命令定义（8 个子命令）

## 从 v1 迁移

```
/pmem migrate
```
自动转换旧 YAML 知识库到 knowledge-graph.json，旧文件备份到 `legacy/`。
