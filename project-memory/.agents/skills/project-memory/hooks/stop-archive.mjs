// stop-archive.mjs — Stop hook
// AI 准备结束回复时触发。若有待归档文件，输出 decision:block 请求 continuation（≤3次）。
// 完全不碰 git。静默退出原则。

import { readFileSync, existsSync, unlinkSync } from 'node:fs';
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
  if (!raw || raw.trim() === '') return silentExit();

  let payload;
  try { payload = JSON.parse(raw); } catch { return silentExit(); }

  if (payload.hook_event_name !== 'Stop') return silentExit();

  // 检查 pending-archive.json
  const pendingFile = join(getKnowledgeDir(), 'pending-archive.json');
  if (!existsSync(pendingFile)) return silentExit();

  let pending;
  try { pending = JSON.parse(readFileSync(pendingFile, 'utf8')); }
  catch {
    // 文件损坏，清除并静默
    try { unlinkSync(pendingFile); } catch {}
    return silentExit();
  }

  const items = pending.items || [];
  if (items.length === 0) {
    try { unlinkSync(pendingFile); } catch {}
    return silentExit();
  }

  // 防无限循环：检查标记的累积次数（同一批 pending 最多拽回 3 次）
  const attemptCount = pending.attemptCount || 0;
  if (attemptCount >= 3) {
    // 超过 3 次，放弃自动归档，提示用户手动 sync
    const ctx = `[pmem] 有 ${items.length} 个文件待归档但已超过 3 次自动续做上限。请手动执行 /pmem sync 处理这些文件：${items.map((i) => i.file).join(', ')}`;
    outputStop(ctx, false); // 不再 block，只提示
    try { unlinkSync(pendingFile); } catch {}
    return;
  }

  // 递增 attemptCount
  pending.attemptCount = attemptCount + 1;
  const { writeFileSync } = await import('node:fs');
  writeFileSync(pendingFile, JSON.stringify(pending, null, 2));

  // 输出 decision:block 请求 continuation
  const fileList = items.map((i) => `  - ${i.file}`).join('\n');
  const reason = `[pmem] 检测到 ${items.length} 个文件结构变更待归档：\n${fileList}\n\n请按 update-checklist.md 流程：\n1. 读取这些文件\n2. 提取实体/字段/关系（含 redundant_mirror 检测）\n3. 更新 knowledge-graph.json\n4. 更新 fingerprints.json（为新文件算指纹）\n5. bump meta.loaded_version\n6. 清除 .zcode_skills_temp/.aiknowledge/pending-archive.json\n归档完成后才可结束本轮回复。`;

  outputStop(reason, true);
}

function outputStop(reason, block) {
  // 严格 schema：Stop 事件下 decision:block 表示"不要停，继续"
  const out = block
    ? { decision: 'block', reason }
    : { hookSpecificOutput: { hookEventName: 'Stop', additionalContext: reason } };
  process.stdout.write(JSON.stringify(out));
}

function silentExit() {
  process.exit(0);
}

main().catch(() => silentExit());
