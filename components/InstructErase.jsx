'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// AI Instruction Removal (Aj, 2026-07-19): "I want there to be an AI box
// that I can write instructions in such as 'remove Morpho Science from each
// page'." A free-text alternative to manually toggling components in
// VisualComponents -- describe what to remove, run it across one page or
// every page at once, review the results as thumbnails (each auto-saved to
// Parts Library), no per-component clicking required.
//
// 2026-07-19, later same day: this box only ever REMOVES (inpaint-erase) --
// it has no way to ADD something (a border, a new element). Rather than
// half-fake that here, "→ Send to Style Editor" routes the same typed
// instruction to Asset Modifier instead, pre-filled with this page's image
// and ready to run -- Aj: "it will know which modifier and where to put
// it." Removal instructions stay right here; anything additive/transformative
// goes there.
export default function InstructErase({ userId, resourceId }) {
  const router = useRouter();
  const [instruction, setInstruction] = useState('');
  const [scope, setScope] = useState('all'); // 'all' | 'current'
  const [pageNum, setPageNum] = useState(1);
  const [running, setRunning] = useState(false);
  const [sending, setSending] = useState(false);
  const [summary, setSummary] = useState(null);
  const [results, setResults] = useState([]);

  async function run() {
    if (!instruction.trim() || running) return;
    setRunning(true); setSummary(null); setResults([]);
    try {
      const body = { userId, resourceId, instruction: instruction.trim() };
      if (scope === 'current') body.pages = [pageNum];
      const res = await fetch('/api/style-lab/instruct-erase', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setSummary({ cleaned: d.cleaned, notFound: d.notFound, errored: d.errored, total: d.pageCount });
      setResults(d.results || []);
    } catch (e) {
      setSummary({ error: e.message });
    } finally {
      setRunning(false);
    }
  }

  // Sends the same typed instruction to the Style Editor (Asset Modifier)
  // instead of trying to remove-match it here -- for "add a border", "make
  // the title bigger", or anything else that isn't a removal.
  async function sendToStyleEditor() {
    if (!instruction.trim() || sending) return;
    setSending(true);
    try {
      let imageUrl = null;
      try {
        const res = await fetch('/api/style-lab/analyze-components', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, resourceId, page: scope === 'current' ? pageNum : 1 }),
        });
        const d = await res.json();
        if (res.ok) imageUrl = d.analysis?.imageUrl;
      } catch { /* still navigate even if the preview fetch fails */ }
      const params = new URLSearchParams({ title: 'Style Editor edit', aiInstruction: instruction.trim() });
      if (imageUrl) params.set('assetUrl', imageUrl);
      router.push(`/dashboard/asset-modifier?${params.toString()}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ marginBottom: 14, padding: 12, background: '#fff', border: '1px solid #d9b8e8', borderRadius: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#7a3c8a', marginBottom: 4 }}>🪄 AI Instruction</div>
      <p style={{ fontSize: 11, color: '#888', margin: '0 0 8px' }}>
        <strong>Remove</strong> something (e.g. "remove Morpho Science from each page") and Apply handles
        it right here. Want to <strong>add or change</strong> something instead (e.g. "add a border",
        "make the title bigger")? Same box -- click "Send to Style Editor →" and it opens there with
        this image and instruction already loaded.
      </p>
      <input
        type="text" value={instruction} onChange={(e) => setInstruction(e.target.value)}
        placeholder={'e.g. Remove "Morpho Science" from each page -- or "add a thin gold border"'}
        disabled={running}
        onKeyDown={(e) => { if (e.key === 'Enter') run(); }}
        style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid #d9b8e8', borderRadius: 4, boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 11, color: '#555', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} disabled={running} />
          All pages
        </label>
        <label style={{ fontSize: 11, color: '#555', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="radio" checked={scope === 'current'} onChange={() => setScope('current')} disabled={running} />
          Just page
          <input
            type="number" min={1} value={pageNum}
            onChange={(e) => setPageNum(Math.max(1, parseInt(e.target.value, 10) || 1))}
            disabled={running || scope !== 'current'}
            style={{ width: 44, fontSize: 11, padding: '2px 4px', border: '1px solid #d9b8e8', borderRadius: 4 }}
          />
        </label>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={sendToStyleEditor} disabled={sending || !instruction.trim()}
            title="For additions/changes instead of removals"
            style={{ fontSize: 12, fontWeight: 600, color: '#7a3c8a', background: '#fff', border: '1px solid #7a3c8a', borderRadius: 5, padding: '5px 14px', cursor: sending || !instruction.trim() ? 'default' : 'pointer', opacity: sending || !instruction.trim() ? 0.6 : 1 }}>
            {sending ? 'Opening…' : '🖌 Send to Style Editor →'}
          </button>
          <button onClick={run} disabled={running || !instruction.trim()}
            style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#7a3c8a', border: 'none', borderRadius: 5, padding: '5px 14px', cursor: running || !instruction.trim() ? 'default' : 'pointer', opacity: running || !instruction.trim() ? 0.6 : 1 }}>
            {running ? 'Working…' : 'Apply'}
          </button>
        </div>
      </div>

      {summary?.error && <p style={{ fontSize: 11, color: '#a33', marginTop: 8 }}>{summary.error}</p>}
      {summary && !summary.error && (
        <p style={{ fontSize: 11, color: '#555', marginTop: 8 }}>
          {summary.cleaned} page{summary.cleaned === 1 ? '' : 's'} cleaned and saved to Parts Library
          {summary.notFound > 0 ? `, ${summary.notFound} page${summary.notFound === 1 ? '' : 's'} had no match` : ''}
          {summary.errored > 0 ? `, ${summary.errored} page${summary.errored === 1 ? '' : 's'} failed` : ''}.
        </p>
      )}

      {results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8, marginTop: 8 }}>
          {results.map((r) => (
            <div key={r.page} style={{ textAlign: 'center' }}>
              {r.status === 'cleaned' ? (
                <a href={r.imageUrl} target="_blank" rel="noreferrer">
                  <img src={r.imageUrl} alt={`Page ${r.page} cleaned`} style={{ width: '100%', borderRadius: 4, border: '1px solid #d9b8e8', display: 'block' }} />
                </a>
              ) : (
                <div style={{ width: '100%', aspectRatio: '3 / 4', background: '#f5f5f0', borderRadius: 4, border: '1px dashed #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 9, color: '#aaa', padding: 4 }}>{r.status === 'not_found' ? 'no match' : 'error'}</span>
                </div>
              )}
              <div style={{ fontSize: 9, color: '#999', marginTop: 2 }}>Page {r.page}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
