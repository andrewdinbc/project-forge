'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { SYSTEM_FONTS } from '@/lib/style-lab-fonts';

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
  const [savingFonts, setSavingFonts] = useState(false);
  const [savedFontsMsg, setSavedFontsMsg] = useState(null);
  const [fontSearch, setFontSearch] = useState({}); // fontName -> { loading, data, error }
  const [inpainting, setInpainting] = useState(false);
  const [inpaintMsg, setInpaintMsg] = useState(null);
  const [inpaintedUrl, setInpaintedUrl] = useState(null);
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

  // Samples a thin ring of pixels just OUTSIDE a box and returns their average
  // color, so painting over a removed component blends with whatever's really
  // there (colored banner background, tinted paper, etc.) instead of assuming
  // white. Free, instant, client-side -- handles flat/near-flat surroundings
  // well; genuine textures/gradients still want the AI smart-erase below.
  // Falls back to white if pixel reads are blocked (CORS-tainted canvas).
  function sampleEdgeColor(ctx, x, y, w, h, W, H) {
    try {
      const pad = 6;
      const samples = [];
      const grab = (sx, sy, sw, sh) => {
        sx = Math.max(0, Math.min(W - 1, Math.round(sx)));
        sy = Math.max(0, Math.min(H - 1, Math.round(sy)));
        sw = Math.max(1, Math.min(W - sx, Math.round(sw)));
        sh = Math.max(1, Math.min(H - sy, Math.round(sh)));
        const d = ctx.getImageData(sx, sy, sw, sh).data;
        for (let i = 0; i < d.length; i += 4) samples.push([d[i], d[i + 1], d[i + 2]]);
      };
      grab(x, y - pad, w, pad);           // strip above
      grab(x, y + h, w, pad);             // strip below
      grab(x - pad, y, pad, h);           // strip left
      grab(x + w, y, pad, h);             // strip right
      if (!samples.length) return '#ffffff';
      const sum = samples.reduce((a, s) => [a[0] + s[0], a[1] + s[1], a[2] + s[2]], [0, 0, 0]);
      const n = samples.length;
      const hex = (v) => Math.max(0, Math.min(255, Math.round(v / n))).toString(16).padStart(2, '0');
      return `#${hex(sum[0])}${hex(sum[1])}${hex(sum[2])}`;
    } catch {
      return '#ffffff'; // tainted canvas (CORS) -- degrade gracefully
    }
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current; const img = imgRef.current;
    if (!canvas || !img || !analysis) return;
    canvas.width = analysis.width; canvas.height = analysis.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, analysis.width, analysis.height);
    for (const c of analysis.components) {
      if (!hidden.has(c.id)) continue;
      const b = c.box;
      const x = b.x * analysis.width, y = b.y * analysis.height, w = b.w * analysis.width, h = b.h * analysis.height;
      ctx.fillStyle = sampleEdgeColor(ctx, x, y, w, h, analysis.width, analysis.height);
      ctx.fillRect(x, y, w, h);
    }
  }, [analysis, hidden]);

  useEffect(() => { draw(); }, [draw]);

  const toggle = (id) => setHidden((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  useEffect(() => { setInpaintedUrl(null); setInpaintMsg(null); }, [hidden, page]);


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

  // Saves the font NAME(s) declared in the PDF, not the font itself -- a font
  // is separately-licensed software, and its actual program (glyph outlines)
  // isn't ours to extract and reuse. This gives you the real name so you can
  // go get your own license for it, the same way the palette gives you real
  // hex codes instead of a picture of some colors. Aj, 2026-07-19.
  async function saveFonts() {
    setSavingFonts(true); setSavedFontsMsg(null);
    try {
      const res = await fetch('/api/library-parts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId, kind: 'component',
          sourceId: `stylelab-fonts:${resourceId}:${page}`,
          title: `Fonts used (page ${page})`,
          category: 'font_reference',
          notes: analysis.fonts.join(', '),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Save failed');
      setSavedFontsMsg(d.alreadySaved ? 'Already in Parts Library' : 'Saved to Parts Library ✓');
    } catch (e) { setSavedFontsMsg(e.message); }
    finally { setSavingFonts(false); }
  }

  // Per Aj, 2026-07-19: "a button that will find similar and it will search
  // for similar free fonts... also buy the font if I am not satisfied with
  // what alternatives are." Free alternatives come from a real web search
  // (server-side); the buy link is a plain search URL built right here --
  // deliberately not AI-guessed, so it can't point somewhere wrong.
  async function findSimilarFonts(fontName) {
    setFontSearch((prev) => ({ ...prev, [fontName]: { loading: true, data: null, error: null } }));
    try {
      const res = await fetch('/api/style-lab/similar-fonts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fontName }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Search failed');
      setFontSearch((prev) => ({ ...prev, [fontName]: { loading: false, data: d, error: null } }));
    } catch (e) {
      setFontSearch((prev) => ({ ...prev, [fontName]: { loading: false, data: null, error: e.message } }));
    }
  }

  // AI generative fill (Replicate, LaMa inpainting model): reconstructs what's
  // actually behind the removed component(s) instead of the flat edge-color
  // guess above -- for banners/borders sitting on a pattern or gradient where
  // a single average color still looks like an obvious patch. Aj, 2026-07-19:
  // "recolor everything around it to look as though it wasn't there in the
  // first place." Needs REPLICATE_API_TOKEN (same one already added for
  // Generate Matching Set); server route handles the "not set yet" case.
  async function smartErase() {
    setInpainting(true); setInpaintMsg(null); setInpaintedUrl(null);
    try {
      const hiddenBoxes = analysis.components.filter((c) => hidden.has(c.id)).map((c) => c.box);
      const res = await fetch('/api/style-lab/inpaint-view', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, resourceId, page, hiddenBoxes }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Smart erase failed');
      setInpaintedUrl(d.imageUrl);
      setInpaintMsg('Seamless version saved to Parts Library ✓');
    } catch (e) { setInpaintMsg(e.message); }
    finally { setInpainting(false); }
  }

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

        {analysis && analysis.fonts?.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#1c3557', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>Fonts used</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {analysis.fonts.map((f, i) => {
                const isSystem = SYSTEM_FONTS.has(f);
                const search = fontSearch[f];
                const buyUrl = `https://www.google.com/search?q=${encodeURIComponent(`"${f}" font commercial license buy`)}`;
                return (
                  <div key={i} style={{ marginBottom: !isSystem ? 6 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, color: '#333', background: '#f0ece3', borderRadius: 4, padding: '2px 6px' }}>{f}</span>
                      {!isSystem && (
                        <>
                          <button onClick={() => findSimilarFonts(f)} disabled={search?.loading}
                            style={{ fontSize: 9, color: '#7a3c8a', background: 'none', border: 'none', textDecoration: 'underline', cursor: search?.loading ? 'default' : 'pointer', padding: 0 }}>
                            {search?.loading ? 'Searching…' : '🔍 Find similar free fonts'}
                          </button>
                          <a href={buyUrl} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: '#2f6b41', textDecoration: 'underline' }}>
                            💳 Buy this font
                          </a>
                        </>
                      )}
                    </div>
                    {!isSystem && (
                      <a
                        href={`/dashboard/asset-modifier?${new URLSearchParams({
                          tool: 'text',
                          title: `${f} lettering`,
                          ...(search?.data?.alternatives?.[0]?.name ? { fontFamily: search.data.alternatives[0].name } : {}),
                        }).toString()}`}
                        style={{
                          display: 'inline-block', marginTop: 4, fontSize: 13, fontWeight: 700, color: '#fff',
                          background: '#1c3557', borderRadius: 6, padding: '8px 16px', textDecoration: 'none',
                        }}
                      >
                        🔤 Push to Font Modifier
                      </a>
                    )}
                    {search?.error && <p style={{ fontSize: 9, color: '#a33', margin: '2px 0 0 4px' }}>{search.error}</p>}
                    {search?.data && (
                      <div style={{ margin: '4px 0 4px 4px', padding: '6px 8px', background: '#fafafa', border: '1px solid #eee', borderRadius: 6 }}>
                        {search.data.originalStyle && (
                          <p style={{ fontSize: 9, color: '#888', margin: '0 0 4px', fontStyle: 'italic' }}>{search.data.originalStyle}</p>
                        )}
                        {search.data.alternatives.length === 0 ? (
                          <p style={{ fontSize: 9, color: '#aaa', margin: 0 }}>No close matches found -- try "Buy this font" instead.</p>
                        ) : (
                          search.data.alternatives.map((a, j) => (
                            <div key={j} style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                              <a href={a.previewUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, fontWeight: 600, color: '#1c3557' }}>{a.name}</a>
                              <span style={{ fontSize: 9, color: '#888' }}>{a.reason}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={saveFonts} disabled={savingFonts}
              style={{ marginTop: 6, fontSize: 10, color: '#7a3c8a', background: '#f5eafa', border: '1px solid #d9b8e8', borderRadius: 4, padding: '2px 8px', cursor: savingFonts ? 'default' : 'pointer' }}>
              {savingFonts ? 'Saving…' : '⭐ Save font names'}
            </button>
            {savedFontsMsg && <span style={{ fontSize: 10, color: savedFontsMsg.startsWith('Saved') || savedFontsMsg.startsWith('Already') ? '#2f6b41' : '#a33', marginLeft: 6 }}>{savedFontsMsg}</span>}
            <p style={{ fontSize: 9, color: '#aaa', marginTop: 3, lineHeight: 1.4 }}>
              These are the actual font names this PDF declares -- saved as a reference so you can license
              the same font yourself, not as a reusable asset (fonts are separately-licensed software).
            </p>
          </div>
        )}

        {analysis && !loading && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={saveView} disabled={saving}
              style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: '#2f6b41', border: 'none', borderRadius: 5, padding: '4px 10px', cursor: saving ? 'default' : 'pointer' }}>
              {saving ? 'Saving…' : '⭐ Save kept view'}
            </button>
            {hidden.size > 0 && (
              <button onClick={smartErase} disabled={inpainting} title="Uses AI to fill removed areas so they blend in, instead of a flat color patch"
                style={{ fontSize: 11, fontWeight: 600, color: '#7a3c8a', background: '#f5eafa', border: '1px solid #d9b8e8', borderRadius: 5, padding: '4px 10px', cursor: inpainting ? 'default' : 'pointer' }}>
                {inpainting ? 'Blending…' : '🪄 Smart erase (AI)'}
              </button>
            )}
            {savedMsg && <span style={{ fontSize: 11, color: savedMsg.startsWith('Saved') ? '#2f6b41' : '#a33' }}>{savedMsg}</span>}
          </div>
        )}
        {inpaintMsg && (
          <p style={{ fontSize: 11, color: inpaintMsg.startsWith('Seamless') ? '#2f6b41' : '#a33', marginTop: 4 }}>{inpaintMsg}</p>
        )}
        {inpaintedUrl && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#1c3557', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>Seamless result</div>
            <img src={inpaintedUrl} alt="AI-blended removal" style={{ width: '100%', borderRadius: 6, border: '1px solid #d9b8e8' }} />
          </div>
        )}

        <div style={{ fontSize: 9, color: '#aaa', marginTop: 8, lineHeight: 1.4 }}>
          The live preview on the right uses a quick edge-color guess to fill removed areas, which
          looks right on flat or near-flat backgrounds. For a patterned or gradient background,
          "🪄 Smart erase" sends it to an AI inpainting model to reconstruct it properly.
        </div>
      </div>

      {/* RIGHT: page selector (sits directly above the page it controls) + composited page */}
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        {/* Per Aj, 2026-07-19: moved here from the left column -- makes more sense next
            to the page it's actually selecting, and there's room for it here. */}
        {(analysis?.pageCount || 1) > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '6px 10px', background: '#eef6f0', border: '1px solid #b8dcc2', borderRadius: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#1c3557' }}>📄 Page</span>
            <select
              value={page}
              disabled={loading}
              onChange={(e) => setPage(parseInt(e.target.value, 10))}
              style={{ fontSize: 12, fontWeight: 600, color: '#1c3557', border: '1px solid #b8dcc2', borderRadius: 4, padding: '3px 6px', background: '#fff', cursor: loading ? 'default' : 'pointer' }}
            >
              {Array.from({ length: analysis.pageCount }, (_, i) => i + 1).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <span style={{ fontSize: 11, color: '#555' }}>of {analysis.pageCount}</span>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={loading || page <= 1}
              style={{ fontSize: 12, border: '1px solid #b8dcc2', borderRadius: 4, padding: '2px 8px', background: '#fff', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}>←</button>
            <button onClick={() => setPage((p) => Math.min(analysis.pageCount, p + 1))} disabled={loading || page >= analysis.pageCount}
              style={{ fontSize: 12, border: '1px solid #b8dcc2', borderRadius: 4, padding: '2px 8px', background: '#fff', cursor: page >= analysis.pageCount ? 'default' : 'pointer', opacity: page >= analysis.pageCount ? 0.4 : 1 }}>→</button>
          </div>
        )}
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
