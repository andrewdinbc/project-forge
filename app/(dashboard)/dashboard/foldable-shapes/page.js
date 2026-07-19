'use client'
import { useState, useEffect } from 'react'
import { COLORS as C } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'

// Foldable Shape Library (Aj, 2026-07-19): "create a foldable shape library
// in forge... you will find that a lot of them are repeatable." A small
// catalog of precise, parametric shapes (real cut/fold vector geometry via
// pdf-lib, not AI image generation -- see lib/foldable-shapes.ts) rather
// than one-off AI-drawn templates. Reachable standalone, and from Schema
// Lab's "Render as Foldable" button (which prefills labels/content from a
// generated schema's components via sessionStorage).
const SHAPES = [
  { key: 'flap-book', name: 'Flap Book', description: 'N flaps cut from the top edge down to a fold line, each lifts independently to reveal content underneath. The most common INB foldable.', min: 2, max: 6, default: 4 },
  { key: 'layered-book', name: 'Layered Book', description: 'N separate cut-out strips of decreasing height, stacked and glued/stapled along the top edge so each label peeks out below the one in front.', min: 2, max: 6, default: 3 },
]

export default function FoldableShapesPage() {
  const [userId, setUserId] = useState(null)
  const [shapeKey, setShapeKey] = useState('flap-book')
  const [title, setTitle] = useState('')
  const [items, setItems] = useState([{ label: '', content: '' }, { label: '', content: '' }, { label: '', content: '' }, { label: '', content: '' }])
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const shape = SHAPES.find((s) => s.key === shapeKey) || SHAPES[0]

  useEffect(() => {
    getCurrentUser().then((user) => { if (user) setUserId(user.id) })
    try {
      const raw = sessionStorage.getItem('foldableShapePrefill')
      if (raw) {
        const prefill = JSON.parse(raw)
        if (prefill.title) setTitle(prefill.title)
        if (Array.isArray(prefill.items) && prefill.items.length > 0) setItems(prefill.items)
        if (prefill.shapeKey) setShapeKey(prefill.shapeKey)
        sessionStorage.removeItem('foldableShapePrefill')
      }
    } catch {}
  }, [])

  function setCount(n) {
    setItems((prev) => {
      const next = [...prev]
      while (next.length < n) next.push({ label: '', content: '' })
      return next.slice(0, n)
    })
  }

  function updateItem(i, field, value) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)))
  }

  async function generate() {
    const filled = items.filter((it) => it.label.trim())
    if (filled.length < shape.min) return
    setGenerating(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/foldable-shapes/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId, shapeType: shapeKey, title: title.trim() || undefined,
          labels: filled.map((it) => it.label.trim()),
          contents: filled.map((it) => it.content.trim()),
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Generation failed')
      setResult(d)
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  function downloadPdf() {
    if (!result?.pdfDataUrl) return
    const a = document.createElement('a')
    a.href = result.pdfDataUrl
    a.download = `${(title || shape.name).replace(/\s+/g, '-')}.pdf`
    a.click()
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.navy, marginBottom: 4 }}>🗂 Foldable Shape Library</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Precise, real cut/fold geometry for common interactive-notebook shapes -- solid lines are cut lines,
        dashed lines are fold lines. Pick a shape, fill in each section's label and (optionally) the content
        that goes underneath, generate, and it saves straight to Parts Library.
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {SHAPES.map((s) => (
          <button
            key={s.key}
            onClick={() => { setShapeKey(s.key); setCount(s.default) }}
            style={{
              flex: '1 1 220px', textAlign: 'left', padding: 12, borderRadius: 8, cursor: 'pointer',
              border: `2px solid ${shapeKey === s.key ? C.gold : C.border}`,
              background: shapeKey === s.key ? '#fdf6ea' : '#fff',
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 700, color: C.navy, margin: 0 }}>{s.name}</p>
            <p style={{ fontSize: 11, color: '#666', margin: '4px 0 0' }}>{s.description}</p>
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <input
          type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          style={{ width: '100%', fontSize: 13, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 10, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: '#555' }}>Sections:</span>
          <input
            type="number" min={shape.min} max={shape.max} value={items.length}
            onChange={(e) => setCount(Math.max(shape.min, Math.min(shape.max, parseInt(e.target.value, 10) || shape.min)))}
            style={{ width: 50, fontSize: 12, padding: '4px 6px', border: `1px solid ${C.border}`, borderRadius: 4 }}
          />
          <span style={{ fontSize: 11, color: '#999' }}>({shape.min}–{shape.max})</span>
        </div>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input
              type="text" value={it.label} onChange={(e) => updateItem(i, 'label', e.target.value)}
              placeholder={`Section ${i + 1} label`}
              style={{ flex: '0 0 160px', fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 4 }}
            />
            <input
              type="text" value={it.content} onChange={(e) => updateItem(i, 'content', e.target.value)}
              placeholder="Content underneath (optional)"
              style={{ flex: 1, fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 4 }}
            />
          </div>
        ))}
        <button
          onClick={generate}
          disabled={generating || items.filter((it) => it.label.trim()).length < shape.min}
          style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: C.gold, border: 'none', borderRadius: 6, padding: '7px 16px', cursor: 'pointer', opacity: generating ? 0.6 : 1 }}
        >
          {generating ? 'Generating…' : '🗂 Generate Foldable'}
        </button>
        {error && <p style={{ fontSize: 12, color: C.red, marginTop: 8 }}>{error}</p>}
      </div>

      {result && (
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 8 }}>
            ✓ {result.shapeName} generated ({result.count} sections) — saved to Parts Library
          </p>
          {result.part?.file_url && (
            <img src={result.part.file_url} alt="Generated foldable" style={{ maxWidth: '100%', border: `1px solid ${C.border}`, borderRadius: 6 }} />
          )}
          <div style={{ marginTop: 8 }}>
            <button onClick={downloadPdf} style={{ fontSize: 12, color: C.navy, background: 'none', border: `1px solid ${C.navy}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>
              ⬇ Download vector PDF (for printing)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
