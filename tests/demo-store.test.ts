import assert from 'node:assert/strict';
import test from 'node:test';
import { createDemoStore } from '../public/demo-store.mjs';

const storage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
};
const create = (browser = storage()) => createDemoStore(browser as unknown as Storage);
const view = (demo: ReturnType<typeof create>, name: string, id?: string): any => demo.api(name, id);

test('demo starts without a user account and keeps changes in this browser', () => {
  const browser = storage();
  const demo = create(browser);
  assert.equal(view(demo, 'list').commissions.length, 2);
  assert.equal(view(demo, 'detail', 'demo-riverfront').role, 'commissioner');
  demo.action('review', { id: 'demo-riverfront', milestoneId: 'demo-riverfront-1', decision: 'approve' });
  assert.equal(view(create(browser), 'detail', 'demo-riverfront').milestones[0].status, 'approved');
  demo.setRole('artist');
  demo.action('accept', { id: 'demo-garden' });
  assert.equal(view(demo, 'detail', 'demo-garden').commission.status, 'active');
  demo.action('submit', { id: 'demo-garden', milestoneId: 'demo-garden-1', note: 'First draft ready.', attachmentIds: [] });
  assert.equal(view(demo, 'detail', 'demo-garden').milestones[0].status, 'submitted');
});

test('plan validation and reset protect the demo flow', () => {
  const demo = create();
  const plan = { title: 'Test mural', artistEmail: 'artist@example.com', type: 'mural', milestones: [1, 2, 3].map((n) => ({ title: `Phase ${n}`, deliverable: 'Deliver work', dueDate: `2027-0${n}-01`, payoutPercent: '30' })) };
  assert.throws(() => demo.action('create', plan), /total 100%/);
  plan.milestones[2].payoutPercent = '40';
  const { id } = demo.action('create', plan);
  assert.equal(view(demo, 'detail', id).commission.status, 'invited');
  demo.reset();
  assert.equal(view(demo, 'list').commissions.length, 2);
});
