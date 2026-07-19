'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// Pixlr-style visual layers for a Style Lab resource page (Aj, 2026-07-19).
// The rendered page is on the right; Style Lab (Claude vision) identifies the
// real visual components -- skull, flowers, border, number labels, motifs --
// grouped into background / midground / foreground. Toggle a component's eye
// off and it vanishes from the image, leaving the core you like. Save any single
// component, the kept view, or the palette to your Parts Library.
//
// Removal is currently by the component's bounding box (coarse -- on dense
// overlapping art it can clip a neighbour). Exact-shape (Segment-Anything) masks
// slot in once REPLICATE_API_TOKEN is added to the project.
const LEVELS = [
  { key: 'foreground', label: 'Foreground', hint: 'Main subject & focal elements' },
  { key: 'midground', label: 'Midground', hint: 'Supporting decoration' },
  { key: 'background', label: 'Background', hint: 'Borders, framing, backdrop' },
];

export default function VisualComponents({ userId, resourceId }) {
  const [page, setPage] = useState(1);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hidden, setHidden] = useState(() => new Set());
  const [hoverId, setHoverId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  const analyze = useCallback(async (refresh = false) => {
    setLoading(true); setError(null); setSavedMsg(null);
    try {
      const res = await fetch('/api/style-lab/analyze-components', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, resourceId, page, refresh }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Analysis failed');
      setAnalysis(d.analysis);
      setHidden(new Set());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [userId, resourceId, page]);

  useEffect(() => { analyze(false); }, [analyze]);

  // Load the analyzed image, then (re)composite whenever visibility changes.
  useEffect(() => {
    if (!analysis?.imageUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imgRef.current = img; draw(); };
    img.onerror = () => setError('Could not load the rendered page image.');
    img.src = analysis.imageUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current; const img = imgRef.current;
    if (!canvas || !img || !analysis) return;
    canvas.width = analysis.width; canvas.height = analysis.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, analysis.width, analysis.height);
    ctx.fillStyle = '#ffffff';
    for (const c of analysis.components) {
      if (!hidden.has(c.id)) continue;
      const b = c.box;
      ctx.fillRect(b.x * analysis.width, b.y * analysis.height, b.w * analysis.width, b.h * analysis.height);
    }
  }, [analysis, hidden]);

  useEffect(() => { draw(); }, [draw]);

  const toggle = (id) => setHidden((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function save(payload, label) {
    setSaving(true); setSavedMsg(null);
    try {
      const res = await fetch('/api/style-lab/save-view', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, resourceId, ...payload }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Save failed');
      setSavedMsg(`Saved ${label} to Parts Library ✓`);
    } catch (e) { setSavedMsg(e.message); }
    finally { setSaving(false); }
  }

  const saveComponent = (c) => save({ title: `Component: ${c.name}`, category: 'style_lab_component', crop: c.box }, `"${c.name}"`);
  const saveView = () => {
    const hiddenBoxes = analysis.components.filter((c) => hidden.has(c.id)).map((c) => c.box);
    save({ title: `Kept view (page ${page})`, category: 'style_lab_view', hiddenBoxes }, 'the kept view');
  };
  const savePalette = () => {
    const sw = 60, h = 70; const c = document.createElement('canvas');
    c.width = sw * analysis.palette.length; c.height = h;
    const ctx = c.getContext('2d');
    analysis.palette.forEach((p, i) => { ctx.fillStyle = p.hex; ctx.fillRect(i * sw, 0, sw, h); });
    save({ title: 'Color palette', category: 'palette', dataUrl: c.toDataURL('image/png') }, 'the palette');
  };

  const grouped = (lvl) => (analysis?.components || []).filter((c) => c.level === lvl);

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 6 }}>
      {/* LEFT: layers + palette */}
      <div style={{ flex: '1 1 260px', minWidth: 220 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2f6b41' }}>Visual components</div>
          <button onClick={() => analyze(true)} disabled={loading}
            style={{ fontSize: 10, color: '#7a3c8a', background: '#f5eafa', border: '1px solid #d9b8e8', borderRadius: 4, padding: '2px 6px', cursor: loading ? 'default' : 'pointer' }}>
            ↻ Re-analyze
          </button>
        </div>

        {loading && <p style={{ fontSize: 12, color: '#888' }}>Identifying components on this page…</p>}
        {error && <p style={{ fontSize: 12, color: '#a33' }}>{error}</p>}

        {analysis && !loading && LEVELS.map((L) => {
          const items = grouped(L.key);
          if (!items.length) return null;
          return (
            <div key={L.key} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#1c3557', textTransform: 'uppercase', letterSpacing: 0.4 }}>{L.label}</div>
              <div style={{ fontSize: 9, color: '#aaa', marginBottom: 2 }}>{L.hint}</div>
              {items.map((c) => {
                const isHidden = hidden.has(c.id);
                return (
                  <div key={c.id}
                    onMouseEnter={() => setHoverId(c.id)} onMouseLeave={() => setHoverId(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', borderRadius: 4, background: hoverId === c.id ? '#eef6f0' : 'transparent', opacity: isHidden ? 0.45 : 1 }}>
                    <button onClick={() => toggle(c.id)} title={isHidden ? 'Hidden — click to show' : 'Visible — click to remove'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, width: 18 }}>
                      {isHidden ? '🚫' : '👁'}
                    </button>
                    <span style={{ flex: 1, fontSize: 11, color: '#333', textDecoration: isHidden ? 'line-through' : 'none' }}>{c.name}</span>
                    <span style={{ fontSize: 8, color: '#999', background: '#f0ece3', borderRadius: 3, padding: '1px 4px' }}>{c.category}</span>
                    <button onClick={() => saveComponent(c)} disabled={saving} title="Save this component to Parts Library"
                      style={{ background: 'none', border: 'none', cursor: saving ? 'default' : 'pointer', fontSize: 12, padding: 0 }}>⭐</button>
                  </div>
                );
              })}
            </div>
          );
        })}

        {analysis && analysis.palette?.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#1c3557', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>Palette</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {analysis.palette.map((p, i) => (
                <div key={i} title={`${p.hex} · ${Math.round(p.proportion * 100)}%`}
                  style={{ width: 24, height: 24, borderRadius: 4, background: p.hex, border: '1px solid #ccc' }} />
              ))}
            </div>
            <button onClick={savePalette} disabled={saving}
              style={{ marginTop: 4, fontSize: 10, color: '#7a3c8a', background: '#f5eafa', border: '1px solid #d9b8e8', borderRadius: 4, padding: '2px 8px', cursor: saving ? 'default' : 'pointer' }}>
              ⭐ Save palette
            </button>
          </div>
        )}

        {analysis && !loading && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={saveView} disabled={saving}
              style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: '#2f6b41', border: 'none', borderRadius: 5, padding: '4px 10px', cursor: saving ? 'default' : 'pointer' }}>
              {saving ? 'Saving…' : '⭐ Save kept view'}
            </button>
            {savedMsg && <span style={{ fontSize: 11, color: savedMsg.startsWith('Saved') ? '#2f6b41' : '#a33' }}>{savedMsg}</span>}
          </div>
        )}

        <div style={{ fontSize: 9, color: '#aaa', marginTop: 8, lineHeight: 1.4 }}>
          Removal is by each component's box for now, so on dense overlapping art it can clip a neighbour.
          Exact-shape cut-outs turn on once a Replicate token is added.
        </div>
      </div>

      {/* RIGHT: the composited page */}
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <div style={{ position: 'relative', border: '1px solid #e3ddd0', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
          <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} />
          {/* hover highlight */}
          {analysis && hoverId && (() => {
            const c = analysis.components.find((x) => x.id === hoverId); if (!c) return null; const b = c.box;
            return <div style={{ position: 'absolute', left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`, border: '2px solid #7a3c8a', background: 'rgba(122,60,138,0.12)', borderRadius: 2, pointerEvents: 'none' }} />;
          })()}
          {loading && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.6)', fontSize: 12, color: '#2f6b41' }}>Analyzing…</div>}
        </div>
      </div>
    </div>
  );
}
