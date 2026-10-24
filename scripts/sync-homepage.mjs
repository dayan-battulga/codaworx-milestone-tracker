import { cpSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const file of ['index.html', 'styles.css', 'projects.js', 'main.js']) {
  cpSync(resolve(root, file), resolve(root, 'public', file));
}
cpSync(resolve(root, 'assets'), resolve(root, 'public', 'assets'), { recursive: true, force: true });
