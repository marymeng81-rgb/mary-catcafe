import { z } from 'zod';
import { opportunitySchema, outputSchema, normalizedText } from './evidence.js';

// The model selects words; the server copies them. It never generates source quotations.
export const selectedOutputSchema = outputSchema.extend({ opportunities: z.array(opportunitySchema.extend({
  evidence: z.array(z.object({ criterion: z.enum(['age', 'location', 'availability', 'other_requirements']),
    quoteId: z.string(), explanation: z.string() }))
})) });

export function quoteSources(job) {
  return [...new Map([...job.pages.values()].map(page => [page.url, page])).values()].map((page, source) => ({
    source, url: page.url, title: page.title,
    quotes: page.text.split(/\n+/).filter(line => line.trim()).flatMap(line => {
      const words = normalizedText(line).split(' ');
      const chunks = [];
      for (let start = 0; start < words.length; start += 6) chunks.push(words.slice(start, start + 6).join(' '));
      return chunks;
    }).map((text, index) => ({ quoteId: `s${source}q${index}`, text }))
  }));
}

export function copySelectedQuotes(draft, sources) {
  const quotes = new Map(sources.flatMap(source => source.quotes.map(quote => [quote.quoteId, {url: source.url, excerpt: quote.text}])));
  return { ...draft, opportunities: draft.opportunities.map(item => ({ ...item, evidence: item.evidence.flatMap(selection => {
    const quote = quotes.get(selection.quoteId);
    // An unknown ID supplies no evidence and is rejected by the existing evidence gate.
    return quote ? [{ criterion: selection.criterion, ...quote, explanation: selection.explanation }] : [];
  }) })) };
}
