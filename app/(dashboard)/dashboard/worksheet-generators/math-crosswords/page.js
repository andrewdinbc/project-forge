'use client'
import { useState, useEffect } from 'react'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import { getUserBundles } from '@/lib/bundles'
import SaveAsProductBar from '@/components/SaveAsProductBar'

const OPS = [
  { key: '+', label: '+ Addition' },
  { key: '-', label: '\u2212 Subtraction' },
  { key: 'x', label: '\u00d7 Multiplication' },
]

export default function MathCrosswordsPage() {
  const [userId, setUserId] = useState(null)
  const [count, setCount] = useState(10)
  const [digits, setDigits] = useState(2)
  const [operations, setOperations] = useState(['+', '-'])
  const [title, setTitle] = useState('')
  const [bundles, setBundles] = useState([])
  const [bundleId, setBundleId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState(null)
  const [fileUrl, setFileUrl] = useState(null)

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (!u) return
      setUserId(u.id)
      getUserBundles(u.id).then((b) => setBundles(b || [])).catch(() => {})
    })
  }, [])

  function toggleOp(key) {
    setOperations((prev) => (prev.includes(key) ? prev.filter((o) => o !== key) : [...prev, key]))
  }

  async function generate() {
    if (!operations.length) { setMsg('Choose at least one operation.'); return }
    setGenerating(true); setMsg(null); setFileUrl(null)
    try {
      const res = await fetch('/api/worksheet-generators/math-crosswords', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, count, digits, operations, title: title || undefined, bundleId: bundleId || undefined }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Generation failed') }
      const fileUrlHeader = res.headers.get('X-File-Url')
      const placedCount = Number(res.headers.get('X-Placed-Count') || 0)
      const requestedCount = Number(res.headers.get('X-Requested-Count') || 0)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'math-crossword.pdf'; a.click()
      window.URL.revokeObjectURL(url)
      if (fileUrlHeader) setFileUrl(decodeURIComponent(fileUrlHeader))
      setMsg(placedCount < requestedCount
        ? `✓ Generated with ${placedCount} problems (couldn't fit all ${requestedCount} requested -- try a different digit length for more)`
        : `✓ Generated and downloaded -- ${placedCount} problems`)
    } catch (e) {
      setMsg(e.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 700, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>🔢 Math Crossword</h1>
        <a href="/dashboard/worksheet-generators" style={{ fontSize: 12, color: '#888' }}>← All Generators</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Solve math problems, then write each answer's digits into a real interlocking crossword grid
        -- the same genuine placement engine as the word Crossword Puzzle, just digits instead of
        letters. Answer key included.
      </p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: '#555' }}>Problems:</label>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }}>
            {[6, 8, 10, 12, 16, 20].map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
          <label style={{ fontSize: 12, color: '#555' }}>Answer digits:</label>
          <select value={digits} onChange={(e) => setDigits(Number(e.target.value))} style={{ fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }}>
            <option value={2}>2 digits</option>
            <option value={3}>3 digits</option>
            <option value={4}>4 digits</option>
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Operations:</label>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {OPS.map((o) => (
              <label key={o.key} style={{ fontSize: 12, color: '#333', display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={operations.includes(o.key)} onChange={() => toggleOp(o.key)} />
                {o.label}
              </label>
            ))}
          </div>
        </div>

        {bundles.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#555' }}>Apply a bundle's border theme (optional): </label>
            <select value={bundleId} onChange={(e) => setBundleId(e.target.value)} style={{ fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }}>
              <option value="">No theme (plain)</option>
              {bundles.map((b) => (<option key={b.id} value={b.id}>{b.title}</option>))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (for saving)" style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, minWidth: 180 }} />
          <button
            onClick={generate} disabled={generating || !userId}
            style={{ padding: '9px 18px', background: '#7a3c8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: generating ? 0.6 : 1 }}
          >
            {generating ? 'Generating…' : '📄 Generate Math Crossword'}
          </button>
        </div>
        {msg && <p style={{ fontSize: 12, color: msg.startsWith('✓') ? '#2f6b41' : '#a33', marginTop: 8 }}>{msg}</p>}
        <SaveAsProductBar userId={userId} fileUrl={fileUrl} defaultTitle={title || 'Math Crossword'} />
      </div>
    </div>
  )
}
