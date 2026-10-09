# Mary’s Cat Café

Next.js site preserving the original café page, text, styles, photos, anchor navigation, and photo viewer.

Requires Node.js 20.9 or newer. Run `npm install` then `npm run dev` and open http://localhost:3000. Use `npm run build` and `npm start` for a production preview.

The original HTML, CSS, and JavaScript remain as migration references. Next.js serves app/page.jsx, app/globals.css, and public images. The old /index.html URL redirects to /.

## Opportunities

Open `/opportunities`, click Refresh and enter your site password. The page displays the agent’s real searches, source reads, elapsed time, evidence-backed results and exclusions. Cancel stops the job. Results exist only in memory; they are not written to browser storage, files or a database. Leaving the page cancels an active search.

Set `SITE_PASSWORD`, `AGENT_URL` and `AGENT_SECRET` in the ignored `.env.local` file. The browser sends the site password only to the Next.js job-start route. Polling and cancellation use an opaque, short-lived HttpOnly cookie bound to that job. All agent requests and authentication headers are sent server-side. GETs and job results are never cached.

For local use, start the separate agent with `npm start` in `agent/` (port 8080), and run `npm run dev` here (port 3000). Both use the shared secret in their ignored environment files. On this PC, add `.tools/node-v22.23.3-win-x64` to PATH if npm is not available. Proxy tests: `node --test tests/opportunities-proxy.test.mjs`. Agent tests: `npm test` in `agent/`.
