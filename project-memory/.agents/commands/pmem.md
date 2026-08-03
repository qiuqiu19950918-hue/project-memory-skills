---
description: 管理 Project Memory 代码知识图谱。初始化、迁移、同步、校验、查询。
---

# /pmem 命令

管理项目代码知识图谱。子命令：

## /pmem init

初始化项目的知识图谱。

执行步骤：
1. 创建数据目录 `.zcode_skills_temp/.aiknowledge/`
2. 从 skill 模板复制 knowledge-graph.json（空骨架）、VERSION、fingerprints.json（空）
3. **安装 hook**（关键步骤）：
   - 询问用户选择配置方式：
     - 方式A（配置文件）：把 hook 配置写入 `<项目>/.zcode/config.json` 的顶层 `hooks` 字段，加 `"enabled": true`
     - 方式B（插件）：若作为插件安装，hook 自动启用
   - 参考模板：`references/templates/hooks/config.json.example`
   - 复制 hook 脚本到 `.zcode_skills_temp/.aiknowledge/hooks/`
4. 提示用户：hook 完全不碰 git，跨版本控制同步需手动 `/pmem sync`
5. 输出初始化完成摘要

## /pmem migrate

从旧版 YAML 知识库迁移到图模型。

执行步骤：
1. 检查 `.aiknowledge/legacy/` 是否已存在（避免重复迁移）
2. 读取旧文件（若存在）：
   - `entities.yaml` → 转为 nodes（id=`entity:${name}`）
   - `relationships.yaml` → 转为 edges（from/to → source/target id）
   - `business-rules.md` → 转为 rules
   - `api-contracts.md` → 转为 contracts
3. 旧文件移动到 `.aiknowledge/legacy/` 备份（不删除，可回滚）
4. 生成 knowledge-graph.json（合并所有转换结果）
5. **redundant_mirror 扫描**：
   - 遍历所有 node.fields
   - 字段名含 Ids/List/集合 且类型为 String → 标记疑似冗余镜像
   - 列出疑似字段，询问用户确认是否为冗余镜像
   - 确认的：加 redundant_mirror 边 + sync 规则
6. **首次生成基线指纹**：
   - 遍历所有 node.anchor.file
   - 用 `hooks/fingerprint.mjs` 计算每个文件的指纹
   - 写入 fingerprints.json
7. bump loaded_version，输出迁移摘要

## /pmem sync [options]

全量重新扫描项目，同步知识图谱。

> 注意：hook 会自动处理"本地开发任务后的增量归档"。`/pmem sync` 主要用于**跨版本控制同步**（如 pull 了同事代码后）或**大规模重构后**的全量校准。

执行步骤：
1. 遍历项目代码文件（.java/.kt/.ts/.js 等）
2. 对每个文件算当前指纹，对比 fingerprints.json：
   - NONE → 跳过
   - COSMETIC → 跳过
   - STRUCTURAL → 标记为待重新分析
3. 对所有 STRUCTURAL 变更文件：
   - 读取内容，提取实体/字段/关系
   - 执行别名归一
   - 更新 knowledge-graph.json 对应 node/edge
   - redundant_mirror 检测
4. 更新 fingerprints.json
5. bump loaded_version，输出同步摘要

选项：
- `--full`：忽略指纹，强制全量重扫
- `--dry-run`：只输出待变更清单，不实际修改

## /pmem check

检查知识图谱与代码的一致性（只读，不修改）。

执行步骤：
1. 读取 VERSION 的 loaded_version
2. 抽样若干 node 的 anchor.file，算当前 hash 对比 anchor.hash
3. 输出一致性报告：
   - ✅ 一致的 node 数量
   - ⚠️ hash 不符的 node（建议 /pmem verify 自愈）
   - ❌ anchor.file 不存在的 node（文件已删除/移动）
4. 检查 pending-archive.json 是否有积压

## /pmem verify

校验并自愈知识图谱。

执行步骤：
1. 逐 node 对比 anchor.hash 与文件当前 hash
2. hash 不符的：
   - 重新读取文件
   - 若结构变了 → 更新 node/edge（触发别名归一 + redundant_mirror 检测）
   - 若结构没变 → 只更新 hash
3. anchor.file 不存在的：
   - 标记为孤儿 node，询问用户是否删除
4. 修复断裂的 edges（source/target 指向不存在的 node）
5. 输出自愈报告

## /pmem query <实体名或关键词>

快捷查询（等价于触发 retrieval-protocol 的 1-hop 影响分析）。

执行步骤：
1. 确保图谱已加载（无 [PMEM_LOADED:Vx] 则先 cat）
2. 按 retrieval-protocol.md 的 1-hop 算法查询
3. 返回影响范围 + 规则联动 + 冗余镜像提醒

## /pmem graph

输出知识图谱统计概览。

执行步骤：
1. 读取 knowledge-graph.json
2. 输出：
   - 版本：loaded_version / schema_version
   - 计数：node_count / edge_count / rule_count / contract_count
   - 边类型分布：one_to_many X 条 / redundant_mirror Y 条 / ...
   - 最近变更：recent_changes（最近 5 条）
   - 健康度：孤儿 node / 断裂 edges 数量

## /pmem hook test

测试 hook 是否正常工作。

执行步骤：
1. 模拟 PostToolUse 事件，向 post-tool-archive.mjs 传入测试 JSON
2. 检查 pending-archive.json 是否正确写入
3. 模拟 Stop 事件，向 stop-archive.mjs 传入测试 JSON
4. 检查是否输出 decision:block
5. 清理测试数据
6. 输出 hook 健康报告

## 通用规则

- 所有子命令执行前确认图谱已加载（除非 init/migrate）
- 修改类命令（sync/verify/migrate）执行后必须 bump loaded_version
- 所有命令完全不调用 git（跨版本控制同步靠用户手动 pull 后再 /pmem sync）
