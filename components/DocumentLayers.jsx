'use client';

import { useEffect, useRef, useState } from 'react';

// Acrobat-style visual layer view for a Style Lab resource's PDF (Aj,
// 2026-07-19). Layer toggles on the LEFT, the rendered page on the RIGHT;
// deselect Text / Images / Graphics and the page re-renders without that kind
// of content, so you can peel the document apart and see what's left. Backed
// by /api/style-lab/layer-render, which strips the disabled content at the PDF
// source level and rasterizes the result.
const LAYERS = [
  { key: 'text', label: 'Text', hint: 'All words & typography' },
  { key: 'images', label: 'Images', hint: 'Clipart & photos' },
];

export default function DocumentLayers({ userId, resourceId }) {
  const [layers, setLayers] = useState({ text: true, images: true });
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [imgUrl, setImgUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const objUrlRef = useRef(null);
  const debounceRef = useRef(null);

  function buildUrl() {
    const p = new URLSearchParams({
      userId,
      resourceId,
      page: String(page),
      scale: '1.5',
      text: layers.text ? '1' : '0',
      images: layers.images ? '1' : '0',
    });
    return `/api/style-lab/layer-render?${p.toString()}`;
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildUrl(), { cache: 'no-store' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Render failed (${res.status})`);
      }
      const pc = parseInt(res.headers.get('X-Page-Count') || '1', 10);
      if (pc && pc !== pageCount) setPageCount(pc);
      const blob = await res.blob();
      if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
      const u = URL.createObjectURL(blob);
      objUrlRef.current = u;
      setImgUrl(u);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId, page, layers.text, layers.images]);

  useEffect(() => () => { if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current); }, []);

  const toggle = (k) => setLayers((prev) => ({ ...prev, [k]: !prev[k] }));

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 6 }}>
      {/* LEFT: layer toggles + page nav */}
      <div style={{ flex: '0 0 190px', minWidth: 160 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#2f6b41', marginBottom: 6 }}>Visual layers</div>
        {LAYERS.map((L) => (
          <label key={L.key} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '4px 0', cursor: 'pointer' }}>
            <input type="checkbox" checked={layers[L.key]} onChange={() => toggle(L.key)} style={{ marginTop: 2 }} />
            <span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1c3557' }}>{L.label}</span>
              <span style={{ display: 'block', fontSize: 10, color: '#999' }}>{L.hint}</span>
            </span>
          </label>
        ))}
        {pageCount > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #b8dcc2', borderRadius: 4, background: '#fff', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}
            >←</button>
            <span style={{ fontSize: 11, color: '#555' }}>Page {page} / {pageCount}</span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #b8dcc2', borderRadius: 4, background: '#fff', cursor: page >= pageCount ? 'default' : 'pointer', opacity: page >= pageCount ? 0.4 : 1 }}
            >→</button>
          </div>
        )}
        <div style={{ fontSize: 9, color: '#999', marginTop: 8, lineHeight: 1.4 }}>
          Uncheck <b>Images</b> to see the page with clipart & photos removed (text and borders stay);
          uncheck <b>Text</b> to see just the visuals. These are the layers a flat PDF can be split into,
          not the 8 style layers above.
        </div>
      </div>

      {/* RIGHT: the rendered page */}
      <div style={{ flex: '1 1 300px', minWidth: 0 }}>
        <div style={{ position: 'relative', border: '1px solid #e3ddd0', borderRadius: 8, background: '#fff', minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
          {error ? (
            <p style={{ fontSize: 12, color: '#a33', padding: 16, textAlign: 'center' }}>{error}</p>
          ) : imgUrl ? (
            <img src={imgUrl} alt="Document layers preview" style={{ maxWidth: '100%', maxHeight: 520, borderRadius: 4, opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }} />
          ) : (
            <p style={{ fontSize: 12, color: '#bbb' }}>Rendering…</p>
          )}
          {loading && imgUrl && (
            <span style={{ position: 'absolute', top: 8, right: 10, fontSize: 10, color: '#2f6b41', background: '#eef6f0', border: '1px solid #b8dcc2', borderRadius: 4, padding: '2px 6px' }}>
              Updating…
            </span>
          )}
        </div>
        {imgUrl && !error && (
          <a href={imgUrl} download={`page-${page}.png`} style={{ fontSize: 11, color: '#2f6b41', display: 'inline-block', marginTop: 6 }}>
            ⬇ Download this view (PNG)
          </a>
        )}
      </div>
    </div>
  );
}
