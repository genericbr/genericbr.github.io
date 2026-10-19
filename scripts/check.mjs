import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('..', import.meta.url));
let errors = 0;
async function walk(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['qa','.rcs','.git','node_modules','dist'].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path)); else paths.push(path);
  }
  return paths;
}
for (const file of await walk(root)) {
  if (/\.(m?js|cjs)$/.test(file)) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) { console.error(result.stderr); errors++; }
  }
  if (/\.html$/.test(file)) {
    const source = await readFile(file,'utf8');
    for (const match of source.matchAll(/(?:src|href)="([^"#?]+)(?:\?[^"#]*)?"/g)) {
      if (/^(https?:|mailto:)/.test(match[1]) || !/\.(?:css|m?js|png|jpg|svg|html)$/.test(match[1])) continue;
      const target = resolve(root, match[1].replace(/^\//,''));
      try { await readFile(target); } catch { console.error('Missing local asset:', match[1]); errors++; }
    }
  }
}
if (errors) process.exitCode = 1;
else console.log('Syntax and local asset references: PASS');
