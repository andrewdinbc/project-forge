'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { STYLE_CATEGORIES } from '@/lib/product-builder-categories';
import PendingReview from '@/components/PendingReview';

// Personal library of favorite individual components (visual or content)
// starred from Composer or Style Lab, independent of which product they
// originally came from -- so they can be reused across future builds
// instead of re-finding them each time. Aj, 2026-07-19: "build a library
// of what I like to inject into new activities or content."
//
// 2026-07-19, later: "I want to have a parts library for each of these
// things, so that when I begin making them, I can roll out activities
// extremely quickly." Added a dedicated section per Product Builder style
// category (Border, Section Header, Font, Spacing & Alignment, Icon &
// Illustration) at the top, pulled out of the generic Extracted
// Images / Visual & Content Components buckets below so nothing shows up
// twice.
const STYLE_CATEGORY_KEYS = new Set(['border', 'section_header', 'font', 'font_reference', 'spacing_alignment', 'icon_illustration', 'color_palette']);

function readPreset(notes) {
  try { return JSON.parse(notes); } catch { return null; }
}

// One dedicated library for a single style category -- image grid for the
// four visual ones, a text list for Spacing & Alignment (a layout rule has
// no picture to show).
function StyleLibrarySection({ cat, items, busyId, onRemove, genFor, genPrompt, setGenPrompt, genCount, setGenCount, generating, genMsg, onToggleGen, onGenerate }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1c3557', margin: 0 }}>
          {cat.icon} {cat.label} ({items.length})
        </h3>
        <a
          href={cat.key === 'spacing_alignment' ? cat.editorPath : `${cat.editorPath}?${new URLSearchParams({ category: cat.key, title: cat.label }).toString()}`}
          style={{ fontSize: 11, fontWeight: 600, color: '#7a3c8a', textDecoration: 'underline' }}
        >
          + Open {cat.editorLabel} →
        </a>
      </div>
      {items.length === 0 ? (
        <p style={{ fontSize: 12, color: '#999', fontStyle: 'italic', margin: 0 }}>
          Nothing here yet -- use the editor link above to create your first one.
        </p>
      ) : cat.key === 'spacing_alignment' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((p) => {
            const preset = readPreset(p.notes)
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '1px solid #e3ddd0', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#1c3557', margin: 0 }}>{p.title}</p>
                  {preset && (
                    <p style={{ fontSize: 10, color: '#999', margin: '2px 0 0' }}>
                      Margins {preset.marginTop}/{preset.marginRight}/{preset.marginBottom}/{preset.marginLeft}pt · {preset.alignment} · {preset.lineSpacing}× spacing
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                  <a href="/dashboard/spacing-alignment-editor" style={{ fontSize: 11, color: '#2f6b41', textDecoration: 'underline' }}>Edit</a>
                  <button onClick={() => onRemove(p.id)} disabled={busyId === p.id} style={{ fontSize: 11, color: '#a33', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    {busyId === p.id ? '…' : 'Remove'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
          {items.map((p) => (
            <div key={p.id} style={{ background: '#fff', border: '1px solid #e3ddd0', borderRadius: 8, overflow: 'hidden' }}>
              {p.file_url ? (
                <a href={p.file_url} target="_blank" rel="noreferrer">
                  <img src={p.file_url} alt={p.title} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                </a>
              ) : (
                <div style={{ width: '100%', height: 90, background: '#f0ece3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{cat.icon}</div>
              )}
              <div style={{ padding: 6 }}>
                <p style={{ fontSize: 10, color: '#555', margin: 0, lineHeight: 1.3 }} title={p.title}>{p.title}</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => onRemove(p.id)} disabled={busyId === p.id} style={{ fontSize: 9, color: '#a33', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                    {busyId === p.id ? '…' : 'Remove'}
                  </button>
                  {p.file_url && (
                    <>
                      <a
                        href={`/dashboard/asset-modifier?${new URLSearchParams({ assetUrl: p.file_url, title: p.title || 'Asset', sourcePartId: p.id, category: cat.key }).toString()}`}
                        style={{ fontSize: 9, color: '#7a3c8a', textDecoration: 'underline' }}
                      >
                        Edit
                      </a>
                      <button onClick={() => onToggleGen(p.id)} style={{ fontSize: 9, color: '#7a3c8a', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                        ✨ Varieties
                      </button>
                    </>
                  )}
                </div>
                {genFor === p.id && (
                  <div style={{ marginTop: 6, padding: 6, background: '#f5eafa', border: '1px solid #d9b8e8', borderRadius: 6 }}>
                    <input
                      type="text" value={genPrompt} onChange={(e) => setGenPrompt(e.target.value)}
                      placeholder="e.g. different color accents"
                      style={{ width: '100%', fontSize: 10, padding: '4px 6px', border: '1px solid #d9b8e8', borderRadius: 4, boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <input
                        type="number" min={1} max={12} value={genCount}
                        onChange={(e) => setGenCount(Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 6)))}
                        style={{ width: 36, fontSize: 10, padding: '2px 4px', border: '1px solid #d9b8e8', borderRadius: 4 }}
                      />
                      <button
                        onClick={() => onGenerate(p)} disabled={generating || !genPrompt.trim()}
                        style={{ fontSize: 10, fontWeight: 600, color: '#fff', background: '#7a3c8a', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: generating || !genPrompt.trim() ? 'default' : 'pointer', opacity: generating || !genPrompt.trim() ? 0.6 : 1 }}
                      >
                        {generating ? 'Generating…' : 'Generate'}
                      </button>
                    </div>
                    {genMsg && <p style={{ fontSize: 9, color: genMsg.startsWith('Added') ? '#2f6b41' : '#a33', margin: '4px 0 0' }}>{genMsg}</p>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function LibraryPartsPage() {
  const [userId, setUserId] = useState(null);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [genFor, setGenFor] = useState(null); // part id whose "generate matching set" form is open
  const [genPrompt, setGenPrompt] = useState('');
  const [genCount, setGenCount] = useState(6);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState(null);
  const router = useRouter();

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (!user) { router.push('/auth/login'); return; }
        setUserId(user.id);
      })
      .catch(() => router.push('/auth/login'));
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/library-parts?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => setParts(d.parts || []))
      .finally(() => setLoading(false));
  }, [userId]);

  async function remove(id) {
    setBusyId(id);
    try {
      await fetch(`/api/library-parts?userId=${userId}&id=${id}`, { method: 'DELETE' });
      setParts((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  // Uses a saved component/palette/view as a style reference and generates
  // NEW on-style assets via Replicate (e.g. "15 shapes for color-by-number
  // in this exact style"). Needs REPLICATE_API_TOKEN set on the project --
  // surfaces that clearly if it isn't. Aj, 2026-07-19.
  async function generateSet(part) {
    setGenerating(true);
    setGenMsg(null);
    try {
      const res = await fetch('/api/style-lab/generate-matching-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, partId: part.id, prompt: genPrompt, count: genCount }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Generation failed');
      if (d.saved?.length) setParts((prev) => [...d.saved, ...prev]);
      const note = d.failures?.length ? ` (${d.failures.length} failed — click again to retry those)` : '';
      setGenMsg(`Added ${d.savedCount} of ${d.requested}${note}`);
    } catch (e) {
      setGenMsg(e.message);
    } finally {
      setGenerating(false);
    }
  }

  function toggleGen(id) {
    setGenFor((prev) => (prev === id ? null : id));
    setGenMsg(null);
    setGenPrompt('');
  }

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;

  const visualComponents = parts.filter((p) => p.kind === 'component' && !STYLE_CATEGORY_KEYS.has(p.category));
  const contentPdf = parts.filter((p) => p.kind === 'resource'); // Style Lab resources -- both PDF and URL live here
  const extractedImages = parts.filter((p) => p.kind === 'image' && !STYLE_CATEGORY_KEYS.has(p.category));

  function Section({ title, icon, items, emptyHint }) {
    return (
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1c3557', marginBottom: 10 }}>
          {icon} {title} ({items.length})
        </h2>
        {items.length === 0 ? (
          <p style={{ fontSize: 13, color: '#999', fontStyle: 'italic' }}>{emptyHint}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#fff', border: '1px solid #e3ddd0', borderRadius: 8, padding: '10px 14px',
                }}
              >
                <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  {p.file_url && (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=64x64&data=${encodeURIComponent(p.file_url)}`}
                      alt="QR code"
                      width={44}
                      height={44}
                      style={{ border: '1px solid #e3ddd0', borderRadius: 4, flexShrink: 0 }}
                    />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1c3557', margin: 0 }}>{p.title}</p>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                      {p.category && <span style={{ fontSize: 11, color: '#999' }}>{p.category}</span>}
                      {p.products?.title && (
                        <a href={`/dashboard/products/${p.source_product_id}`} style={{ fontSize: 11, color: '#2f6b41' }}>
                          from "{p.products.title}"
                        </a>
                      )}
                      {p.kind === 'resource' && (
                        <a href="/dashboard/style-lab" style={{ fontSize: 11, color: '#2f6b41' }}>
                          View in Style Lab
                        </a>
                      )}
                      {p.file_url && (
                        <a href={p.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#2f6b41' }}>
                          Open file ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => remove(p.id)}
                  disabled={busyId === p.id}
                  style={{ fontSize: 11, color: '#a33', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', opacity: busyId === p.id ? 0.5 : 1 }}
                >
                  {busyId === p.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1c3557', margin: 0 }}>📦 Parts Library</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/dashboard/product-builder" style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#2f6b41', borderRadius: 6, padding: '6px 12px', textDecoration: 'none' }}>
            🧩 Product Builder
          </a>
          <a href="/dashboard/asset-modifier" style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#7a3c8a', borderRadius: 6, padding: '6px 12px', textDecoration: 'none' }}>
            🎨 Asset Modifier
          </a>
          <a href={`/dashboard/asset-modifier?${new URLSearchParams({ tool: 'text', title: 'Lettering' }).toString()}`} style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#1c3557', borderRadius: 6, padding: '6px 12px', textDecoration: 'none' }}>
            🔤 Font Modifier
          </a>
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Your favorite individual pieces, saved from Composer (visual/content components), Style Lab
        (PDF and URL resources), or extracted directly from a PDF's embedded images -- independent of
        which product they came from, so you can find and reuse them when building something new.
        Star anything with the ⭐ button in Composer or Style Lab to add it here, or use "🔬 Extract
        Images" on a product's page to pull out every embedded image automatically. Raw Separator
        crops don't land here directly -- they wait in Needs Review until you've actually edited and
        saved them in the Style Editor.
      </p>

      <PendingReview userId={userId} />

      <div style={{ background: '#faf9f5', border: '1px solid #e3ddd0', borderRadius: 8, padding: 16, marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1c3557', margin: '0 0 12px' }}>
          🧩 Product Builder Libraries
        </h2>
        {STYLE_CATEGORIES.map((cat) => {
          const keys = cat.key === 'font' ? ['font', 'font_reference'] : [cat.key]
          const items = parts.filter((p) => keys.includes(p.category))
          return (
            <StyleLibrarySection
              key={cat.key} cat={cat} items={items} busyId={busyId} onRemove={remove}
              genFor={genFor} genPrompt={genPrompt} setGenPrompt={setGenPrompt}
              genCount={genCount} setGenCount={setGenCount} generating={generating} genMsg={genMsg}
              onToggleGen={toggleGen} onGenerate={generateSet}
            />
          )
        })}
      </div>

      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1c3557', marginBottom: 10 }}>
          🖼️ Extracted Images ({extractedImages.length})
        </h2>
        {extractedImages.length === 0 ? (
          <p style={{ fontSize: 13, color: '#999', fontStyle: 'italic' }}>
            Nothing extracted yet -- go to a product's page and use "🔬 Extract Images" to pull out its embedded images.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
            {extractedImages.map((p) => (
              <div key={p.id} style={{ background: '#fff', border: '1px solid #e3ddd0', borderRadius: 8, overflow: 'hidden' }}>
                <a href={p.file_url} target="_blank" rel="noreferrer">
                  <img src={p.file_url} alt={p.title} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
                </a>
                <div style={{ padding: 6 }}>
                  <p style={{ fontSize: 10, color: '#555', margin: 0, lineHeight: 1.3 }} title={p.title}>
                    {p.title.replace(/^.*-- /, '')}
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => remove(p.id)}
                      disabled={busyId === p.id}
                      style={{ fontSize: 9, color: '#a33', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      {busyId === p.id ? '…' : 'Remove'}
                    </button>
                    <button
                      onClick={() => { setGenFor(genFor === p.id ? null : p.id); setGenMsg(null); setGenPrompt(''); }}
                      style={{ fontSize: 9, color: '#7a3c8a', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      ✨ Generate matching set
                    </button>
                    <a
                      href={`/dashboard/asset-modifier?${new URLSearchParams({ assetUrl: p.file_url || '', title: p.title || 'Asset', sourcePartId: p.id }).toString()}`}
                      style={{ fontSize: 9, color: '#2f6b41', textDecoration: 'underline' }}
                    >
                      🎨 Push to Asset Modifier
                    </a>
                  </div>
                  {genFor === p.id && (
                    <div style={{ marginTop: 6, padding: 6, background: '#f5eafa', border: '1px solid #d9b8e8', borderRadius: 6 }}>
                      <input
                        type="text"
                        value={genPrompt}
                        onChange={(e) => setGenPrompt(e.target.value)}
                        placeholder='e.g. "a simple leaf outline for color-by-number, thick black lines"'
                        style={{ width: '100%', fontSize: 10, padding: '4px 6px', border: '1px solid #d9b8e8', borderRadius: 4, boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <label style={{ fontSize: 9, color: '#555' }}>
                          Count:{' '}
                          <input
                            type="number" min={1} max={12} value={genCount}
                            onChange={(e) => setGenCount(Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 6)))}
                            style={{ width: 36, fontSize: 10, padding: '2px 4px', border: '1px solid #d9b8e8', borderRadius: 4 }}
                          />
                        </label>
                        <button
                          onClick={() => generateSet(p)}
                          disabled={generating || !genPrompt.trim()}
                          style={{ fontSize: 10, fontWeight: 600, color: '#fff', background: '#7a3c8a', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: generating || !genPrompt.trim() ? 'default' : 'pointer', opacity: generating || !genPrompt.trim() ? 0.6 : 1 }}
                        >
                          {generating ? 'Generating…' : 'Generate'}
                        </button>
                      </div>
                      {genMsg && <p style={{ fontSize: 9, color: genMsg.startsWith('Added') ? '#2f6b41' : '#a33', margin: '4px 0 0' }}>{genMsg}</p>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Section
        title="Visual & Content Components"
        icon="🧩"
        items={visualComponents}
        emptyHint="Nothing starred yet -- star a tagged component in Composer to save it here."
      />
      <Section
        title="Content Library (PDF & URL)"
        icon="📚"
        items={contentPdf}
        emptyHint="Nothing starred yet -- star a resource in Style Lab to save it here."
      />
    </div>
  );
}
