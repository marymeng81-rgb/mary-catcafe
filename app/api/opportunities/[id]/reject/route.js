import { opportunityStore } from '../../../../../lib/opportunity-store.mjs';
export const runtime = 'nodejs';
export async function POST(request, context) { return opportunityStore.decide(request, (await context.params).id, 'rejected'); }
