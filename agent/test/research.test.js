import test from 'node:test';
import assert from 'node:assert/strict';
import { RunContext } from '@openai/agents';
import { createResearcher } from '../research.js';
import { Job } from '../jobs.js';

test('SDK search wrapper forces the built-in tool once, disables retries, and logs its call', async () => {
  const calls = [];
  const job = new Job({ durationMs: 60_000, logger: line => calls.push(JSON.parse(line)) });
  const runner = { async run(agent, _input, options) {
    assert.equal(options.signal, job.signal);
    if (agent.name === 'Built-in web search') {
      assert.equal(agent.modelSettings.toolChoice, 'web_search');
      assert.equal(agent.modelSettings.providerData.max_tool_calls, 1);
      assert.equal(agent.tools[0].type, 'hosted_tool');
      assert.equal(agent.tools[0].providerData.type, 'web_search');
      return { finalOutput: 'A discovery result', rawResponses: [{ providerData: { output: [
        { type: 'web_search_call', status: 'completed', action: { type: 'search' } },
      ] } }] };
    }
    const search = agent.tools.find(tool => tool.name === 'web_search');
    const response = await search.invoke(new RunContext(), JSON.stringify({ query: 'fixture query' }));
    assert.ok(response.discovery || String(response).includes('discovery'));
    return { finalOutput: { opportunities: [], ruledOut: [], summary: 'No fixture opportunities.' } };
  } };
  const research = createResearcher({ apiKey: 'test-only-key', model: 'gpt-4.1-mini' }, { runner });
  const results = await research(job);
  assert.equal(job.searches, 1);
  assert.equal(job.searchSucceeded, true);
  assert.ok(calls.some(call => call.tool === 'built_in_web_search'));
  assert.equal(results.opportunities.length, 0);
  job.stop('cancelled', 'Done');
});
