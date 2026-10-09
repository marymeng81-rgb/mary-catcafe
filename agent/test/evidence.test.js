import test from 'node:test';
import assert from 'node:assert/strict';
import { Job } from '../jobs.js';
import { checkEvidence, assembleResults } from '../evidence.js';

function fixture() {
  const job = new Job({ logger: () => {} });
  job.searchSucceeded = true;
  job.pages.set('https://example.com/rules', { url: 'https://example.com/rules', text: 'All adults Auckland Registration open No qualifications required' });
  const item = { name: 'Fixture event', kind: 'event', officialUrl: 'https://example.com/rules', organizer: 'Fixture organizer',
    location: 'Auckland', whyItFits: 'Cooking', availability: 'Registration open', eligibility: 'All adults', officialSourceReason: 'Organizer rules',
    evidence: [
      { criterion: 'age', url: 'https://example.com/rules', excerpt: 'All adults', explanation: '45 is adult' },
      { criterion: 'location', url: 'https://example.com/rules', excerpt: 'Auckland', explanation: 'Local' },
      { criterion: 'availability', url: 'https://example.com/rules', excerpt: 'Registration open', explanation: 'Open now' },
      { criterion: 'other_requirements', url: 'https://example.com/rules', excerpt: 'No qualifications required', explanation: 'No assumptions' },
    ] };
  return { job, item };
}

test('unread URLs, missing criteria and invented excerpts cannot be accepted', () => {
  const { job, item } = fixture();
  assert.deepEqual(checkEvidence(item, job), []);
  item.evidence[0].excerpt = 'Children only';
  assert.ok(checkEvidence(item, job).some(issue => /excerpt/.test(issue)));
  item.officialUrl = 'https://example.com/unread';
  assert.ok(checkEvidence(item, job).some(issue => /Official URL/.test(issue)));
  item.evidence.pop();
  assert.ok(checkEvidence(item, job).some(issue => /other_requirements/.test(issue)));
  job.stop('cancelled', 'Done');
});

test('semantic reviewer veto returns fewer results and explains uncertainty without inventing fillers', () => {
  const { job, item } = fixture();
  const results = assembleResults({ opportunities: [item], ruledOut: [], summary: 'Checked fixture.' },
    [{ index: 0, verified: false, reason: 'Registration year not established.' }], job);
  assert.equal(results.opportunities.length, 0);
  assert.equal(results.ruledOut[0].decision, 'unverified');
  assert.match(results.ruledOut[0].reason, /year/);
  assert.match(results.summary, /no results were invented/);
  job.stop('cancelled', 'Done');
});

test('accepted results require both mechanical evidence and reviewer approval', () => {
  const { job, item } = fixture();
  const results = assembleResults({ opportunities: [item], ruledOut: [], summary: 'Checked fixture.' }, [{ index: 0, verified: true, reason: 'Supported.' }], job);
  assert.equal(results.opportunities.length, 1);
  job.stop('cancelled', 'Done');
});

test('max five, deduplication and cumulative quote budget apply to final results', () => {
  const { job, item } = fixture();
  const candidates = Array.from({ length: 8 }, (_, index) => {
    const url = `https://example.com/${index}`;
    job.pages.set(url, { url, text: job.pages.get(item.officialUrl).text });
    return { ...item, name: `Fixture ${index}`, officialUrl: url, evidence: item.evidence.map(e => ({ ...e, url })) };
  });
  const results = assembleResults({ opportunities: candidates, ruledOut: [], summary: '' }, candidates.map((_, index) => ({ index, verified: true })), job);
  assert.equal(results.opportunities.length, 5);
  const sameSource = Array.from({ length: 4 }, (_, i) => ({ ...item, name: `Shared source ${i}` }));
  const limited = assembleResults({ opportunities: sameSource, ruledOut: [], summary: '' }, sameSource.map((_, index) => ({ index, verified: true })), job);
  assert.equal(limited.opportunities.length, 3);
  job.stop('cancelled', 'Done');
});
