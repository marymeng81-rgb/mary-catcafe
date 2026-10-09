import { opportunitiesProxy } from '../../../../../../lib/opportunities-proxy.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request, context) {
  const { id } = await context.params;
  return opportunitiesProxy.cancel(request, id);
}
