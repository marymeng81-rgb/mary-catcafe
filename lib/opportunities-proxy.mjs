import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'opportunity_job';
const TTL_SECONDS = 15 * 60;
const JOB_ID = /^[a-f0-9-]{36}$/;
const headers = { 'Cache-Control': 'no-store, private', 'Content-Type': 'application/json; charset=utf-8' };

class ProxyError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function config(env) {
  if (!env.SITE_PASSWORD?.trim() || !env.AGENT_SECRET?.trim() || !env.AGENT_URL?.trim()) {
    throw new ProxyError(503, 'Opportunity search is not configured yet. Set the site password and agent connection on the server.');
  }
  let url;
  try { url = new URL(env.AGENT_URL); } catch { throw new ProxyError(503, 'The agent connection is not configured correctly.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new ProxyError(503, 'The agent connection is not configured correctly.');
  return { password: env.SITE_PASSWORD, secret: env.AGENT_SECRET, url: url.href.replace(/\/$/, '') };
}
function equal(left, right) {
  return timingSafeEqual(createHash('sha256').update(left).digest(), createHash('sha256').update(right).digest());
}
function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new ProxyError(403, 'This request must come from this website.');
}
function sign(payload, settings) {
  return createHmac('sha256', settings.secret).update(`${settings.password}\n${payload}`).digest('base64url');
}
function cookieFor(id, settings, request, now) {
  const payload = Buffer.from(JSON.stringify({ id, exp: now + TTL_SECONDS * 1000 })).toString('base64url');
  return `${COOKIE}=${payload}.${sign(payload, settings)}; HttpOnly; SameSite=Strict; Path=/api/opportunities/jobs; Max-Age=${TTL_SECONDS}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
function authorizeJob(request, id, settings, now) {
  if (!JOB_ID.test(id)) throw new ProxyError(404, 'Job not found.');
  const cookies = request.headers.get('cookie') || '';
  const value = cookies.split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  const [payload, signature] = (value || '').split('.');
  if (!payload || !signature || value.length > 1000 || !equal(signature, sign(payload, settings))) throw new ProxyError(401, 'Refresh and enter your site password to access this search.');
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { throw new ProxyError(401, 'Search authorization is invalid. Please refresh.'); }
  if (data.id !== id || !Number.isFinite(data.exp) || data.exp <= now) throw new ProxyError(401, 'Search authorization has expired. Refresh to start again.');
}
async function bodyJson(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ProxyError(415, 'Send a JSON request.');
  if (Number(request.headers.get('content-length') || 0) > 4096) throw new ProxyError(413, 'Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new ProxyError(400, 'Enter your site password.');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4096) { await reader.cancel(); throw new ProxyError(413, 'Request is too large.'); }
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof ProxyError) throw error;
    throw new ProxyError(400, 'Enter your site password.');
  } finally { reader.releaseLock(); }
}
function cleanText(value, settings) {
  if (typeof value !== 'string') return '';
  let text = value.slice(0, 5000);
  for (const privateValue of [settings.secret, settings.url, settings.password]) text = text.split(privateValue).join('[private]');
  return text;
}
function sourceUrl(value, settings) {
  if (typeof value !== 'string' || value.includes(settings.url) || value.includes(settings.secret)) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function sanitizeSnapshot(data, settings) {
  const text = value => cleanText(value, settings);
  const number = value => Number.isFinite(value) ? Math.max(0, value) : 0;
  const status = ['running','completed','failed','cancelled','timed_out'].includes(data.status) ? data.status : 'failed';
  const phase = ['starting','researching','searching','reading_sources','checking_matches','checking_evidence','completed','failed','cancelled','timed_out'].includes(data.phase) ? data.phase : 'researching';
  const snapshot = { id: JOB_ID.test(data.id) ? data.id : null, status, phase,
    progress: { searches: number(data.progress?.searches), pageReads: number(data.progress?.pageReads), elapsedSeconds: number(data.progress?.elapsedSeconds),
      limits: { searches: 10, pageReads: 15, elapsedSeconds: 240 } },
    toolCalls: (Array.isArray(data.toolCalls) ? data.toolCalls : []).slice(-150).map(event => ({
      tool: ['web_search','built_in_web_search','open_page'].includes(event.tool) ? event.tool : 'tool',
      arguments: { ...(event.arguments?.query ? { query: text(event.arguments.query) } : {}),
        ...(event.arguments?.url ? { url: sourceUrl(event.arguments.url, settings) } : {}) },
      status: text(event.status), elapsedSeconds: number(event.elapsedSeconds),
    })) };
  if (data.error) snapshot.error = text(data.error);
  if (status === 'failed' && !snapshot.error) snapshot.error = 'The agent could not complete this search.';
  if (status === 'completed' && data.results) {
    snapshot.results = { summary: text(data.results.summary), checkedAt: text(data.results.checkedAt),
      opportunities: (Array.isArray(data.results.opportunities) ? data.results.opportunities : []).slice(0, 5).map(item => ({
        name: text(item.name), kind: text(item.kind), organizer: text(item.organizer), location: text(item.location),
        whyItFits: text(item.whyItFits), availability: text(item.availability), eligibility: text(item.eligibility),
        officialUrl: sourceUrl(item.officialUrl, settings),
        evidence: (Array.isArray(item.evidence) ? item.evidence : []).slice(0, 20).map(evidence => ({
          criterion: text(evidence.criterion), excerpt: text(evidence.excerpt), explanation: text(evidence.explanation), url: sourceUrl(evidence.url, settings),
        })),
      })),
      ruledOut: (Array.isArray(data.results.ruledOut) ? data.results.ruledOut : []).slice(0, 50).map(item => ({
        name: text(item.name), reason: text(item.reason), decision: text(item.decision),
        sourceUrls: (Array.isArray(item.sourceUrls) ? item.sourceUrls : []).map(url => sourceUrl(url, settings)).filter(Boolean),
      })),
    };
  }
  return snapshot;
}

export function createProxy({ env = process.env, fetchImpl = fetch, now = Date.now } = {}) {
  const failures = new Map();
  async function callAgent(settings, path, method) {
    let response;
    try {
      response = await fetchImpl(`${settings.url}${path}`, { method, headers: { AGENT_SECRET: settings.secret },
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12_000) });
    } catch { throw new ProxyError(502, 'The search agent is not responding. Make sure it is running, then try again.'); }
    if (!response.ok) {
      const message = { 401: 'The server could not authenticate with the search agent.', 404: 'This search is no longer available. Refresh to start again.',
        409: 'Another search is already running. Wait for it to finish, then refresh.' }[response.status];
      throw new ProxyError(response.status === 404 ? 404 : response.status === 409 ? 409 : 502, message || 'The search agent returned an error. Please try again.');
    }
    try { return await response.json(); } catch { throw new ProxyError(502, 'The search agent returned an invalid response.'); }
  }
  const respond = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...headers, ...extra } });
  const handle = operation => async (...args) => {
    try { return await operation(...args); } catch (error) {
      return respond({ error: error instanceof ProxyError ? error.message : 'The opportunity request could not be completed.' }, error instanceof ProxyError ? error.status : 500);
    }
  };
  return {
    start: handle(async request => {
      sameOrigin(request);
      const settings = config(env);
      const address = (request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim().slice(0, 100);
      for (const [key, entry] of failures) if (now() - entry.since > 600_000) failures.delete(key);
      if (failures.get(address)?.count >= 10) throw new ProxyError(429, 'Too many incorrect passwords. Please wait ten minutes.');
      const body = await bodyJson(request);
      if (typeof body.password !== 'string' || !equal(body.password, settings.password)) {
        const entry = failures.get(address) || { count: 0, since: now() };
        entry.count++;
        if (failures.size > 1000) failures.delete(failures.keys().next().value);
        failures.set(address, entry);
        throw new ProxyError(401, 'That site password is not correct. Please try again.');
      }
      failures.delete(address);
      const data = await callAgent(settings, '/jobs', 'POST');
      if (!JOB_ID.test(data.id)) throw new ProxyError(502, 'The search agent returned an invalid job.');
      return respond({ id: data.id, status: 'running' }, 202, { 'Set-Cookie': cookieFor(data.id, settings, request, now()) });
    }),
    poll: handle(async (request, id) => {
      const settings = config(env);
      authorizeJob(request, id, settings, now());
      const snapshot = sanitizeSnapshot(await callAgent(settings, `/jobs/${id}`, 'GET'), settings);
      if (snapshot.id !== id) throw new ProxyError(502, 'The search agent returned an invalid job.');
      return respond(snapshot);
    }),
    cancel: handle(async (request, id) => {
      sameOrigin(request);
      const settings = config(env);
      authorizeJob(request, id, settings, now());
      const snapshot = sanitizeSnapshot(await callAgent(settings, `/jobs/${id}/cancel`, 'POST'), settings);
      if (snapshot.id !== id) throw new ProxyError(502, 'The search agent returned an invalid job.');
      return respond(snapshot);
    }),
  };
}

// Server route modules share only this stateless proxy and password attempt counts, never results.
export const opportunitiesProxy = createProxy();
