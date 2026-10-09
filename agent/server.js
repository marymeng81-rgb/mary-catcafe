import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { JobStore } from './jobs.js';
import { createResearcher } from './research.js';

export function createServer({ secret, execute, store = new JobStore(execute) }) {
  const expected = Buffer.from(secret);
  const server = http.createServer((request, response) => {
    const reply = (status, value) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(value));
    };
    let path;
    try { path = new URL(request.url, 'http://localhost').pathname; } catch { reply(400, { error: 'Invalid URL.' }); return; }
    if (request.method === 'GET' && path === '/') {
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end('agent is running');
      return;
    }
    if (!path.startsWith('/jobs')) { reply(404, { error: 'Not found.' }); return; }
    // Authenticate polling and cancellation too: results contain personal interests.
    const provided = Buffer.from(typeof request.headers.agent_secret === 'string' ? request.headers.agent_secret : '');
    if (!expected.length || expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      reply(401, { error: 'Unauthorized. Send the AGENT_SECRET header.' });
      return;
    }
    if (Number(request.headers['content-length'] || 0) > 4096 || request.headers['transfer-encoding']) {
      reply(413, { error: 'Request body is not needed; keep it below 4 KB.' });
      return;
    }
    request.resume();
    if (request.method === 'POST' && path === '/jobs') {
      const started = store.start();
      if (started.error) reply(started.status, { error: started.error });
      else reply(202, { id: started.job.id, status: 'running', progressUrl: `/jobs/${started.job.id}` });
      return;
    }
    const match = /^\/jobs\/([a-f0-9-]{36})(\/cancel)?$/.exec(path);
    if (!match) { reply(404, { error: 'Not found.' }); return; }
    const job = store.get(match[1]);
    if (!job) { reply(404, { error: 'Job not found or expired. Jobs are stored in memory.' }); return; }
    if (request.method === 'GET' && !match[2]) { reply(200, job.snapshot()); return; }
    if (request.method === 'POST' && match[2]) {
      job.stop('cancelled', 'The job was cancelled.');
      reply(200, job.snapshot());
      return;
    }
    reply(405, { error: 'Method not allowed.' });
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.on('close', () => store.close());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = loadConfig();
    const server = createServer({ secret: config.secret, execute: createResearcher(config) });
    server.listen(config.port, '0.0.0.0', () => console.log(`Agent server listening on port ${config.port}.`));
    const shutdown = () => { server.close(); server.closeAllConnections(); };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    server.on('error', () => { console.error('Agent server could not bind its port.'); process.exitCode = 1; });
  } catch { console.error('Agent startup failed. Check OPENAI_API_KEY, AGENT_SECRET, PORT and the local .env file.'); process.exitCode = 1; }
}
