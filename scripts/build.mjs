import { mkdir, cp, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const destination = resolve(root, 'dist');
await mkdir(destination, { recursive: true });
for (const name of ['index.html','404.html','style.css','dashboard.html','dashboard.css','config.js','js','images']) {
  await cp(resolve(root, name), resolve(destination, name), { recursive: true });
}
await writeFile(resolve(destination, '.nojekyll'), '');
console.log('Static site ready in dist/');
