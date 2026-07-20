'use client'
import { useState, useEffect } from 'react'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import SaveAsProductBar from '@/components/SaveAsProductBar'

export default function FlashcardsPage() {
  const [userId, setUserId] = useState(null)
  const [words, setWords] = useState('')
  const [color, setColor] = useState('navy')
  const [title, setTitle] = useState('')
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState(null)
  const [fileUrl, setFileUrl] = useState(null)

  useEffect(() => {
    getCurrentUser().then((u) => u && setUserId(u.id))
    // Handoff from Spelling List Generator (or any future word-list source)
    // -- same sessionStorage prefill pattern as Schema Lab -> Foldable Shapes.
    try {
      const raw = sessionStorage.getItem('wordListHandoff')
      if (raw) {
        const prefill = JSON.parse(raw)
        if (Array.isArray(prefill.words) && prefill.words.length) setWords(prefill.words.join('\n'))
        if (prefill.title) setTitle(prefill.title)
        sessionStorage.removeItem('wordListHandoff')
      }
    } catch {}
  }, [])

  async function generate() {
    setGenerating(true); setMsg(null); setFileUrl(null)
    try {
      const res = await fetch('/api/worksheet-generators/flashcards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, words, color, title: title || 'Flashcards' }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Generation failed') }
      const fileUrlHeader = res.headers.get('X-File-Url')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'flashcards.pdf'; a.click()
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
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>🃏 Flashcards</h1>
        <a href="/dashboard/worksheet-generators" style={{ fontSize: 12, color: '#888' }}>← All Generators</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        One word per line. Add a definition/answer after a "|" (e.g. "photosynthesis | how plants make food") and it prints a matching back-side deck, in the same grid position, ready to print double-sided.
      </p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
        <textarea
          value={words} onChange={(e) => setWords(e.target.value)} rows={10}
          placeholder={'cat\ndog | a loyal pet\nsun | the star at the center of our solar system'}
          style={{ width: '100%', fontSize: 13, padding: 10, border: `1px solid ${C.border}`, borderRadius: 6, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (for saving)" style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, minWidth: 180 }} />
          <label style={{ fontSize: 12, color: '#555' }}>Color:</label>
          <select value={color} onChange={(e) => setColor(e.target.value)} style={{ fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }}>
            {['navy', 'green', 'purple', 'gold', 'red', 'black'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={generate} disabled={generating || !userId || !words.trim()}
            style={{ padding: '9px 18px', background: '#7a3c8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: generating ? 0.6 : 1 }}
          >
            {generating ? 'Generating…' : '📄 Generate Flashcards'}
          </button>
        </div>
        {msg && <p style={{ fontSize: 12, color: msg.startsWith('✓') ? '#2f6b41' : '#a33', marginTop: 8 }}>{msg}</p>}
        <SaveAsProductBar userId={userId} fileUrl={fileUrl} defaultTitle={title || 'Flashcards'} />
      </div>
    </div>
  )
}
