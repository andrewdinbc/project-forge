'use client'
import { useState, useEffect } from 'react'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import { getUserBundles } from '@/lib/bundles'
import SaveAsProductBar from '@/components/SaveAsProductBar'

const TOPICS = [
  { key: 'general', label: 'General fun facts' },
  { key: 'animals', label: 'Animals' },
  { key: 'space', label: 'Space' },
]

export default function CipherWheelsPage() {
  const [userId, setUserId] = useState(null)
  const [shift, setShift] = useState('')
  const [topic, setTopic] = useState('general')
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
      const res = await fetch('/api/worksheet-generators/cipher-wheels', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, shift: shift || undefined, topic, title: title || undefined, bundleId: bundleId || undefined }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Generation failed') }
      const fileUrlHeader = res.headers.get('X-File-Url')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'cipher-wheel.pdf'; a.click()
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
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>🎡 Cipher Wheels</h1>
        <a href="/dashboard/worksheet-generators" style={{ fontSize: 12, color: '#888' }}>← All Generators</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        A real cut-out-and-assemble rotating cipher disk (poke a brad through the center so the inner
        wheel spins), plus secret facts encoded with the same shift to decode. Answer key included.
      </p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: '#555' }}>Shift amount:</label>
          <input
            type="number" min={1} max={25} value={shift} onChange={(e) => setShift(e.target.value)}
            placeholder="random"
            style={{ fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5, width: 80 }}
          />
          <label style={{ fontSize: 12, color: '#555' }}>Topic:</label>
          <select value={topic} onChange={(e) => setTopic(e.target.value)} style={{ fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }}>
            {TOPICS.map((t) => (<option key={t.key} value={t.key}>{t.label}</option>))}
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
            {generating ? 'Generating…' : '📄 Generate Cipher Wheel'}
          </button>
        </div>
        {msg && <p style={{ fontSize: 12, color: msg.startsWith('✓') ? '#2f6b41' : '#a33', marginTop: 8 }}>{msg}</p>}
        <SaveAsProductBar userId={userId} fileUrl={fileUrl} defaultTitle={title || 'Cipher Wheel'} />
      </div>
    </div>
  )
}
