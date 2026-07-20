'use client'
import { useState, useEffect } from 'react'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import SaveAsProductBar from '@/components/SaveAsProductBar'

export default function PuzzleMatchPage() {
  const [userId, setUserId] = useState(null)
  const [operation, setOperation] = useState('multiplication')
  const [count, setCount] = useState(16)
  const [title, setTitle] = useState('')
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState(null)
  const [fileUrl, setFileUrl] = useState(null)

  useEffect(() => { getCurrentUser().then((u) => u && setUserId(u.id)) }, [])

  async function generate() {
    setGenerating(true); setMsg(null); setFileUrl(null)
    try {
      const res = await fetch('/api/worksheet-generators/puzzle-match', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, operation, count, title: title || 'Puzzle Match' }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Generation failed') }
      const fileUrlHeader = res.headers.get('X-File-Url')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'puzzle-match.pdf'; a.click()
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
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>🧩 Puzzle Match Math Game</h1>
        <a href="/dashboard/worksheet-generators" style={{ fontSize: 12, color: '#888' }}>← All Generators</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        A page of problem cards and a page of shuffled answer cards -- cut both apart and match them up. Great for learning centers.
      </p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: '#555' }}>Operation:</label>
          <select value={operation} onChange={(e) => setOperation(e.target.value)} style={{ fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }}>
            <option value="addition">Addition</option>
            <option value="subtraction">Subtraction</option>
            <option value="multiplication">Multiplication</option>
            <option value="division">Division</option>
          </select>
          <label style={{ fontSize: 12, color: '#555' }}>How many pairs:</label>
          <input type="number" min={6} max={24} value={count} onChange={(e) => setCount(Math.max(6, Math.min(24, Number(e.target.value))))} style={{ width: 60, fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }} />
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (for saving)" style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, minWidth: 180 }} />
          <button
            onClick={generate} disabled={generating || !userId}
            style={{ padding: '9px 18px', background: '#7a3c8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: generating ? 0.6 : 1 }}
          >
            {generating ? 'Generating…' : '📄 Generate Cards'}
          </button>
        </div>
        {msg && <p style={{ fontSize: 12, color: msg.startsWith('✓') ? '#2f6b41' : '#a33', marginTop: 8 }}>{msg}</p>}
        <SaveAsProductBar userId={userId} fileUrl={fileUrl} defaultTitle={title || 'Puzzle Match'} />
      </div>
    </div>
  )
}
