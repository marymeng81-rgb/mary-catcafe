import { createHash, timingSafeEqual } from 'node:crypto';

export function checkSitePassword(request, env = process.env) {
  const password = request.headers.get('x-site-password') || '';
  if (!env.SITE_PASSWORD?.trim()) throw Object.assign(new Error('Site password is not configured.'), { status: 503 });
  const hash = value => createHash('sha256').update(value).digest();
  if (!password || !timingSafeEqual(hash(password), hash(env.SITE_PASSWORD))) throw Object.assign(new Error('Site password required or incorrect.'), { status: 401 });
}
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export function createOpportunityStore({ env = process.env, fetchImpl = fetch } = {}) {
  async function database(query, options = {}) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) throw Object.assign(new Error('Opportunity database is not configured.'), { status: 503 });
    const url = new URL('/rest/v1/opportunities', env.SUPABASE_URL);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    let response;
    try { response = await fetchImpl(url, { ...options, headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, cache: 'no-store', signal: AbortSignal.timeout(10_000) }); }
    catch { throw Object.assign(new Error('Opportunity database could not be reached.'), { status: 502 }); }
    if (!response.ok) throw Object.assign(new Error('Opportunity database request failed.'), { status: 502 });
    return response.json();
  }
  const safe = fn => async (...args) => { try { return await fn(...args); } catch (error) { return reply({ error: error.status ? error.message : 'Opportunity request failed.' }, error.status || 500); } };
  return {
    list: safe(async (request, status = 'approved') => {
      if (!['approved','new','rejected'].includes(status)) return reply({ error: 'Invalid status.' }, 400);
      if (status !== 'approved') checkSitePassword(request, env);
      const rows = await database({ status: `eq.${status}`, select: 'id,url,name,status,opportunity,created_at,decided_at', order: 'created_at.desc,id.desc' });
      return reply({ rows });
    }),
    decide: safe(async (request, id, status) => {
      checkSitePassword(request, env);
      const origin = request.headers.get('origin');
      if (origin && origin !== new URL(request.url).origin) return reply({ error: 'Use this website to review opportunities.' }, 403);
      if (!/^[1-9][0-9]*$/.test(id) || !['approved','rejected'].includes(status)) return reply({ error: 'Invalid decision.' }, 400);
      const rows = await database({ id: `eq.${id}`, status: 'eq.new', select: 'id,url,name,status,opportunity,created_at,decided_at' }, { method: 'PATCH', body: JSON.stringify({ status, decided_at: new Date().toISOString() }) });
      if (!rows.length) return reply({ error: 'Opportunity is no longer new. Reload the review list.' }, 409);
      return reply({ row: rows[0] });
    }),
  };
}
export const opportunityStore = createOpportunityStore();
