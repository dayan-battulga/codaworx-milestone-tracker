import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('dist/assets', { recursive: true });
for (const file of ['index.html', 'styles.css', 'projects.js', 'main.js']) {
  cpSync(file, `dist/${file}`);
}
cpSync('assets', 'dist/assets', { recursive: true, force: true });
console.log('Static site ready in dist/');
