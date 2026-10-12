import { RunContext, tool } from '@openai/agents';
import { opportunitySchema } from './evidence.js';
import { normalizeUrl } from './pages.js';

export function createUpdateSite(config, job, kept, { fetchImpl = fetch } = {}) {
  const allowed = new Map(kept.opportunities.map(item => [normalizeUrl(item.officialUrl), item]));
  return tool({ name: 'update_site', description: 'Save one final, checked opportunity with status new; skip an existing URL.',
    errorFunction: null, parameters: opportunitySchema,
    execute: async item => {
      job.assertActive();
      const url = normalizeUrl(item.officialUrl);
      const checked = allowed.get(url);
      if (!checked || JSON.stringify(checked) !== JSON.stringify(item)) throw new Error('Only a final checked opportunity can be saved.');
      job.log('update_site', { url, name: item.name }, 'saving');
      if (!config.supabaseUrl || !config.supabaseKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required for saves.');
      const endpoint = new URL('/rest/v1/opportunities', config.supabaseUrl);
      endpoint.searchParams.set('on_conflict', 'url');
      const response = await fetchImpl(endpoint, { method: 'POST',
        headers: { apikey: config.supabaseKey, Authorization: `Bearer ${config.supabaseKey}`, 'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify({ url, name: checked.name, status: 'new', opportunity: checked, checked_at: kept.checkedAt }),
        signal: AbortSignal.any([job.signal, AbortSignal.timeout(10_000)]) });
      if (!response.ok) { job.log('update_site', { url, name: item.name }, 'save_failed'); throw new Error(`Supabase save failed (HTTP ${response.status}).`); }
      const rows = await response.json();
      const status = rows.length ? 'saved' : 'skipped_existing';
      job.log('update_site', { url, name: item.name }, status);
      return { status, rows };
    } });
}

export async function saveResults(config, job, results, options) {
  const saver = createUpdateSite(config, job, results, options);
  for (const item of results.opportunities) await saver.invoke(new RunContext(), JSON.stringify(item));
  return results;
}
