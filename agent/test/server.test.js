import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from '../server.js';
import { JobStore } from '../jobs.js';

async function serve(t, execute, options = {}) {
  const secret = 'test-only-secret';
  const store = new JobStore(execute, { logger: () => {}, ...options });
  const server = createServer({ secret, store });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { store.close(); server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, method = 'GET', authenticated = true) => fetch(base + path, {
    method, headers: authenticated ? { AGENT_SECRET: secret } : {},
  });
  return { call, store };
}

test('health, authentication, job polling and clear missing-job errors', async t => {
  let executions = 0;
  const { call } = await serve(t, async job => { executions++; job.searches = 1; job.pageReads = 2; return { opportunities: [], ruledOut: [], summary: 'Nothing verified.' }; });
  assert.equal(await (await call('/', 'GET', false)).text(), 'agent is running');
  assert.equal((await call('/jobs', 'POST', false)).status, 401);
  assert.equal(executions, 0);
  const started = await call('/jobs', 'POST');
  assert.equal(started.status, 202);
  const { id } = await started.json();
  await delay(20);
  assert.equal((await call(`/jobs/${id}`, 'GET', false)).status, 401);
  const result = await (await call(`/jobs/${id}`)).json();
  assert.equal(result.status, 'completed');
  assert.equal(result.progress.searches, 1);
  assert.equal(result.progress.pageReads, 2);
  assert.equal(result.results.opportunities.length, 0);
  assert.equal((await call('/jobs/11111111-1111-1111-1111-111111111111')).status, 404);
});

test('cancel endpoint stops in-flight work and does not permit unauthenticated cancellation', async t => {
  let aborted = false;
  const { call } = await serve(t, job => new Promise(resolve => {
    job.signal.addEventListener('abort', () => { aborted = true; resolve({ opportunities: [] }); }, { once: true });
  }));
  const { id } = await (await call('/jobs', 'POST')).json();
  assert.equal((await call('/jobs', 'POST')).status, 409);
  assert.equal((await call(`/jobs/${id}/cancel`, 'POST', false)).status, 401);
  const result = await (await call(`/jobs/${id}/cancel`, 'POST')).json();
  assert.equal(result.status, 'cancelled');
  assert.equal(aborted, true);
  await delay(10);
  assert.equal((await (await call(`/jobs/${id}`)).json()).status, 'cancelled');
});

test('deadline and API failure are clear job errors with no secret disclosure', async t => {
  const { call } = await serve(t, () => new Promise(() => {}), { durationMs: 15 });
  const { id } = await (await call('/jobs', 'POST')).json();
  await delay(30);
  const result = await (await call(`/jobs/${id}`)).json();
  assert.equal(result.status, 'timed_out');
  assert.ok(result.error);
  const second = await serve(t, async () => { throw { status: 401, message: 'test-only-secret' }; });
  const started = await (await second.call('/jobs', 'POST')).json();
  await delay(20);
  const error = await (await second.call(`/jobs/${started.id}`)).json();
  assert.equal(error.status, 'failed');
  assert.equal(JSON.stringify(error).includes('test-only-secret'), false);
});
