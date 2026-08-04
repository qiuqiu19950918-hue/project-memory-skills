# Project Memory · Skill 说明

这是 Project Memory 知识图谱 skill 的主目录。

## 安装

将本目录（`project-memory/`）整体复制到：
- 用户级：`~/.agents/skills/project-memory/`
- 项目级：`<项目>/.agents/skills/project-memory/`

## 激活

安装后，ZCode 会自动匹配以下场景触发本 skill：
- 用户询问实体关系、字段含义、影响分析
- 用户要新增表/字段/接口，需要确认现有结构
- 用户输入 `/pmem <子命令>`

## 首次使用

```
/pmem init
```

会在用户项目创建 `.zcode_skills_temp/.aiknowledge/` 并引导安装 hook。

## 关键约束

- **hook 完全不碰 git**：跨版本控制同步靠手动 `/pmem sync`
- **零外部依赖**：hook 脚本仅用 Node.js 内置模块（crypto/fs/path）
- **单一变体**：本目录是唯一变体，已合并旧 compact 版

## 文件清单

- `SKILL.md` — 核心，AI 首先读这个
- `references/graph-protocol.md` — 图模型规范（节点/边/规则/契约/别名表/redundant_mirror）
- `references/retrieval-protocol.md` — 1-hop 检索算法
- `references/update-checklist.md` — 归档检查清单
- `references/templates/` — 各类模板（knowledge-graph.json/fingerprints.json/VERSION/hooks 配置/viewer.html 可视化查看器）
- `hooks/` — 自动归档脚本（fingerprint/post-tool-archive/stop-archive/session-load）
- `references/templates/viewer.html` — 可视化查看器（浏览器打开选 JSON 即看图）
- `commands/pmem.md` — /pmem 命令定义（含 `/pmem view` 可视化）

## 可视化查看

执行 `/pmem view` 会用浏览器打开 `viewer.html`，选择项目的 `knowledge-graph.json` 即可看交互式图谱：节点按 layer 上色、redundant_mirror 红虚线高亮、悬停看详情。详见 `/pmem view` 命令说明。
