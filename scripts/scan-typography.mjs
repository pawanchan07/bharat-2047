/*
 * scan-typography.mjs
 *
 * Fails if an em dash, en dash, figure dash, horizontal bar, minus sign or curly quote
 * appears anywhere this project authors text: the rendered copy in src/, the code comments
 * beside it, the Workers, the build scripts and the docs a visitor reads on GitHub.
 *
 * Ported from the portfolio, which has enforced the same rule since its content pass.
 * Both sites are read as writing as much as they are used as software, and these
 * characters read as machine-set rather than written.
 *
 * Allowed and NOT flagged: ASCII hyphen-minus "-", and middot "·" which the town uses as a
 * separator in labels and status lines.
 *
 * VISION.md is deliberately exempt. It is Pawan's governing document, and repunctuating
 * somebody's own words is their call, not a script's.
 *
 * Usage: npm run verify-typography
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();

/** Directories walked in full. */
const INCLUDE_DIRS = ['src', 'scripts', 'worker'];
/** Individual authored files outside those directories. */
const INCLUDE_FILES = [
  'README.md',
  'README-BHARAT-2047.md',
  'CHECKPOINT.md',
  'CLOUD.md',
  'AGENTS.md',
  'CLAUDE.md',
];
const EXTS = new Set(['.tsx', '.ts', '.js', '.mjs', '.jsonc', '.css', '.md']);
const SKIP = new Set(['node_modules', '.next', '.git', 'out']);

const BANNED = [
  { cp: 0x2012, name: 'figure dash' },
  { cp: 0x2013, name: 'en dash' },
  { cp: 0x2014, name: 'em dash' },
  { cp: 0x2015, name: 'horizontal bar' },
  { cp: 0x2018, name: 'left single curly quote' },
  { cp: 0x2019, name: 'right single curly quote' },
  { cp: 0x201c, name: 'left double curly quote' },
  { cp: 0x201d, name: 'right double curly quote' },
  { cp: 0x2212, name: 'minus sign' },
];
const BANNED_SET = new Map(BANNED.map((b) => [b.cp, b.name]));

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(extname(entry))) out.push(full);
  }
}

const files = [];
for (const d of INCLUDE_DIRS) {
  try {
    walk(join(ROOT, d), files);
  } catch {
    /* directory may not exist in every checkout */
  }
}
for (const f of INCLUDE_FILES) {
  try {
    statSync(join(ROOT, f));
    files.push(join(ROOT, f));
  } catch {
    /* file may not exist yet */
  }
}

/**
 * The same characters can reach the screen as HTML entities without ever appearing in the
 * source, which is how six curly quotes survived the first sweep. What a visitor reads is
 * the thing being governed, so the entities are banned alongside the literals.
 */
const BANNED_ENTITIES = /&(mdash|ndash|ldquo|rdquo|lsquo|rsquo|#8211|#8212|#8216|#8217|#8220|#8221|#x201[89cd]|#x201[34]);/g;

let violations = 0;
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const rel = file.slice(ROOT.length + 1);
    for (const ch of line) {
      const cp = ch.codePointAt(0);
      if (BANNED_SET.has(cp)) {
        violations++;
        console.log(
          `  ${rel}:${i + 1}  U+${cp.toString(16).toUpperCase().padStart(4, '0')} (${BANNED_SET.get(cp)})  ::  ${line.trim().slice(0, 90)}`,
        );
      }
    }
    for (const m of line.matchAll(BANNED_ENTITIES)) {
      violations++;
      console.log(
        `  ${rel}:${i + 1}  ${m[0]} (renders as a banned character)  ::  ${line.trim().slice(0, 90)}`,
      );
    }
  });
}

console.log('');
if (violations === 0) {
  console.log(`typography scan: clean (${files.length} files, 0 banned characters)`);
  process.exit(0);
} else {
  console.log(`typography scan: FAILED with ${violations} banned character(s)`);
  process.exit(1);
}
