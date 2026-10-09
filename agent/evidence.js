import { z } from 'zod';
import { normalizeUrl } from './pages.js';

export const evidenceSchema = z.object({ criterion: z.enum(['age', 'location', 'availability', 'other_requirements']),
  url: z.string(), excerpt: z.string(), explanation: z.string() });
export const opportunitySchema = z.object({ name: z.string(), kind: z.enum(['competition', 'program', 'event']),
  officialUrl: z.string(), organizer: z.string(), location: z.string(), whyItFits: z.string(),
  availability: z.string(), eligibility: z.string(), officialSourceReason: z.string(),
  evidence: z.array(evidenceSchema) });
export const outputSchema = z.object({ opportunities: z.array(opportunitySchema),
  ruledOut: z.array(z.object({ name: z.string(), reason: z.string(),
    decision: z.enum(['ineligible', 'closed', 'unverified']), sourceUrls: z.array(z.string()) })),
  summary: z.string() });

export function normalizedText(text) { return text.normalize('NFKC').replace(/\s+/g, ' ').trim(); }

// Only excerpts present in successfully-read pages can reach the final semantic reviewer.
export function checkEvidence(item, job) {
  const issues = [];
  if (!job.searchSucceeded) issues.push('No completed web search.');
  let official;
  try { official = job.pages.get(normalizeUrl(item.officialUrl)); } catch { /* Invalid evidence URL. */ }
  if (!official) issues.push('Official URL was not successfully read.');
  if (!item.officialSourceReason.trim()) issues.push('No organizer/official-source justification.');
  const wordsByUrl = new Map();
  for (const criterion of ['age', 'location', 'availability', 'other_requirements']) {
    if (!item.evidence.some(e => e.criterion === criterion)) issues.push(`Missing ${criterion} evidence.`);
  }
  for (const evidence of item.evidence) {
    let page;
    try { page = job.pages.get(normalizeUrl(evidence.url)); } catch { /* Invalid evidence URL. */ }
    const excerpt = normalizedText(evidence.excerpt);
    if (!page || !excerpt || !normalizedText(page.text).includes(excerpt)) issues.push(`Unverified ${evidence.criterion} excerpt.`);
    if (page) wordsByUrl.set(page.url, (wordsByUrl.get(page.url) || 0) + excerpt.split(/\s+/).length);
  }
  if ([...wordsByUrl.values()].some(count => count > 25)) issues.push('Excerpts exceed 25 words from one source for this item.');
  return issues;
}

export function assembleResults(draft, reviews, job, rejectionReviews = []) {
  const opportunities = [];
  const ruledOut = draft.ruledOut.map((item, index) => {
    const sourcesWereRead = item.sourceUrls.length > 0 && item.sourceUrls.every(url => {
      try { return job.pages.has(normalizeUrl(url)); } catch { return false; }
    });
    const confirmed = rejectionReviews.some(review => review.index === index && review.verified);
    if (item.decision !== 'unverified' && (!sourcesWereRead || !confirmed)) {
      return { ...item, decision: 'unverified', reason: 'Could not establish a supported eligibility or availability decision from the read official sources.',
        sourceUrls: item.sourceUrls.filter(url => { try { return job.pages.has(normalizeUrl(url)); } catch { return false; } }) };
    }
    return item;
  });
  const quoteBudget = new Map();
  const seen = new Set();
  for (let index = 0; index < draft.opportunities.length; index++) {
    const item = draft.opportunities[index];
    const review = reviews.find(r => r.index === index);
    const issues = checkEvidence(item, job);
    if (!review?.verified || issues.length) {
      ruledOut.push({ name: item.name, decision: 'unverified',
        reason: issues.length ? issues.join(' ') : review?.reason || 'Final evidence review could not verify this item.',
        sourceUrls: item.evidence.map(e => e.url).filter(url => {
          try { return job.pages.has(normalizeUrl(url)); } catch { return false; }
        }) });
      continue;
    }
    const key = normalizedText(item.name).toLowerCase();
    if (seen.has(key) || opportunities.length >= 5) continue;
    const additions = new Map();
    for (const evidence of item.evidence) {
      const url = job.pages.get(normalizeUrl(evidence.url)).url;
      additions.set(url, (additions.get(url) || 0) + normalizedText(evidence.excerpt).split(/\s+/).length);
    }
    if ([...additions].some(([url, words]) => words + (quoteBudget.get(url) || 0) > 25)) {
      ruledOut.push({ name: item.name, decision: 'unverified', reason: 'Source excerpt budget exhausted; not included without supporting excerpts.', sourceUrls: [item.officialUrl] });
      continue;
    }
    for (const [url, words] of additions) quoteBudget.set(url, (quoteBudget.get(url) || 0) + words);
    seen.add(key);
    opportunities.push(item);
  }
  return { checkedAt: new Date().toISOString(), opportunities, ruledOut,
    summary: `${opportunities.length} verified opportunities. ${opportunities.length < 5 ? 'Fewer than five were verified; no results were invented to fill the list. ' : ''}See each item’s evidence and the excluded or unresolved candidates below.` };
}
