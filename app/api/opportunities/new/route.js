import { opportunityStore } from '../../../../lib/opportunity-store.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request) { return opportunityStore.list(request, 'new'); }
