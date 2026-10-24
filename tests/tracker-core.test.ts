import assert from 'node:assert/strict';
import test from 'node:test';
import { csvCell, validateAward } from '../lib/tracker-core.ts';

const award = () => ({
  title: 'Riverfront mural', type: 'mural', artistEmail: 'artist@example.com', location: 'Chicago', description: '',
  milestones: [
    { title: 'Concept', deliverable: 'Sketch', dueDate: '2026-11-01', payoutPercent: 25 },
    { title: 'Design', deliverable: 'Approved design', dueDate: '2026-11-15', payoutPercent: 35 },
    { title: 'Install', deliverable: 'Finished mural', dueDate: '2026-12-01', payoutPercent: 40 },
  ],
});

test('accepts a complete award and normalizes artist email', () => {
  const input = award(); input.artistEmail = 'ARTIST@EXAMPLE.COM';
  const result = validateAward(input);
  assert.equal(result.artistEmail, 'artist@example.com');
  assert.equal(result.milestones.length, 3);
});

test('rejects invalid dates, milestone counts, and payout totals', () => {
  const invalidDate = award(); invalidDate.milestones[0].dueDate = '2026-02-30';
  assert.throws(() => validateAward(invalidDate), /valid target dates/);
  const tooFew = award(); tooFew.milestones.pop();
  assert.throws(() => validateAward(tooFew), /3 to 5/);
  const badPayout = award(); badPayout.milestones[0].payoutPercent = 20;
  assert.throws(() => validateAward(badPayout), /total must be 100/);
});

test('prevents spreadsheet formulas in CSV exports', () => {
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  assert.equal(csvCell('A "quote"'), '"A ""quote"""');
});
