'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import SaveAsProductBar from '@/components/SaveAsProductBar'

function MysteryCluesInner() {
  const searchParams = useSearchParams()
  const [userId, setUserId] = useState(null)
  const [subject, setSubject] = useState(searchParams.get('subject') || 'number')
  const [min, setMin] = useState(1)
  const [max, setMax] = useState(100)
  const [grade, setGrade] = useState('')
  const [title, setTitle] = useState('')
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState(null)
  const [fileUrl, setFileUrl] = useState(null)

  useEffect(() => { getCurrentUser().then((u) => u && setUserId(u.id)) }, [])

  async function generate() {
    setGenerating(true); setMsg(null); setFileUrl(null)
    try {
      const res = await fetch('/api/worksheet-generators/mystery-clues', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subject, min, max, grade, title: title || (subject === 'number' ? 'Number Detective' : 'Mystery State') }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Generation failed') }
      const fileUrlHeader = res.headers.get('X-File-Url')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'mystery-clues.pdf'; a.click()
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
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>🕵️ Mystery Clues</h1>
        <a href="/dashboard/worksheet-generators" style={{ fontSize: 12, color: '#888' }}>← All Generators</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        A Monday-Friday clue log -- post one clue a day, students narrow down the answer. AI writes 5 original, progressively easier clues.
      </p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#555', marginRight: 8 }}>Mystery type:</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }}>
            <option value="number">Number Detective</option>
            <option value="state">Mystery US State</option>
          </select>
        </div>
        {subject === 'number' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#555' }}>Number range:</label>
            <input type="number" value={min} onChange={(e) => setMin(Number(e.target.value))} style={{ width: 70, fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }} />
            <span>to</span>
            <input type="number" value={max} onChange={(e) => setMax(Number(e.target.value))} style={{ width: 70, fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Grade (optional)" style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, width: 140 }} />
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (for saving)" style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, minWidth: 180 }} />
          <button
            onClick={generate} disabled={generating || !userId}
            style={{ padding: '9px 18px', background: '#7a3c8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: generating ? 0.6 : 1 }}
          >
            {generating ? 'Generating…' : '📄 Generate Clue Log'}
          </button>
        </div>
        {msg && <p style={{ fontSize: 12, color: msg.startsWith('✓') ? '#2f6b41' : '#a33', marginTop: 8 }}>{msg}</p>}
        <SaveAsProductBar userId={userId} fileUrl={fileUrl} defaultTitle={title || (subject === 'number' ? 'Number Detective' : 'Mystery State')} />
      </div>
    </div>
  )
}

export default function MysteryCluesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, fontFamily: FONT_BODY }}>Loading…</div>}>
      <MysteryCluesInner />
    </Suspense>
  )
}
