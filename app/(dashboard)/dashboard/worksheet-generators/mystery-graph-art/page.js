'use client'
import { useState, useEffect } from 'react'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import { getUserBundles } from '@/lib/bundles'
import SaveAsProductBar from '@/components/SaveAsProductBar'

const SHAPES = [
  { key: '', label: 'Surprise me (random)' },
  { key: 'house', label: 'House' },
  { key: 'sailboat', label: 'Sailboat' },
  { key: 'arrow', label: 'Arrow' },
  { key: 'heart', label: 'Heart' },
  { key: 'star', label: 'Star' },
  { key: 'tree', label: 'Tree' },
  { key: 'fish', label: 'Fish' },
  { key: 'kite', label: 'Kite' },
]

export default function MysteryGraphArtPage() {
  const [userId, setUserId] = useState(null)
  const [shape, setShape] = useState('')
  const [mode, setMode] = useState('all4')
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

  async function generate() {
    setGenerating(true); setMsg(null); setFileUrl(null)
    try {
      const res = await fetch('/api/worksheet-generators/mystery-graph-art', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, shape: shape || undefined, mode, title: title || 'Mystery Graph Picture', bundleId: bundleId || undefined }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Generation failed') }
      const fileUrlHeader = res.headers.get('X-File-Url')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'mystery-graph-art.pdf'; a.click()
      window.URL.revokeObjectURL(url)
      if (fileUrlHeader) setFileUrl(decodeURIComponent(fileUrlHeader))
      setMsg('✓ Generated and downloaded')
    } catch (e) {
      setMsg(e.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 700, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>📈 Mystery Graph Art</h1>
        <a href="/dashboard/worksheet-generators" style={{ fontSize: 12, color: '#888' }}>← All Generators</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Plot ordered pairs on a real coordinate grid, connecting them in sequence, to reveal a picture.
        8 hand-drawn shapes. "All 4 quadrants" practices negative coordinates; "Quadrant 1 only" keeps
        everything positive for younger grades. Answer key included.
      </p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: '#555' }}>Picture:</label>
          <select value={shape} onChange={(e) => setShape(e.target.value)} style={{ fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }}>
            {SHAPES.map((s) => (<option key={s.key} value={s.key}>{s.label}</option>))}
          </select>
          <label style={{ fontSize: 12, color: '#555' }}>Grid:</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }}>
            <option value="all4">All 4 quadrants (-10 to 10)</option>
            <option value="quadrant1">Quadrant 1 only (0 to 20, younger grades)</option>
          </select>
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
            {generating ? 'Generating…' : '📄 Generate Mystery Graph'}
          </button>
        </div>
        {msg && <p style={{ fontSize: 12, color: msg.startsWith('✓') ? '#2f6b41' : '#a33', marginTop: 8 }}>{msg}</p>}
        <SaveAsProductBar userId={userId} fileUrl={fileUrl} defaultTitle={title || 'Mystery Graph Picture'} />
      </div>
    </div>
  )
}
