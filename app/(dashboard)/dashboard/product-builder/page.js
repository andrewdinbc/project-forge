'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import { getProduct } from '@/lib/products'
import { STYLE_CATEGORIES, emptySelections } from '@/lib/product-builder-categories'

// Product Builder (Aj, 2026-07-19): "It will include components called
// title, instructions, learning contentS. I want it to be able to find
// border, section headers, font, spacing and alignment, icon and
// illustrations from my parts library." Title/Instructions/Learning
// Content(s) are the product's actual content, entered here directly.
// Border/Section Header/Font/Spacing & Alignment/Icon & Illustration are
// style assets pulled from Parts Library via the picker below -- each has
// its own "editor" (Style Editor for the 4 image ones, a new dedicated
// Spacing & Alignment Editor for the layout-rule one), linked inline.
let nextLocalId = 1

function ProductBuilderInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const incomingProductId = searchParams.get('productId')

  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [productId, setProductId] = useState(incomingProductId)
  const [title, setTitle] = useState('')
  const [instructionsText, setInstructionsText] = useState('')
  const [learningContents, setLearningContents] = useState([{ id: `local-${nextLocalId++}`, label: 'Learning Content 1', content: '' }])
  const [styleSelections, setStyleSelections] = useState(emptySelections())
  const [libraryParts, setLibraryParts] = useState([])
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState(null)
  const [generatedUrl, setGeneratedUrl] = useState(null)

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)
      const tasks = [fetch(`/api/library-parts?userId=${user.id}`).then((r) => r.json())]
      if (incomingProductId) tasks.push(getProduct(incomingProductId, user.id).catch(() => null))
      Promise.all(tasks).then(([partsRes, productRes]) => {
        setLibraryParts(partsRes.parts || [])
        if (productRes && !productRes.error) {
          setTitle(productRes.title || '')
          setInstructionsText(productRes.instructions_text || '')
          setLearningContents(
            Array.isArray(productRes.learning_contents) && productRes.learning_contents.length
              ? productRes.learning_contents
              : [{ id: `local-${nextLocalId++}`, label: 'Learning Content 1', content: '' }]
          )
          setStyleSelections({ ...emptySelections(), ...(productRes.style_selections || {}) })
        }
      }).finally(() => setLoading(false))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function partsFor(categoryKey) {
    const keys = categoryKey === 'font' ? ['font', 'font_reference'] : [categoryKey]
    return libraryParts.filter((p) => keys.includes(p.category))
  }

  function addLearningContent() {
    setLearningContents((prev) => [...prev, { id: `local-${nextLocalId++}`, label: `Learning Content ${prev.length + 1}`, content: '' }])
  }
  function removeLearningContent(id) {
    setLearningContents((prev) => prev.filter((c) => c.id !== id))
  }
  function updateLearningContent(id, field, value) {
    setLearningContents((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)))
  }

  function selectSingle(categoryKey, partId) {
    setStyleSelections((prev) => ({ ...prev, [categoryKey]: prev[categoryKey] === partId ? null : partId }))
  }
  function toggleIcon(partId) {
    setStyleSelections((prev) => {
      const cur = new Set(prev.icon_illustration || [])
      cur.has(partId) ? cur.delete(partId) : cur.add(partId)
      return { ...prev, icon_illustration: Array.from(cur) }
    })
  }

  async function saveDraft() {
    if (!title.trim()) { setMsg('Give the product a title first.'); return null }
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/product-builder/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, productId, title, instructionsText, learningContents, styleSelections }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Save failed')
      setProductId(d.product.id)
      setMsg('Draft saved ✓')
      return d.product.id
    } catch (e) {
      setMsg(e.message)
      return null
    } finally {
      setSaving(false)
    }
  }

  async function generateProduct() {
    setGenerating(true); setMsg(null); setGeneratedUrl(null)
    try {
      const id = productId || (await saveDraft())
      if (!id) return
      const res = await fetch('/api/product-builder/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, productId: id }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Generation failed')
      }
      const fileUrlHeader = res.headers.get('X-File-Url')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${title.replace(/\s+/g, '-')}.pdf`; a.click()
      window.URL.revokeObjectURL(url)
      if (fileUrlHeader) setGeneratedUrl(decodeURIComponent(fileUrlHeader))
      setMsg('Generated ✓ -- downloaded, and saved to this product.')
    } catch (e) {
      setMsg(e.message)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <div style={{ padding: 40, fontFamily: FONT_BODY }}>Loading…</div>

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 1000, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>🧩 Product Builder</h1>
        <a href="/dashboard/library-parts" style={{ fontSize: 12, color: '#888' }}>Parts Library →</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Title, Instructions, and Learning Content(s) are the product's actual content -- write them below. Border,
        Section Header, Font, Spacing &amp; Alignment, and Icon &amp; Illustration are style, pulled from your Parts
        Library -- each has its own editor, linked next to its picker.
      </p>

      {/* ---- Content components ---- */}
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 4 }}>📄 Title</div>
        <input
          value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder='e.g. "Life Cycle of Stars Petal Activity"'
          style={{ width: '100%', fontSize: 14, padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 6, boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 4 }}>📋 Instructions</div>
        <textarea
          value={instructionsText} onChange={(e) => setInstructionsText(e.target.value)}
          rows={4} placeholder="How a teacher preps and runs this..."
          style={{ width: '100%', fontSize: 13, padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 6, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
        />
      </div>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>📚 Learning Content(s)</div>
          <button onClick={addLearningContent} style={{ fontSize: 11, fontWeight: 600, color: '#2f6b41', background: '#eef6f0', border: '1px solid #b8dcc2', borderRadius: 5, padding: '4px 10px', cursor: 'pointer' }}>
            + Add another
          </button>
        </div>
        {learningContents.map((lc, i) => (
          <div key={lc.id} style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input
                value={lc.label} onChange={(e) => updateLearningContent(lc.id, 'label', e.target.value)}
                placeholder={`Learning Content ${i + 1} title`}
                style={{ flex: 1, fontSize: 12, fontWeight: 600, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }}
              />
              {learningContents.length > 1 && (
                <button onClick={() => removeLearningContent(lc.id)} style={{ fontSize: 11, color: '#a33', background: '#fff', border: '1px solid #eecccc', borderRadius: 5, padding: '4px 10px', cursor: 'pointer' }}>
                  Remove
                </button>
              )}
            </div>
            <textarea
              value={lc.content} onChange={(e) => updateLearningContent(lc.id, 'content', e.target.value)}
              rows={3} placeholder="The actual learning content students see..."
              style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>
        ))}
      </div>

      {/* ---- Style pickers ---- */}
      <div style={{ background: '#faf9f5', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>🎨 Style, from your Parts Library</div>
        {STYLE_CATEGORIES.map((cat) => {
          const items = partsFor(cat.key)
          const selected = cat.multi ? (styleSelections.icon_illustration || []) : styleSelections[cat.key]
          return (
            <div key={cat.key} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#333' }}>{cat.icon} {cat.label}</div>
                <a href={cat.key === 'spacing_alignment' ? cat.editorPath : `${cat.editorPath}?category=${cat.key}&title=${encodeURIComponent(cat.label)}`}
                   style={{ fontSize: 11, color: '#7a3c8a', textDecoration: 'underline' }}>
                  Open {cat.editorLabel} →
                </a>
              </div>
              {items.length === 0 ? (
                <p style={{ fontSize: 11, color: '#999', fontStyle: 'italic', margin: 0 }}>
                  Nothing tagged {cat.label} yet -- use the editor link above to create one.
                </p>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {items.map((p) => {
                    const isSelected = cat.multi ? selected.includes(p.id) : selected === p.id
                    return (
                      <button
                        key={p.id}
                        onClick={() => (cat.multi ? toggleIcon(p.id) : selectSingle(cat.key, p.id))}
                        title={p.title}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                          width: 74, padding: 4, borderRadius: 6, cursor: 'pointer',
                          border: `2px solid ${isSelected ? '#7a3c8a' : 'transparent'}`,
                          background: isSelected ? '#f5eafa' : '#fff',
                        }}
                      >
                        {p.file_url ? (
                          <img src={p.file_url} alt={p.title} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4, border: `1px solid ${C.border}` }} />
                        ) : (
                          <div style={{ width: 60, height: 60, borderRadius: 4, border: `1px solid ${C.border}`, background: '#f0ece3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                            {cat.icon}
                          </div>
                        )}
                        <span style={{ fontSize: 9, color: '#555', textAlign: 'center', lineHeight: 1.2, maxHeight: 22, overflow: 'hidden' }}>{p.title}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ---- Actions ---- */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={saveDraft} disabled={saving}
          style={{ padding: '9px 18px', background: '#fff', border: `1px solid ${C.border}`, color: '#555', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {saving ? 'Saving…' : '💾 Save Draft'}
        </button>
        <button
          onClick={generateProduct} disabled={generating}
          style={{ padding: '9px 18px', background: '#7a3c8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: generating ? 0.6 : 1 }}
        >
          {generating ? 'Generating…' : '📄 Generate Product PDF'}
        </button>
        {msg && <span style={{ fontSize: 12, color: msg.includes('✓') ? '#2f6b41' : '#a33' }}>{msg}</span>}
      </div>
      {generatedUrl && (
        <p style={{ fontSize: 12, marginTop: 8 }}>
          <a href={generatedUrl} target="_blank" rel="noreferrer" style={{ color: '#7a3c8a' }}>View the generated PDF ↗</a>
        </p>
      )}
      <p style={{ fontSize: 10, color: '#aaa', marginTop: 16, lineHeight: 1.5 }}>
        Font is applied as a reference note only, not embedded -- same reasoning as Style Lab's font names (a font's
        actual glyph program is separately-licensed software). "Justify" alignment currently renders as left-aligned;
        true full-justify isn't implemented yet.
      </p>
    </div>
  )
}

export default function ProductBuilderPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, fontFamily: FONT_BODY }}>Loading…</div>}>
      <ProductBuilderInner />
    </Suspense>
  )
}
