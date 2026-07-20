'use client'
import { useState, useEffect } from 'react'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import SaveAsProductBar from '@/components/SaveAsProductBar'

export default function AdditionSquaresPage() {
  const [userId, setUserId] = useState(null)
  const [size, setSize] = useState(3)
  const [maxVal, setMaxVal] = useState(9)
  const [count, setCount] = useState(4)
  const [title, setTitle] = useState('')
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState(null)
  const [fileUrl, setFileUrl] = useState(null)

  useEffect(() => { getCurrentUser().then((u) => u && setUserId(u.id)) }, [])

  async function generate() {
    setGenerating(true); setMsg(null); setFileUrl(null)
    try {
      const res = await fetch('/api/worksheet-generators/addition-squares', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, size, maxVal, count, title: title || 'Addition Squares' }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Generation failed') }
      const fileUrlHeader = res.headers.get('X-File-Url')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'addition-squares.pdf'; a.click()
      window.URL.revokeObjectURL(url)
      if (fileUrlHeader) setFileUrl(decodeURIComponent(fileUrlHeader))
      setMsg('✓ Generated and downloaded')
    } catch (e) {
      setMsg(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const inputStyle = { fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5, width: 70 }
  const rowStyle = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12, color: '#333' }

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 700, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>🔢 Addition Squares</h1>
        <a href="/dashboard/worksheet-generators" style={{ fontSize: 12, color: '#888' }}>← All Generators</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Logic puzzles -- fill in the missing number in each row using the row and column sums as clues.
      </p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={rowStyle}>
          <label>Grid size:</label>
          <select value={size} onChange={(e) => setSize(Number(e.target.value))} style={{ ...inputStyle, width: 90 }}>
            {[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} x {n}</option>)}
          </select>
        </div>
        <div style={rowStyle}>
          <label>Max number value:</label>
          <input type="number" min={5} max={20} value={maxVal} onChange={(e) => setMaxVal(Math.max(5, Math.min(20, Number(e.target.value))))} style={inputStyle} />
        </div>
        <div style={rowStyle}>
          <label>How many puzzles:</label>
          <input type="number" min={1} max={6} value={count} onChange={(e) => setCount(Math.max(1, Math.min(6, Number(e.target.value))))} style={inputStyle} />
        </div>
        <div style={rowStyle}>
          <label>Title:</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Addition Squares" style={{ ...inputStyle, width: 200 }} />
        </div>
        <button
          onClick={generate} disabled={generating || !userId}
          style={{ marginTop: 6, padding: '9px 18px', background: '#7a3c8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: generating ? 0.6 : 1 }}
        >
          {generating ? 'Generating…' : '📄 Generate Puzzles'}
        </button>
        {msg && <p style={{ fontSize: 12, color: msg.startsWith('✓') ? '#2f6b41' : '#a33', marginTop: 8 }}>{msg}</p>}
        <SaveAsProductBar userId={userId} fileUrl={fileUrl} defaultTitle={title || 'Addition Squares'} />
      </div>
    </div>
  )
}
