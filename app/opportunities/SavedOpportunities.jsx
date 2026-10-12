'use client';
import { useEffect, useState } from 'react';

async function request(path, password, method = 'GET') {
  const response = await fetch(path, { method, cache: 'no-store', headers: password ? { 'x-site-password': password } : {} });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load opportunities.');
  return data;
}
function Cards({ rows, decide, busy }) {
  return <div className="opportunity-grid">{rows.map(row => {
    const item = row.opportunity || {};
    const href = /^https?:\/\//i.test(row.url) ? row.url : null;
    return <article className="opportunity-card" key={row.id}>
      <span className="opportunity-type">{item.kind || 'Opportunity'}</span><h3>{row.name}</h3>
      <p className="opportunity-location">{item.location}</p><p>{item.whyItFits}</p>
      <dl><div><dt>Availability</dt><dd>{item.availability}</dd></div><div><dt>Eligibility</dt><dd>{item.eligibility}</dd></div></dl>
      {(item.evidence || []).map((e, i) => <blockquote key={i}>{e.excerpt}</blockquote>)}
      {href && <p><a href={href} target="_blank" rel="noopener noreferrer">Read the official source ↗</a></p>}
      {decide && <div className="opportunity-actions"><button className="button" disabled={!!busy} onClick={() => decide(row, 'approve')}>Approve</button><button className="quiet-button" disabled={!!busy} onClick={() => decide(row, 'reject')}>Reject</button></div>}
    </article>;
  })}</div>;
}
export default function SavedOpportunities({ password, refreshToken }) {
  const [approved, setApproved] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    if (!password) setPending([]);
    Promise.all([request('/api/opportunities'), password ? request('/api/opportunities/new', password) : Promise.resolve({ rows: [] })])
      .then(([publicRows, newRows]) => { if (active) { setApproved(publicRows.rows); setPending(newRows.rows); } })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [password, refreshToken]);
  async function decide(row, action) {
    const previousApproved = approved, previousPending = pending;
    setBusy(row.id); setError(''); setNotice(action === 'approve' ? 'Approving…' : 'Rejecting…');
    setPending(items => items.filter(item => item.id !== row.id));
    if (action === 'approve') setApproved(items => [...items, { ...row, status: 'approved' }].sort((a,b) => b.created_at.localeCompare(a.created_at) || Number(b.id)-Number(a.id)));
    try { await request(`/api/opportunities/${row.id}/${action}`, password, 'POST'); setNotice(action === 'approve' ? 'Approved and published.' : 'Rejected.'); }
    catch (e) { setApproved(previousApproved); setPending(previousPending); setError(e.message); setNotice('Decision was not saved.'); }
    finally { setBusy(null); }
  }
  return <section className="opportunity-results" aria-label="Saved opportunities">
    <h2>Approved opportunities</h2>
    {loading && <p role="status">Loading opportunities…</p>}
    {error && <p className="opportunity-error" role="alert">{error}</p>}
    <Cards rows={approved} />
    {!loading && !approved.length && !error && <p>No approved opportunities yet.</p>}
    {password && <section><h2>New opportunities to review</h2><p role="status">{notice}</p><Cards rows={pending} decide={decide} busy={busy} />{!loading && !pending.length && <p>No new opportunities to review.</p>}</section>}
  </section>;
}
