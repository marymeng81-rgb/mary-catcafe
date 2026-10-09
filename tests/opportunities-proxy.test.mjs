import test from 'node:test';
import assert from 'node:assert/strict';
import { createProxy } from '../lib/opportunities-proxy.mjs';

const id = '11111111-1111-1111-1111-111111111111';
const other = '22222222-2222-2222-2222-222222222222';
const env = { SITE_PASSWORD: 'fixture-password', AGENT_SECRET: 'fixture-agent-secret', AGENT_URL: 'http://fixture-agent:8080' };
const makeRequest = (path = '/api/opportunities/jobs', { method = 'POST', password = env.SITE_PASSWORD, cookie, origin = 'http://localhost:3000' } = {}) => new Request(`http://localhost:3000${path}`, {
  method, headers: { origin, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
  ...(method === 'POST' ? { body: JSON.stringify({ password }) } : {}),
});
function fixture() {
  const calls = [];
  const proxy = createProxy({ env, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/cancel')) return Response.json({ id, status: 'cancelled', phase: 'cancelled', progress: { searches: 1, pageReads: 2, elapsedSeconds: 12 } });
    if (options.method === 'POST') return Response.json({ id, status: 'running' }, { status: 202 });
    return Response.json({ id, status: 'running', phase: 'reading_sources', progress: { searches: 1, pageReads: 2, elapsedSeconds: 11 },
      secret: env.AGENT_SECRET, url: env.AGENT_URL, toolCalls: [{ tool: 'open_page', arguments: { url: 'https://example.com/rules' }, status: 'started', elapsedSeconds: 10 }] });
  } });
  return { proxy, calls };
}
async function login(proxy) {
  const response = await proxy.start(makeRequest());
  assert.equal(response.status, 202);
  return response.headers.get('set-cookie').split(';')[0];
}

test('wrong password and cross-origin requests never contact the agent', async () => {
  const { proxy, calls } = fixture();
  assert.equal((await proxy.start(makeRequest(undefined, { password: 'wrong' }))).status, 401);
  assert.equal((await proxy.start(makeRequest(undefined, { origin: 'https://unrelated.example' }))).status, 403);
  assert.equal(calls.length, 0);
});

test('refresh uses the server-held header; browser receives only an opaque HttpOnly cookie and job id', async () => {
  const { proxy, calls } = fixture();
  const response = await proxy.start(makeRequest());
  assert.equal(response.status, 202);
  assert.equal(calls[0].options.headers.AGENT_SECRET, env.AGENT_SECRET);
  assert.equal(calls[0].url, env.AGENT_URL + '/jobs');
  const body = await response.text();
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; SameSite=Strict/);
  for (const secret of Object.values(env)) {
    assert.equal(body.includes(secret), false);
    assert.equal(cookie.includes(secret), false);
  }
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('polling requires a valid cookie bound to this job, and relays actual progress without private fields', async () => {
  const { proxy, calls } = fixture();
  assert.equal((await proxy.poll(makeRequest(`/api/opportunities/jobs/${id}`, { method: 'GET' }), id)).status, 401);
  const cookie = await login(proxy);
  assert.equal((await proxy.poll(makeRequest(`/api/opportunities/jobs/${other}`, { method: 'GET', cookie }), other)).status, 401);
  const response = await proxy.poll(makeRequest(`/api/opportunities/jobs/${id}`, { method: 'GET', cookie }), id);
  const data = await response.json();
  assert.equal(data.phase, 'reading_sources');
  assert.equal(data.progress.elapsedSeconds, 11);
  assert.equal(data.progress.pageReads, 2);
  assert.equal(data.toolCalls[0].arguments.url, 'https://example.com/rules');
  assert.equal(JSON.stringify(data).includes(env.AGENT_SECRET), false);
  assert.equal(JSON.stringify(data).includes(env.AGENT_URL), false);
  assert.equal(calls.at(-1).options.headers.AGENT_SECRET, env.AGENT_SECRET);
});

test('cancel reaches the correct agent job and rejects unauthenticated callers', async () => {
  const { proxy, calls } = fixture();
  assert.equal((await proxy.cancel(makeRequest(`/api/opportunities/jobs/${id}/cancel`), id)).status, 401);
  const cookie = await login(proxy);
  const response = await proxy.cancel(makeRequest(`/api/opportunities/jobs/${id}/cancel`, { cookie }), id);
  assert.equal((await response.json()).status, 'cancelled');
  assert.equal(calls.at(-1).url, `${env.AGENT_URL}/jobs/${id}/cancel`);
  assert.equal(calls.at(-1).options.method, 'POST');
});

test('expired and tampered cookies cannot retrieve results', async () => {
  let now = 1;
  const proxy = createProxy({ env, now: () => now, fetchImpl: async () => Response.json({ id }) });
  const cookie = await login(proxy);
  now += 901_000;
  assert.equal((await proxy.poll(makeRequest(`/api/opportunities/jobs/${id}`, { method: 'GET', cookie }), id)).status, 401);
  const { proxy: fresh } = fixture();
  assert.equal((await fresh.poll(makeRequest(`/api/opportunities/jobs/${id}`, { method: 'GET', cookie: cookie + 'tampered' }), id)).status, 401);
});

test('configuration, connection and upstream failures are clear and never relay raw error bodies', async () => {
  assert.equal((await createProxy({ env: {} }).start(makeRequest())).status, 503);
  const failing = createProxy({ env, fetchImpl: async () => { throw new Error(env.AGENT_SECRET); } });
  const disconnected = await failing.start(makeRequest());
  assert.equal(disconnected.status, 502);
  assert.match((await disconnected.json()).error, /not responding/);
  const rejected = createProxy({ env, fetchImpl: async () => Response.json({ debug: env.AGENT_SECRET }, { status: 401 }) });
  const response = await rejected.start(makeRequest());
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes(env.AGENT_SECRET), false);
});

test('successful results relay evidence and exclusions; unknown fields and secret strings are stripped', async () => {
  const proxy = createProxy({ env, fetchImpl: async (_url, options) => Response.json(options.method === 'POST' ? { id } : {
    id, status: 'completed', phase: 'completed', progress: {}, results: { summary: 'One checked match.', opportunities: [{ name: 'Fixture event', kind: 'event', officialUrl: 'https://example.com', evidence: [{ criterion: 'age', excerpt: 'Adults welcome', url: 'https://example.com' }], secret: env.AGENT_SECRET }],
      ruledOut: [{ name: 'Unread event', decision: 'unverified', reason: `Upstream contained ${env.AGENT_URL} and ${env.AGENT_SECRET}`, sourceUrls: ['javascript:alert(1)'] }] } }) });
  const cookie = await login(proxy);
  const response = await proxy.poll(makeRequest(`/api/opportunities/jobs/${id}`, { method: 'GET', cookie }), id);
  const data = await response.json();
  assert.equal(data.results.opportunities[0].evidence[0].excerpt, 'Adults welcome');
  assert.equal(data.results.ruledOut[0].sourceUrls.length, 0);
  assert.equal(JSON.stringify(data).includes(env.AGENT_SECRET), false);
  assert.equal(JSON.stringify(data).includes(env.AGENT_URL), false);
});
