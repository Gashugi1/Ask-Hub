// scripts/extract-prototype.mjs
// Recovers the approved prototype from its deployed bundle. The deployed page
// serves only a loading shell: the application is inlined as base64 payloads in
// <script type="__bundler/*"> tags, and the markup arrives as a
// character-indexed JSON object rather than a string.
import fs from 'node:fs';

const URL_ = 'https://startling-rugelach-dd7204.netlify.app/';
const OUT = 'docs/prototype';

const html = await fetch(URL_).then((r) => r.text());

const payload = (kind) => {
  const m = html.match(new RegExp(`<script type="__bundler/${kind}">([\\s\\S]*?)</script>`));
  if (!m) throw new Error(`missing __bundler/${kind} payload`);
  return JSON.parse(m[1].trim());
};

// The template arrives as {0:'<',1:'!',...}. Join it back into a string.
const joinIndexed = (o) =>
  Object.keys(o).sort((a, b) => a - b).map((k) => o[k]).join('');

let markup = joinIndexed(payload('template'));
markup = markup.slice(markup.lastIndexOf('</style>') + 8);

// Pretty-print so line numbers are stable and citable.
const VOID = /^<(img|input|br|hr|meta|link|source|path|circle|rect|line|use|stop)\b/i;
let depth = 0;
const out = [];
for (let line of markup.replace(/>\s*</g, '>\n<').split('\n')) {
  line = line.trim();
  if (!line) continue;
  if (/^<\//.test(line)) depth = Math.max(0, depth - 1);
  out.push('  '.repeat(depth) + line);
  if (
    /^<[a-zA-Z]/.test(line) && !VOID.test(line) && !/\/>$/.test(line) &&
    !/^<!--/.test(line) && !/<\/[a-zA-Z-]+>$/.test(line)
  ) depth++;
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/prototype.html`, out.join('\n'));
console.log(`wrote ${OUT}/prototype.html (${out.length} lines)`);

// The roundel logo, at the resolution the prototype actually ships.
for (const [, v] of Object.entries(payload('manifest'))) {
  const asset = v && typeof v === 'object' && v.mime ? v : JSON.parse(v);
  if (asset.mime === 'image/png') {
    fs.writeFileSync(`${OUT}/askhub-roundel.png`, Buffer.from(asset.data, 'base64'));
    console.log(`wrote ${OUT}/askhub-roundel.png`);
  }
}
