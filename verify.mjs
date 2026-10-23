import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const context = { window: {} };
runInNewContext(readFileSync(new URL('./projects.js', import.meta.url), 'utf8'), context);
const projects = context.window.codaworxProjects;

assert.ok(projects.length >= 12, 'The homepage needs at least one page of projects.');
for (const [title, location, artist, image, avatar] of projects) {
  assert.ok(title && location && artist && image, `Incomplete project: ${title || '(untitled)'}`);
  assert.ok(existsSync(new URL(`./assets/${encodeURIComponent(image)}`, import.meta.url)), `Missing image: ${image}`);
  if (avatar) assert.ok(existsSync(new URL(`./assets/${encodeURIComponent(avatar)}`, import.meta.url)), `Missing avatar: ${avatar}`);
}
console.log(`Verified ${projects.length} projects and their local images.`);
