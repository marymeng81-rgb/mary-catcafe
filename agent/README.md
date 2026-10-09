# Verified opportunity agent

Requires Node.js 22 or newer. This package is independent of the website.

For Railway GitHub deployments, use the repository's `/agent` root directory and `npm start`. The public health endpoint returns `agent is running`.

From this directory:

```sh
npm install
npm start
```

On this PC, Node/npm are in the workspace’s portable runtime. If npm is not on your PATH, run this first from `agent/` in PowerShell:

```powershell
$env:PATH = "$PWD\..\.tools\node-v22.23.3-win-x64;$env:PATH"
```

The server loads this folder’s ignored `.env` file. Environment variables take precedence. Required slots: `OPENAI_API_KEY` and `AGENT_SECRET`. Optional: `PORT` (default 8080) and `OPENAI_MODEL` (default `gpt-4.1-mini`, must support Responses web search and structured outputs). No key is stored in source code.

Edit `interests.txt` to change the profile. It was copied from your original `interests.ext`; the original remains unchanged. The profile is sent to OpenAI for research. SDK tracing and response storage are disabled.

## HTTP endpoints

- `GET /`: returns the plain text `agent is running`.
- `POST /jobs`: supply the `AGENT_SECRET` header; returns HTTP 202 and a job `id`.
- `GET /jobs/:id`: supply the same header; returns status, phase, searches, page reads, elapsed seconds, tool-call log and final results or a clear error.
- `POST /jobs/:id/cancel`: supply the same header; aborts model requests and page fetches. Cancelling a completed job leaves it completed.

Use a server-side client. Do not place the secret in browser JavaScript. One job can run at a time; another POST receives 409. Completed jobs are held in memory for up to an hour, with a maximum of 100 retained jobs. Restarting the server loses job state. Requests do not accept arbitrary prompts: they use the local profile.

## Research and limits

The researcher is an OpenAI Agents SDK Agent. Its `web_search` function invokes a dedicated SDK Agent with the **built-in `webSearchTool()`**, forced once per request and capped with Responses `max_tool_calls: 1`. This wrapper lets the server enforce ten search attempts; SDK retries are disabled so retries cannot silently duplicate searches. Search hits are discovery, never final eligibility proof. The built-in call and each local tool call are printed as JSON.

`open_page` makes at most fifteen page-read attempts, including failures. Each read fetches one page (up to four HTTP redirects), supports HTML/plain text/PDF, limits downloads to 2 MB and time to fifteen seconds, and validates/pins public DNS addresses. It reports unreadable or truncated pages so the agent can investigate another official source. No JavaScript browser execution is used. Pages over 28,000 text characters are truncated; omitted rules cannot be assumed absent.

The four-minute wall-clock limit starts at job creation and includes final verification. At 210 seconds the SDK hides research tools to leave time to finish. Cancellation/deadline aborts ongoing network/model work; a timeout returns a clear error rather than unverified results. Logging never includes headers, keys, secrets, provider error bodies or raw page content.

The researcher investigates official sources and returns structured candidates. Exact source excerpts are checked against successfully-read pages, then a separate SDK evidence reviewer checks the profile, age rules, location, other requirements, dates and open availability. Any missing or unsupported evidence excludes that candidate as **unverified**, not as definitely ineligible. Results contain zero to five opportunities plus exclusions and unresolved candidates. Quoted excerpts are capped at 25 words per source URL across the final accepted results. Automated semantic checks reduce mistakes but cannot guarantee an external page is accurate; follow the linked organizer’s rules before applying.

Tests run offline with `npm test`. No live searches are triggered by the test suite. This package has not been deployed; Railway still serves the website until a separate deployment configuration change.
