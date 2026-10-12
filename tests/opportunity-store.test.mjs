import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpportunityStore } from '../lib/opportunity-store.mjs';
const env={SITE_PASSWORD:'fixture-password',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_KEY:'private-key'};
const req=(password,method='GET')=>new Request('http://localhost:3000/api/opportunities',{method,headers:password?{'x-site-password':password}:{}});
test('new, rejected, approve and reject reject missing/wrong passwords without calling database',async()=>{
 let calls=0;const store=createOpportunityStore({env,fetchImpl:()=>{calls++;throw Error('must not call');}});
 for(const password of [undefined,'wrong']){
  assert.equal((await store.list(req(password),'new')).status,401);
  assert.equal((await store.list(req(password),'rejected')).status,401);
  for(const status of ['approved','rejected'])assert.equal((await store.decide(req(password,'POST'),'1',status)).status,401);
 }assert.equal(calls,0);
});
test('public reads are approved only, newest first; authorized decisions set decided_at atomically',async()=>{
 const calls=[];const store=createOpportunityStore({env,fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json([{id:1,status:options.method?'approved':'approved'}]);}});
 assert.equal((await store.list(req())).status,200);
 assert.equal(calls[0].url.searchParams.get('status'),'eq.approved');assert.match(calls[0].url.searchParams.get('order'),/^created_at.desc/);
 assert.equal((await store.decide(req(env.SITE_PASSWORD,'POST'),'1','approved')).status,200);
 const body=JSON.parse(calls[1].options.body);assert.equal(body.status,'approved');assert(Number.isFinite(Date.parse(body.decided_at)));assert.equal(calls[1].url.searchParams.get('status'),'eq.new');
});
