'use client';
import { useEffect, useRef, useState } from 'react';

const activeLabel = { starting: 'Getting started', researching: 'Checking matches', searching: 'Searching for opportunities',
  reading_sources: 'Reading sources', checking_matches: 'Checking matches', checking_evidence: 'Checking matches and eligibility',
  completed: 'Search complete', cancelled: 'Search cancelled', timed_out: 'Search timed out', failed: 'Search failed' };
const evidenceLabel = { age: 'Age', location: 'Location', availability: 'Open now', other_requirements: 'Other requirements' };
function elapsed(seconds = 0) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
function safeHref(value) {
  try { const url = new URL(value); return ['http:','https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
function Source({ url, children }) {
  const href = safeHref(url);
  return href ? <a href={href} target="_blank" rel="noopener noreferrer">{children || new URL(href).hostname} ↗</a> : null;
}
async function api(path, options = {}) {
  let response;
  try { response = await fetch(path, { ...options, cache: 'no-store', credentials: 'same-origin' }); }
  catch { throw new Error('The website could not be reached. Check your connection and try again.'); }
  let data;
  try { data = await response.json(); } catch { throw new Error('The website returned an unexpected response. Please try again.'); }
  if (!response.ok) throw new Error(data.error || 'The search could not be completed.');
  return data;
}

export default function Opportunities() {
  const [passwordForm, setPasswordForm] = useState(false);
  const [password, setPassword] = useState('');
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(false);
  const jobRef = useRef(null);
  const mounted = useRef(true);
  const jobId = snapshot?.id;
  const running = snapshot?.status === 'running';

  useEffect(() => {
    mounted.current = true;
    const cancelOnLeave = () => {
      if (jobRef.current) fetch(`/api/opportunities/jobs/${jobRef.current}/cancel`, { method: 'POST', keepalive: true, credentials: 'same-origin' }).catch(() => {});
    };
    window.addEventListener('pagehide', cancelOnLeave);
    return () => { mounted.current = false; window.removeEventListener('pagehide', cancelOnLeave); cancelOnLeave(); };
  }, []);

  useEffect(() => {
    if (!jobId || !polling) return;
    let disposed = false;
    let timeout;
    let controller;
    const poll = async () => {
      controller = new AbortController();
      try {
        const data = await api(`/api/opportunities/jobs/${jobId}`, { signal: controller.signal });
        if (disposed) return;
        setSnapshot(data);
        if (data.status !== 'running') {
          jobRef.current = null;
          setPolling(false);
          if (data.status !== 'completed' && data.status !== 'cancelled') setError(data.error || 'The search could not finish. Please refresh to try again.');
        } else timeout = setTimeout(poll, 1500);
      } catch (failure) {
        if (disposed) return;
        setError(failure.message);
        setPolling(false);
        // Keep the job ID so cancellation can still stop work after a polling error.
      }
    };
    poll();
    return () => { disposed = true; clearTimeout(timeout); controller?.abort(); };
  }, [jobId, polling]);

  async function start(event) {
    event.preventDefault();
    setStarting(true); setError('');
    const suppliedPassword = password;
    setPassword('');
    try {
      const data = await api('/api/opportunities/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: suppliedPassword }) });
      jobRef.current = data.id;
      if (!mounted.current) {
        fetch(`/api/opportunities/jobs/${data.id}/cancel`, { method: 'POST', credentials: 'same-origin', keepalive: true }).catch(() => {});
        return;
      }
      setSnapshot({ ...data, phase: 'starting', progress: { searches: 0, pageReads: 0, elapsedSeconds: 0 }, toolCalls: [] });
      setPasswordForm(false); setPolling(true);
    } catch (failure) { if (mounted.current) setError(failure.message); }
    finally { if (mounted.current) setStarting(false); }
  }
  async function cancel() {
    if (!jobId) return;
    setCancelling(true); setError('');
    try {
      const data = await api(`/api/opportunities/jobs/${jobId}/cancel`, { method: 'POST' });
      setSnapshot(data); setPolling(false); jobRef.current = null;
    } catch (failure) { setError(failure.message); }
    finally { setCancelling(false); }
  }
  const results = snapshot?.status === 'completed' ? snapshot.results : null;
  const calls = (snapshot?.toolCalls || []).filter(event => event.tool !== 'built_in_web_search');

  return <>
    <div className="opportunities-heading">
      <div><p className="eyebrow">A LITTLE SOMETHING FOR YOU</p><h1>New <em>possibilities.</em></h1><p className="intro">Competitions, programs and events chosen around your interests, with the details checked at the source.</p></div>
      <button className="button" disabled={starting || running} onClick={() => { setPasswordForm(true); setError(''); }}>Refresh <span aria-hidden="true">↻</span></button>
    </div>
    {passwordForm && <form className="opportunity-password" onSubmit={start}>
      <div><h2>A little check before we begin.</h2><p>Enter your site password to refresh your opportunities.</p></div>
      <label htmlFor="site-password">Site password<input id="site-password" type="password" autoFocus autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required maxLength={1024} disabled={starting} /></label>
      <div className="opportunity-actions"><button className="button" type="submit" disabled={starting || !password}>{starting ? 'Starting…' : 'Find opportunities'} <span aria-hidden="true">↗</span></button><button className="quiet-button" type="button" disabled={starting} onClick={() => { setPassword(''); setPasswordForm(false); }}>Close</button></div>
    </form>}
    {error && <div className="opportunity-error" role="alert"><strong>We couldn’t finish that request.</strong><p>{error}</p>{running && !polling && <button className="quiet-button" onClick={() => { setError(''); setPolling(true); }}>Retry progress check</button>}</div>}
    {snapshot && <section className="opportunity-progress" aria-label="Search progress">
      <div className="progress-heading"><div className="progress-title" role="status" aria-live="polite"><span className={`progress-dot ${running && polling ? 'active' : ''}`} aria-hidden="true" /><h2>{activeLabel[snapshot.phase] || activeLabel[snapshot.status]}</h2></div>{running && <button className="quiet-button cancel-button" disabled={cancelling} onClick={cancel}>{cancelling ? 'Cancelling…' : 'Cancel'}</button>}</div>
      <div className="progress-counts"><span><strong>{snapshot.progress?.searches || 0}</strong> / 10 searches</span><span><strong>{snapshot.progress?.pageReads || 0}</strong> / 15 source reads</span><span><strong>{elapsed(snapshot.progress?.elapsedSeconds)}</strong> elapsed</span></div>
      <details className="activity-details"><summary>See searches and source links <span>{calls.length} updates</span></summary>{calls.length ? <ol className="activity-list">{calls.map((event, index) => <li key={`${index}-${event.elapsedSeconds}`}><time>{elapsed(event.elapsedSeconds)}</time><div><span className="activity-kind">{event.tool === 'open_page' ? 'Reading source' : 'Searching'}</span>{event.arguments?.query && <p>{event.arguments.query}</p>}{event.arguments?.url && <Source url={event.arguments.url}>{event.arguments.url}</Source>}<small>{event.status}</small></div></li>)}</ol> : <p className="muted">Waiting for the agent’s first activity.</p>}</details>
      {snapshot.status === 'cancelled' && <p className="muted">Your search has stopped. Refresh whenever you’re ready to start again.</p>}
    </section>}
    {!snapshot && !passwordForm && <div className="opportunities-empty"><span aria-hidden="true">✳</span><h2>A little more to look forward to.</h2><p>Refresh to look for current opportunities around cats, shopping and cooking.</p><p className="privacy-note">Results stay on this page only and are not saved.</p></div>}
    {results && <section className="opportunity-results" aria-label="Search results">
      <div className="section-heading"><div><p className="eyebrow">CHECKED, NOT GUESSED</p><h2>{results.opportunities?.length ? <>Worth a <em>look.</em></> : 'No verified matches this time.'}</h2></div><p>Only opportunities supported by read sources.</p></div>
      <p className="results-summary">{results.summary}</p>
      <div className="opportunity-grid">{(results.opportunities || []).map((item, index) => <article className="opportunity-card" key={`${item.name}-${index}`}>
        <div className="card-topline"><span className="opportunity-type">{item.kind}</span><span className="card-number">{String(index + 1).padStart(2, '0')}</span></div><h3>{item.name}</h3><p className="opportunity-location">{item.location} · {item.organizer}</p><p>{item.whyItFits}</p>
        <dl><div><dt>Availability</dt><dd>{item.availability}</dd></div><div><dt>Eligibility</dt><dd>{item.eligibility}</dd></div></dl>
        <div className="source-evidence">{(item.evidence || []).map((evidence, i) => <div className="evidence-entry" key={i}><span>{evidenceLabel[evidence.criterion] || 'Source check'}</span><blockquote>“{evidence.excerpt}”</blockquote><p>{evidence.explanation}</p><Source url={evidence.url} /></div>)}</div><div className="official-source"><Source url={item.officialUrl}>Read the official source</Source></div>
      </article>)}</div>
      {!!results.ruledOut?.length && <section className="ruled-out"><h3>What didn’t make the list.</h3><p className="muted">Closed, unsuitable or not verified with enough evidence.</p><ul>{results.ruledOut.map((item, index) => <li key={`${item.name}-${index}`}><div className="ruled-heading"><h4>{item.name}</h4><span>{item.decision === 'unverified' ? 'Not verified' : item.decision === 'closed' ? 'Closed' : 'Not eligible'}</span></div><p>{item.reason}</p><div className="ruled-links">{[...new Set(item.sourceUrls || [])].map(url => <Source url={url} key={url} />)}</div></li>)}</ul></section>}
      <p className="privacy-note">Results are not saved. Refresh or leave this page to start fresh.</p>
    </section>}
  </>;
}
