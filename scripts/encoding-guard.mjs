import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DEFAULT_TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.css',
  '.scss',
  '.html',
  '.yml',
  '.yaml',
  '.txt',
]);

const MOJIBAKE_RE = /(?:å|ä¸|ä»|çš„|ç¬¬|é€|é¢|æ­£åœ¨|鍙|鎵|姝ｅ湪|璇|鐢|閿|闂|鈥|锛|銆)/;

const usage = () => {
  console.log(`encoding-guard

Usage:
  node scripts/encoding-guard.mjs inspect <file ...>
  node scripts/encoding-guard.mjs snapshot <manifest.json> <file ...>
  node scripts/encoding-guard.mjs check <manifest.json>
`);
};

const toAbsolute = (filePath) => path.resolve(process.cwd(), filePath);

const isLikelyText = (filePath) => DEFAULT_TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());

const sha256 = (buffer) =>
  crypto.createHash('sha256').update(buffer).digest('hex');

const hasUtf8Bom = (buffer) =>
  buffer.length >= 3 &&
  buffer[0] === 0xef &&
  buffer[1] === 0xbb &&
  buffer[2] === 0xbf;

const hasUtf16LeBom = (buffer) =>
  buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe;

const hasUtf16BeBom = (buffer) =>
  buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff;

const isValidUtf8 = (buffer) => {
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return { ok: true, text: decoded };
  } catch {
    return { ok: false, text: '' };
  }
};

const decodeWithWindows936Fallback = (buffer) => {
  try {
    return new TextDecoder('gbk', { fatal: false }).decode(buffer);
  } catch {
    return '';
  }
};

const countCjkChars = (text) => (text.match(/[\u3400-\u9fff]/g) || []).length;

const inspectBuffer = (buffer) => {
  if (hasUtf8Bom(buffer)) {
    const text = new TextDecoder('utf-8').decode(buffer.slice(3));
    return { encoding: 'utf-8-bom', text };
  }
  if (hasUtf16LeBom(buffer)) {
    const text = new TextDecoder('utf-16le').decode(buffer.slice(2));
    return { encoding: 'utf-16le-bom', text };
  }
  if (hasUtf16BeBom(buffer)) {
    const swapped = Buffer.from(buffer.slice(2));
    for (let i = 0; i + 1 < swapped.length; i += 2) {
      const tmp = swapped[i];
      swapped[i] = swapped[i + 1];
      swapped[i + 1] = tmp;
    }
    const text = new TextDecoder('utf-16le').decode(swapped);
    return { encoding: 'utf-16be-bom', text };
  }

  const utf8 = isValidUtf8(buffer);
  if (utf8.ok) {
    return { encoding: 'utf-8', text: utf8.text };
  }

  const gbkText = decodeWithWindows936Fallback(buffer);
  if (gbkText) {
    return { encoding: 'gbk/cp936?', text: gbkText };
  }

  return { encoding: 'binary/unknown', text: '' };
};

const analyzeText = (text) => {
  const normalized = String(text || '');
  const cjkCount = countCjkChars(normalized);
  const mojibakeMatches = normalized.match(MOJIBAKE_RE);
  const replacementCharCount = (normalized.match(/\uFFFD/g) || []).length;
  const suspicionScore =
    (mojibakeMatches ? 1 : 0) +
    (replacementCharCount > 0 ? 1 : 0) +
    (cjkCount === 0 && /[\u0080-\uFFFF]/.test(normalized) ? 1 : 0);

  return {
    cjkCount,
    replacementCharCount,
    mojibakeDetected: Boolean(mojibakeMatches),
    suspicious: suspicionScore >= 2 || (Boolean(mojibakeMatches) && replacementCharCount > 0),
  };
};

const inspectFile = (filePath) => {
  const absPath = toAbsolute(filePath);
  const buffer = fs.readFileSync(absPath);
  const { encoding, text } = inspectBuffer(buffer);
  const textAnalysis = analyzeText(text);

  return {
    file: absPath,
    size: buffer.length,
    sha256: sha256(buffer),
    encoding,
    textLikely: isLikelyText(absPath),
    ...textAnalysis,
  };
};

const ensureFiles = (files) => {
  if (!files.length) {
    usage();
    process.exit(1);
  }
};

const command = process.argv[2];

if (!command || command === '--help' || command === '-h') {
  usage();
  process.exit(0);
}

if (command === 'inspect') {
  const files = process.argv.slice(3);
  ensureFiles(files);
  const report = files.map(inspectFile);
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

if (command === 'snapshot') {
  const manifestPath = process.argv[3];
  const files = process.argv.slice(4);
  if (!manifestPath) {
    usage();
    process.exit(1);
  }
  ensureFiles(files);
  const report = files.map(inspectFile);
  fs.writeFileSync(
    toAbsolute(manifestPath),
    `${JSON.stringify({ createdAt: new Date().toISOString(), files: report }, null, 2)}\n`,
    'utf8',
  );
  console.log(`wrote ${toAbsolute(manifestPath)}`);
  process.exit(0);
}

if (command === 'check') {
  const manifestPath = process.argv[3];
  if (!manifestPath) {
    usage();
    process.exit(1);
  }
  const absManifestPath = toAbsolute(manifestPath);
  const manifest = JSON.parse(fs.readFileSync(absManifestPath, 'utf8'));
  const issues = [];

  for (const item of manifest.files || []) {
    if (!fs.existsSync(item.file)) {
      issues.push({ file: item.file, issue: 'missing' });
      continue;
    }
    const next = inspectFile(item.file);
    if (next.encoding !== item.encoding) {
      issues.push({
        file: item.file,
        issue: 'encoding-changed',
        before: item.encoding,
        after: next.encoding,
      });
    }
    if (item.suspicious === false && next.suspicious === true) {
      issues.push({
        file: item.file,
        issue: 'became-suspicious',
      });
    }
  }

  if (issues.length > 0) {
    console.log(JSON.stringify({ ok: false, issues }, null, 2));
    process.exit(2);
  }

  console.log(JSON.stringify({ ok: true, checked: (manifest.files || []).length }, null, 2));
  process.exit(0);
}

usage();
process.exit(1);
