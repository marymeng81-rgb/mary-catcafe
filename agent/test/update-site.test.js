import test from 'node:test';
import assert from 'node:assert/strict';
import { RunContext } from '@openai/agents';
import { Job } from '../jobs.js';
import { createUpdateSite, saveResults } from '../update-site.js';

const item = {name:'Verified fixture',kind:'event',officialUrl:'https://example.com/event',organizer:'Organizer',location:'Auckland',whyItFits:'Cooking',availability:'Open',eligibility:'Adults',officialSourceReason:'Organizer',evidence:[]};
const results = {opportunities:[item],ruledOut:[],checkedAt:new Date().toISOString()};
test('saves only final kept items, with status new, atomic duplicate skipping, and unchanged results', async () => {
 const logs=[];const job=new Job({logger:line=>logs.push(JSON.parse(line))});let calls=0;
 const fetchImpl=async (url,options)=>{calls++;assert.equal(url.searchParams.get('on_conflict'),'url');assert.equal(JSON.parse(options.body).status,'new');assert.match(options.headers.Prefer,/ignore-duplicates/);assert.equal(options.headers.apikey,'private-fixture');return new Response(JSON.stringify(calls===1?[{id:1}]:[]));};
 const config={supabaseUrl:'https://example.supabase.co',supabaseKey:'private-fixture'};
 assert.equal(await saveResults(config,job,results,{fetchImpl}),results);
 await saveResults(config,job,results,{fetchImpl});
 const tool=createUpdateSite(config,job,results,{fetchImpl});
 await assert.rejects(()=>tool.invoke(new RunContext(),JSON.stringify({...item,officialUrl:'https://example.com/unchecked'})),/checked/);
 assert.equal(calls,2);assert(logs.some(x=>x.status==='saved'));assert(logs.some(x=>x.status==='skipped_existing'));assert(!JSON.stringify(logs).includes('private-fixture'));job.stop('cancelled','done');
});
