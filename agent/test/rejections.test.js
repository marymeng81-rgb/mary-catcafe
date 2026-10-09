import test from 'node:test';
import assert from 'node:assert/strict';
import { Job } from '../jobs.js';
import { assembleResults } from '../evidence.js';

test('unread or unconfirmed exclusions are uncertainty, not invented ineligibility', () => {
  const job = new Job({ logger: () => {} });
  const draft = { opportunities: [], summary: 'Must not copy unsupported claims from the draft.', ruledOut: [
    { name: 'Unread', decision: 'ineligible', reason: 'A supposed age restriction', sourceUrls: ['https://example.com/unread'] },
  ] };
  const result = assembleResults(draft, [], job, [{ index: 0, verified: true }]);
  assert.equal(result.ruledOut[0].decision, 'unverified');
  assert.deepEqual(result.ruledOut[0].sourceUrls, []);
  assert.equal(result.summary.includes('Must not copy'), false);
  job.stop('cancelled', 'Done');
});
