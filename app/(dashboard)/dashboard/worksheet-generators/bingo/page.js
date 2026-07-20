'use client'
import { useState, useEffect } from 'react'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import SaveAsProductBar from '@/components/SaveAsProductBar'

export default function BingoPage() {
  const [userId, setUserId] = useState(null)
  const [words, setWords] = useState('')
  const [boardCount, setBoardCount] = useState(10)
  const [freeSpace, setFreeSpace] = useState(true)
  const [title, setTitle] = useState('')
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState(null)
  const [fileUrl, setFileUrl] = useState(null)

  useEffect(() => { getCurrentUser().then((u) => u && setUserId(u.id)) }, [])

  async function generate() {
    setGenerating(true); setMsg(null); setFileUrl(null)
    try {
      const res = await fetch('/api/worksheet-generators/bingo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, words, boardCount, freeSpace, title: title || 'Bingo' }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Generation failed') }
      const fileUrlHeader = res.headers.get('X-File-Url')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'bingo.pdf'; a.click()
      window.URL.revokeObjectURL(url)
      if (fileUrlHeader) setFileUrl(decodeURIComponent(fileUrlHeader))
      setMsg('✓ Generated and downloaded')
    } catch (e) {
      setMsg(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const wordCount = words.split('\n').map((w) => w.trim()).filter(Boolean).length
  const needed = freeSpace ? 24 : 25

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 700, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>🎱 Bingo</h1>
        <a href="/dashboard/worksheet-generators" style={{ fontSize: 12, color: '#888' }}>← All Generators</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        One word/fact per line -- needs at least {needed}. Each board gets its own random arrangement, plus a page of calling cards to cut apart and draw from.
      </p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
        <textarea
          value={words} onChange={(e) => setWords(e.target.value)} rows={10}
          placeholder={'photosynthesis\nmitochondria\ncell wall\n...'}
          style={{ width: '100%', fontSize: 13, padding: 10, border: `1px solid ${C.border}`, borderRadius: 6, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
        />
        <p style={{ fontSize: 11, color: wordCount >= needed ? '#2f6b41' : '#a33', margin: '4px 0 0' }}>{wordCount} of {needed}+ needed</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (for saving)" style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, minWidth: 180 }} />
          <label style={{ fontSize: 12, color: '#555' }}>Boards:</label>
          <input type="number" min={1} max={40} value={boardCount} onChange={(e) => setBoardCount(Math.max(1, Math.min(40, Number(e.target.value))))} style={{ width: 60, fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }} />
          <label style={{ fontSize: 12, color: '#555', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={freeSpace} onChange={(e) => setFreeSpace(e.target.checked)} /> Free center
          </label>
          <button
            onClick={generate} disabled={generating || !userId || wordCount < needed}
            style={{ padding: '9px 18px', background: '#7a3c8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: generating || wordCount < needed ? 0.6 : 1 }}
          >
            {generating ? 'Generating…' : '📄 Generate Bingo Set'}
          </button>
        </div>
        {msg && <p style={{ fontSize: 12, color: msg.startsWith('✓') ? '#2f6b41' : '#a33', marginTop: 8 }}>{msg}</p>}
        <SaveAsProductBar userId={userId} fileUrl={fileUrl} defaultTitle={title || 'Bingo'} />
      </div>
    </div>
  )
}
