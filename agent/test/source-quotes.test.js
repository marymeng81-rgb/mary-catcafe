import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteSources, copySelectedQuotes } from '../source-quotes.js';

test('selected evidence is copied from read text, with aliases deduplicated', () => {
  const page = { url: 'https://example.com/course', title: 'Course', text: 'Adults 18 and over\nAuckland bookings open now' };
  const sources = quoteSources({ pages: new Map([['alias', page], [page.url, page]]) });
  assert.equal(sources.length, 1);
  const draft = { opportunities: [{ evidence: [{ criterion: 'age', quoteId: 's0q0', explanation: '45 is over 18' }] }] };
  assert.equal(copySelectedQuotes(draft, sources).opportunities[0].evidence[0].excerpt, 'Adults 18 and over');
  draft.opportunities[0].evidence[0].quoteId = 'invented';
  assert.equal(copySelectedQuotes(draft, sources).opportunities[0].evidence.length, 0);
});
