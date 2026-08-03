// post-tool-archive.mjs — PostToolUse hook
// 监听 Write|Edit 工具。计算改动文件指纹，STRUCTURAL 变更写入 pending-archive.json。
// 完全不碰 git。静默退出原则。

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { computeFingerprint, compareFingerprints } from './fingerprint.mjs';

// 知识库根目录（运行时在用户项目的 .zcode_skills_temp/.aiknowledge 下）
// hook 通过 ZCODE_PROJECT_DIR 环境变量或 stdin 的 cwd 推断项目根
function getKnowledgeDir(cwd) {
  const projectRoot = process.env.ZCODE_PROJECT_DIR || cwd || process.cwd();
  return join(projectRoot, '.zcode_skills_temp', '.aiknowledge');
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(''), 2000); // 2秒超时保护
  });
}

async function main() {
  const raw = await readStdin();
  if (!raw || raw.trim() === '') return silentExit(); // 空 stdin

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return silentExit(); // 解析失败静默
  }

  // 只处理 Write/Edit
  const tool = payload.tool_name;
  if (tool !== 'Write' && tool !== 'Edit' && tool !== 'MultiEdit') return silentExit();

  const toolInput = payload.tool_input || {};
  const filePath = toolInput.file_path;
  if (!filePath) return silentExit();

  // 只关心代码文件（java/ts/js/kt 等），跳过 md/yaml/json 等
  if (!isCodeFile(filePath)) return silentExit();

  // 知识库目录
  const cwd = payload.cwd || process.cwd();
  const knowledgeDir = getKnowledgeDir(cwd);

  // 若知识库还没初始化（无 knowledge-graph.json），静默跳过
  const graphFile = join(knowledgeDir, 'knowledge-graph.json');
  if (!existsSync(graphFile)) return silentExit();

  // 读取文件内容（从 tool_input 取，或从磁盘读）
  let content = toolInput.content;
  if (content === undefined && tool === 'Edit') {
    // Edit 工具：拿 new_string 拼接近似内容（粗糙但够判 STRUCTURAL）
    content = (toolInput.old_string || '') + '\n' + (toolInput.new_string || '');
  }
  if (content === undefined) {
    try { content = readFileSync(filePath, 'utf8'); } catch { return silentExit(); }
  }

  // 计算新指纹
  const newFp = computeFingerprint(filePath, content);

  // 加载旧指纹库
  const fpFile = join(knowledgeDir, 'fingerprints.json');
  let fpStore = {};
  try {
    if (existsSync(fpFile)) fpStore = JSON.parse(readFileSync(fpFile, 'utf8'));
  } catch { fpStore = {}; }

  // 排除知识库自身的文件（避免改 knowledge-graph.json 触发循环）
  const projectRoot = process.env.ZCODE_PROJECT_DIR || cwd || process.cwd();
  const relPath = toRelativePath(filePath, projectRoot);
  if (relPath.includes('.zcode_skills_temp') || relPath.includes('.aiknowledge')) return silentExit();

  const oldFp = fpStore[relPath] || null;
  const level = compareFingerprints(oldFp, newFp);

  // NONE/COSMETIC 跳过，STRUCTURAL 标记待归档
  if (level !== 'STRUCTURAL') return silentExit();

  // 写入 pending-archive.json
  const pendingFile = join(knowledgeDir, 'pending-archive.json');
  let pending = { items: [] };
  try {
    if (existsSync(pendingFile)) pending = JSON.parse(readFileSync(pendingFile, 'utf8'));
  } catch { pending = { items: [] }; }
  if (!pending.items) pending.items = [];

  // 去重：同一文件只记一条
  pending.items = pending.items.filter((x) => x.file !== relPath);
  pending.items.push({
    file: relPath,
    changedType: 'STRUCTURAL',
    ts: new Date().toISOString(),
  });

  mkdirSync(dirname(pendingFile), { recursive: true });
  writeFileSync(pendingFile, JSON.stringify(pending, null, 2));

  // 注入 additionalContext 提示 AI（可选，主要靠 Stop hook 兜底）
  const ctx = `[pmem] 检测到结构变更：${relPath}（${level}）。本轮结束时会自动触发归档。若你认为这是误判，可忽略。`;
  outputAdditionalContext(ctx);
}

function isCodeFile(filePath) {
  const lower = filePath.toLowerCase();
  return ['.java', '.kt', '.ts', '.tsx', '.js', '.jsx', '.py'].some((ext) => lower.endsWith(ext));
}

function toRelativePath(absPath, root) {
  const norm = absPath.replace(/\\/g, '/');
  const normRoot = root.replace(/\\/g, '/');
  if (norm.startsWith(normRoot)) return norm.slice(normRoot.length).replace(/^\//, '');
  return norm; // 已是相对路径
}

function outputAdditionalContext(text) {
  // 严格 schema：只能有 hookSpecificOutput.{hookEventName, additionalContext}
  const out = {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: text,
    },
  };
  process.stdout.write(JSON.stringify(out));
}

function silentExit() {
  process.exit(0);
}

main().catch(() => silentExit());
