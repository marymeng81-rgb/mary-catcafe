import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { Job, JobStore, safeError } from '../jobs.js';

test('budgets reserve before execution and do not admit an eleventh search or sixteenth read', () => {
  const logs = [];
  const job = new Job({ logger: line => logs.push(JSON.parse(line)) });
  for (let i = 0; i < 10; i++) assert.equal(job.reserve('searches', { query: 'cats' }), true);
  assert.equal(job.reserve('searches', { query: 'blocked' }), false);
  for (let i = 0; i < 15; i++) assert.equal(job.reserve('pageReads', { url: 'https://example.com/' }), true);
  assert.equal(job.reserve('pageReads', { url: 'https://example.com/extra' }), false);
  assert.equal(job.searches, 10);
  assert.equal(job.pageReads, 15);
  assert.equal(logs.length, 27);
  job.stop('cancelled', 'Cancelled.');
});

test('cancellation aborts in-flight work and cannot later complete', () => {
  const job = new Job({ logger: () => {} });
  job.stop('cancelled', 'Cancelled.');
  assert.equal(job.signal.aborted, true);
  assert.throws(() => job.complete({ opportunities: [] }), { name: 'AbortError' });
  assert.equal(job.snapshot().status, 'cancelled');
});

test('deadline yields an immediate clear terminal error even if a worker ignores abort', async () => {
  const store = new JobStore(() => new Promise(() => {}), { durationMs: 20, logger: () => {} });
  const { job } = store.start();
  await delay(40);
  assert.equal(job.status, 'timed_out');
  assert.equal(job.signal.aborted, true);
  assert.match(job.snapshot().error, /deadline/);
  store.close();
});

test('only one job runs at a time and completed job is immutable on cancel', async () => {
  const store = new JobStore(async () => ({ opportunities: [] }), { logger: () => {} });
  const { job } = store.start();
  assert.equal(store.start().status, 409);
  await delay(20);
  assert.equal(job.status, 'completed');
  job.stop('cancelled', 'Cancelled.');
  assert.equal(job.status, 'completed');
  assert.ok(store.start().job);
  store.close();
});

test('provider errors never expose a key or provider response body', () => {
  assert.equal(safeError({ status: 401, message: 'super-secret-key' }), 'OpenAI rejected OPENAI_API_KEY.');
  assert.equal(safeError({ code: 'credit_balance_exhausted' }), 'OpenAI API credit is exhausted.');
  assert.equal(safeError(new Error('super-secret-key')).includes('super-secret-key'), false);
});

test('expired finished jobs cannot be polled after one hour', async () => {
  const store = new JobStore(async () => ({ opportunities: [] }), { logger: () => {} });
  const { job } = store.start();
  await delay(20);
  job.finishedAt = Date.now() - 3_600_001;
  assert.equal(store.get(job.id), undefined);
  store.close();
});
