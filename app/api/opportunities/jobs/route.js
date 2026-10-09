import { opportunitiesProxy } from '../../../../lib/opportunities-proxy.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request) { return opportunitiesProxy.start(request); }
