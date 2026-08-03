// session-load.mjs — SessionStart hook
// 检测知识图谱是否已加载。未加载则注入 additionalContext 提示 AI 首轮 cat 加载。
// 完全不碰 git。静默退出原则。

import { existsSync } from 'node:fs';
import { join } from 'node:path';

function getKnowledgeDir() {
  const projectRoot = process.env.ZCODE_PROJECT_DIR || process.cwd();
  return join(projectRoot, '.zcode_skills_temp', '.aiknowledge');
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(''), 2000);
  });
}

async function main() {
  const raw = await readStdin();
  // SessionStart 的 stdin 可能包含 session 信息，但我们只关心知识库是否存在
  // 不强制解析，避免格式问题导致崩溃

  const knowledgeDir = getKnowledgeDir();
  const graphFile = join(knowledgeDir, 'knowledge-graph.json');

  // 知识库不存在（项目还没 /pmem init）→ 静默
  if (!existsSync(graphFile)) return silentExit();

  // 读取 VERSION 获取当前版本
  let version = 'unknown';
  try {
    const versionFile = join(knowledgeDir, 'VERSION');
    if (existsSync(versionFile)) {
      const { readFileSync } = await import('node:fs');
      const content = readFileSync(versionFile, 'utf8');
      const match = content.match(/loaded_version=(\d+)/);
      if (match) version = match[1];
    }
  } catch {}

  // 注入提示：提醒 AI 加载图谱
  // 注意：hook 无法直接知道 AI 上下文里是否已有 [PMEM_LOADED:Vx] 标记
  // 这里只是注入"请确认是否已加载"的提示，AI 自行判断
  const ctx = `[pmem] 知识图谱已就绪（版本 V${version}）。若本轮尚未输出 [PMEM_LOADED:V${version}] 标记，请先执行：\n\`\`\`\ncat .zcode_skills_temp/.aiknowledge/knowledge-graph.json\n\`\`\`\n加载完整图谱到上下文，并输出 [PMEM_LOADED:V${version}] 标记。后续轮次无需重复加载。`;

  outputAdditionalContext(ctx);
}

function outputAdditionalContext(text) {
  const out = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: text,
    },
  };
  process.stdout.write(JSON.stringify(out));
}

function silentExit() {
  process.exit(0);
}

main().catch(() => silentExit());
