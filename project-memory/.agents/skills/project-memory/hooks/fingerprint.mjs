// fingerprint.mjs — Project Memory 文件指纹库（零依赖）
// 功能：SHA-256 + 正则提取结构签名 + 三级变更分类（NONE/COSMETIC/STRUCTURAL）
// 完全不碰 git。仅依赖 node:crypto 和 node:fs。

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// === 变更级别 ===
// NONE       : contentHash 相同 → 跳过
// COSMETIC   : hash 变但 structKeys 一致 → 跳过（仅内部逻辑变）
// STRUCTURAL : structKeys 变化 → 标记待归档

/**
 * 计算 SHA-256 内容哈希
 * @param {string} content 文件内容
 * @returns {string} hex 哈希
 */
export function computeContentHash(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 12);
}

/**
 * 正则提取文件的结构签名（类/字段/方法/import 名单）
 * 支持 Java/TypeScript/JavaScript。其他语言保守返回 null（调用方按 STRUCTURAL 处理）。
 * @param {string} content 文件内容
 * @param {string} filePath 文件路径（用于判定语言）
 * @returns {{classes:string[], fields:string[], methods:string[], imports:string[]} | null}
 */
export function extractStructKeys(content, filePath) {
  const lang = detectLanguage(filePath);
  if (!lang) return null; // 未知语言，调用方应按 STRUCTURAL 处理

  if (lang === 'java') return extractJava(content);
  if (lang === 'typescript' || lang === 'javascript') return extractTsJs(content);
  return null;
}

function detectLanguage(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.java')) return 'java';
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs')) return 'javascript';
  if (lower.endsWith('.kt')) return 'kotlin'; // 暂用 java 提取器近似
  if (lower.endsWith('.py')) return 'python';
  return null; // .md/.yaml/.json/其他 → 未知，按 STRUCTURAL 保守处理
}

function extractJava(content) {
  const classes = [];
  const fields = [];
  const methods = [];
  const imports = [];

  // class/interface/enum/record 声明
  const classRe = /(?:public\s+|private\s+|protected\s+)?(?:abstract\s+|final\s+|static\s+)?(?:class|interface|enum|record)\s+(\w+)/g;
  let m;
  while ((m = classRe.exec(content)) !== null) classes.push(m[1]);

  // import
  const importRe = /import\s+(?:static\s+)?([\w.*]+)/g;
  while ((m = importRe.exec(content)) !== null) imports.push(m[1]);

  // 字段声明（含注解）：修饰符? 类型 名字 ;
  // 例: private String repairPartIds;  /  @TableField("x") private Long id;
  const fieldRe = /(?:@\w+(?:\([^)]*\))?\s*)*(?:public|protected|private|static|final|volatile|transient|\s)+([\w<>\[\],\s]+?)\s+(\w+)\s*[;=]/g;
  while ((m = fieldRe.exec(content)) !== null) {
    const name = m[2];
    // 排除关键字和已知类名（避免把 class 名当字段）
    if (!['class', 'interface', 'enum', 'record', 'return', 'if', 'for', 'while', 'switch', 'catch', 'new'].includes(name) && !classes.includes(name)) {
      fields.push(name);
    }
  }

  // 方法签名：修饰符? 返回类型 名字(参数)
  const methodRe = /(?:public|protected|private|static|final|synchronized|\s)+([\w<>\[\]]+)\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w.,\s]+)?\s*\{/g;
  while ((m = methodRe.exec(content)) !== null) {
    const name = m[2];
    if (!['if', 'for', 'while', 'switch', 'catch', 'synchronized', 'return'].includes(name)) {
      methods.push(name);
    }
  }

  return { classes: dedup(classes), fields: dedup(fields), methods: dedup(methods), imports: dedup(imports) };
}

function extractTsJs(content) {
  const classes = [];
  const fields = [];
  const methods = [];
  const imports = [];

  const classRe = /(?:export\s+)?(?:default\s+)?(?:abstract\s+)?(?:class|interface)\s+(\w+)/g;
  let m;
  while ((m = classRe.exec(content)) !== null) classes.push(m[1]);

  const importRe = /import\s+[^;]*?from\s+['"]([^'"]+)['"]/g;
  while ((m = importRe.exec(content)) !== null) imports.push(m[1]);

  // TS 字段：name?: type; 或 name = value;
  const fieldRe = /(?:public|private|protected|readonly|static|\s)*(\w+)\s*[?:]?\s*[:=]/g;
  while ((m = fieldRe.exec(content)) !== null) {
    const name = m[1];
    if (!['class', 'interface', 'const', 'let', 'var', 'function', 'return', 'if', 'for', 'while', 'import', 'export', 'default'].includes(name) && !classes.includes(name)) {
      fields.push(name);
    }
  }

  // 方法：name(...) {
  const methodRe = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[\w<>\[\]\|]+)?\s*\{/g;
  while ((m = methodRe.exec(content)) !== null) {
    const name = m[1];
    if (!['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(name)) methods.push(name);
  }

  return { classes: dedup(classes), fields: dedup(fields), methods: dedup(methods), imports: dedup(imports) };
}

function dedup(arr) {
  return [...new Set(arr)].sort();
}

/**
 * 比对新旧指纹，返回变更级别
 * @param {{contentHash:string, structKeys:object}|null} oldFp 旧指纹（null 表示新文件）
 * @param {{contentHash:string, structKeys:object|null}} newFp 新指纹
 * @returns {'NONE'|'COSMETIC'|'STRUCTURAL'}
 */
export function compareFingerprints(oldFp, newFp) {
  if (!oldFp) return 'STRUCTURAL'; // 新文件，必须归档

  if (oldFp.contentHash === newFp.contentHash) return 'NONE'; // 完全没变

  // hash 变了，看结构签名
  if (!newFp.structKeys) return 'STRUCTURAL'; // 未知语言，保守按结构变

  if (!oldFp.structKeys) return 'STRUCTURAL'; // 旧指纹没结构签名，保守

  // 比较 structKeys 四个名单
  const keys = ['classes', 'fields', 'methods', 'imports'];
  for (const k of keys) {
    const oldSet = JSON.stringify(oldFp.structKeys[k] || []);
    const newSet = JSON.stringify(newFp.structKeys[k] || []);
    if (oldSet !== newSet) return 'STRUCTURAL';
  }
  return 'COSMETIC'; // hash 变但结构签名一致 → 仅内部逻辑变
}

/**
 * 计算文件的完整指纹（contentHash + structKeys）
 * @param {string} filePath 项目相对路径
 * @param {string} content 文件内容（已读取则传入，避免重复 IO）
 * @returns {{contentHash:string, structKeys:object|null}}
 */
export function computeFingerprint(filePath, content) {
  return {
    contentHash: computeContentHash(content),
    structKeys: extractStructKeys(content, filePath),
  };
}

// === CLI 测试入口：node fingerprint.mjs <file> ===
// 当直接运行此脚本（非 import）时，打印指定文件的指纹
const isMain = process.argv[1] && process.argv[1].endsWith('fingerprint.mjs');
if (isMain) {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node fingerprint.mjs <filePath>');
    process.exit(0); // 静默退出
  }
  try {
    const content = readFileSync(target, 'utf8');
    const fp = computeFingerprint(target, content);
    console.log(JSON.stringify(fp, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(0); // 静默退出
  }
}
