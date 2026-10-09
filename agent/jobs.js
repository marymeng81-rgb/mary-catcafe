import { randomUUID } from 'node:crypto';

export const LIMITS = Object.freeze({ searches: 10, pageReads: 15, durationMs: 240_000 });

export function safeError(error) {
  if (error?.code === 'credit_balance_exhausted' || error?.code === 'insufficient_quota') return 'OpenAI API credit is exhausted.';
  if (error?.status === 401) return 'OpenAI rejected OPENAI_API_KEY.';
  if (error?.status === 429) return 'OpenAI rate limit or credit limit reached.';
  if (error?.status === 403) return 'OpenAI denied access to the selected model or tool.';
  if (error?.name === 'MaxTurnsExceededError') return 'The agent reached its turn limit before producing a verified result.';
  return 'The search could not be completed. Check configuration, API access, or network connectivity.';
}

export class Job {
  constructor({ durationMs = LIMITS.durationMs, logger = console.log } = {}) {
    this.id = randomUUID();
    this.startedAt = Date.now();
    this.durationMs = durationMs;
    this.status = 'running';
    this.phase = 'starting';
    this.searches = 0;
    this.pageReads = 0;
    this.events = [];
    this.pages = new Map();
    this.searchSucceeded = false;
    this.controller = new AbortController();
    this.logger = logger;
    this.timer = setTimeout(() => this.stop('timed_out', 'The four-minute search deadline was reached.'), durationMs);
    this.timer.unref();
  }
  get signal() { return this.controller.signal; }
  get remainingMs() { return Math.max(0, this.durationMs - (Date.now() - this.startedAt)); }
  assertActive() {
    if (this.remainingMs <= 0 && this.status === 'running') this.stop('timed_out', 'The four-minute search deadline was reached.');
    if (this.status !== 'running') throw new DOMException('Job stopped.', 'AbortError');
  }
  reserve(kind, args) {
    this.assertActive();
    if (this[kind] >= LIMITS[kind]) {
      this.log(kind === 'searches' ? 'web_search' : 'open_page', args, 'blocked: limit reached');
      return false;
    }
    this[kind]++;
    this.log(kind === 'searches' ? 'web_search' : 'open_page', args, 'started');
    return true;
  }
  log(tool, args, status) {
    if (this.status === 'running') {
      if (status === 'started') this.phase = tool === 'open_page' ? 'reading_sources' : 'searching';
      else if (['read', 'completed', 'unreadable', 'failed'].includes(status)) this.phase = 'checking_matches';
    }
    // Never log environment variables, tool response bodies, API errors or headers.
    const event = { tool, arguments: args, status, elapsedSeconds: this.elapsedSeconds() };
    this.events.push(event);
    if (this.events.length > 150) this.events.shift();
    this.logger(JSON.stringify({ jobId: this.id, ...event }));
  }
  elapsedSeconds() { return Math.round(((this.finishedAt ?? Date.now()) - this.startedAt) / 1000); }
  stop(status, error) {
    if (this.status !== 'running') return;
    this.status = status;
    this.error = error;
    this.finishedAt = Date.now();
    this.phase = status;
    clearTimeout(this.timer);
    this.controller.abort();
  }
  complete(results) {
    this.assertActive();
    this.results = results;
    this.finishedAt = Date.now();
    this.status = 'completed';
    this.phase = 'completed';
    clearTimeout(this.timer);
  }
  snapshot() {
    this.assertDeadlineOnly();
    return { id: this.id, status: this.status, phase: this.phase,
      progress: { searches: this.searches, pageReads: this.pageReads, elapsedSeconds: this.elapsedSeconds(),
        limits: { searches: LIMITS.searches, pageReads: LIMITS.pageReads, elapsedSeconds: 240 } },
      toolCalls: this.events, ...(this.results ? { results: this.results } : {}),
      ...(this.error ? { error: this.error } : {}) };
  }
  assertDeadlineOnly() {
    if (this.status === 'running' && this.remainingMs <= 0) this.stop('timed_out', 'The four-minute search deadline was reached.');
  }
}

export class JobStore {
  constructor(execute, { maxJobs = 100, durationMs, logger } = {}) {
    this.execute = execute;
    this.maxJobs = maxJobs;
    this.options = { durationMs, logger };
    this.jobs = new Map();
  }
  start() {
    for (const [id, job] of this.jobs) {
      if (job.finishedAt && Date.now() - job.finishedAt > 3_600_000) this.jobs.delete(id);
    }
    if ([...this.jobs.values()].some(j => j.status === 'running')) return { error: 'A job is already running.', status: 409 };
    if (this.jobs.size >= this.maxJobs) this.jobs.delete(this.jobs.keys().next().value);
    const job = new Job(this.options);
    this.jobs.set(job.id, job);
    setImmediate(async () => {
      try {
        const results = await this.execute(job);
        if (job.status === 'running') job.complete(results);
      } catch (error) {
        if (job.status === 'running') job.stop('failed', safeError(error));
      }
    });
    return { job };
  }
  get(id) {
    const job = this.jobs.get(id);
    if (job?.finishedAt && Date.now() - job.finishedAt > 3_600_000) { this.jobs.delete(id); return undefined; }
    return job;
  }
  close() { for (const job of this.jobs.values()) job.stop('cancelled', 'Server is shutting down.'); }
}
