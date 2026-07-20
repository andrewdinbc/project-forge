'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import SaveAsProductBar from '@/components/SaveAsProductBar'

const TYPES = {
  brain_teaser: { label: 'Brain Teasers', icon: '🧠', desc: 'Mind-bending critical thinking riddles with a clear answer.' },
  what_am_i: { label: 'What Am I? Challenges', icon: '❓', desc: 'First-person clue riddles ending in "What am I?"' },
  analogy: { label: 'Logic: Analogies', icon: '🔗', desc: '"A is to B as C is to ___" multiple choice questions.' },
}

function TextPuzzleInner() {
  const searchParams = useSearchParams()
  const [userId, setUserId] = useState(null)
  const [type, setType] = useState(searchParams.get('type') || 'brain_teaser')
  const [topic, setTopic] = useState('')
  const [grade, setGrade] = useState('')
  const [count, setCount] = useState(8)
  const [title, setTitle] = useState('')
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState(null)
  const [fileUrl, setFileUrl] = useState(null)

  useEffect(() => { getCurrentUser().then((u) => u && setUserId(u.id)) }, [])
  const cfg = TYPES[type]

  async function generate() {
    setGenerating(true); setMsg(null); setFileUrl(null)
    try {
      const res = await fetch('/api/worksheet-generators/text-puzzle', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type, count, topic, grade, title: title || cfg.label }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Generation failed') }
      const fileUrlHeader = res.headers.get('X-File-Url')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'puzzles.pdf'; a.click()
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
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>{cfg.icon} {cfg.label}</h1>
        <a href="/dashboard/worksheet-generators" style={{ fontSize: 12, color: '#888' }}>← All Generators</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>{cfg.desc} AI writes original puzzles -- optionally themed to a topic -- with an answer key.</p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: '#555', marginRight: 8 }}>Type:</label>
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }}>
            {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Theme/topic (optional, e.g. animals, space)" style={{ flex: 1, minWidth: 200, fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }} />
          <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Grade (optional)" style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, width: 120 }} />
          <label style={{ fontSize: 12, color: '#555' }}>Count:</label>
          <input type="number" min={3} max={15} value={count} onChange={(e) => setCount(Math.max(3, Math.min(15, Number(e.target.value))))} style={{ width: 50, fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }} />
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (for saving)" style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, minWidth: 180 }} />
          <button
            onClick={generate} disabled={generating || !userId}
            style={{ padding: '9px 18px', background: '#7a3c8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: generating ? 0.6 : 1 }}
          >
            {generating ? 'Generating…' : '📄 Generate'}
          </button>
        </div>
        {msg && <p style={{ fontSize: 12, color: msg.startsWith('✓') ? '#2f6b41' : '#a33', marginTop: 8 }}>{msg}</p>}
        <SaveAsProductBar userId={userId} fileUrl={fileUrl} defaultTitle={title || cfg.label} />
      </div>
    </div>
  )
}

export default function TextPuzzlePage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, fontFamily: FONT_BODY }}>Loading…</div>}>
      <TextPuzzleInner />
    </Suspense>
  )
}
