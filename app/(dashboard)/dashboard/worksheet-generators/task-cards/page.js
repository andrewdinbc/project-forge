'use client'
import { useState, useEffect } from 'react'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import SaveAsProductBar from '@/components/SaveAsProductBar'

export default function TaskCardsPage() {
  const [userId, setUserId] = useState(null)
  const [topic, setTopic] = useState('')
  const [grade, setGrade] = useState('')
  const [subject, setSubject] = useState('')
  const [count, setCount] = useState(24)
  const [title, setTitle] = useState('')
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState(null)
  const [fileUrl, setFileUrl] = useState(null)

  useEffect(() => { getCurrentUser().then((u) => u && setUserId(u.id)) }, [])

  async function generate() {
    setGenerating(true); setMsg(null); setFileUrl(null)
    try {
      const res = await fetch('/api/worksheet-generators/task-cards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, topic, grade, subject, count, title: title || `${topic} Task Cards` }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Generation failed') }
      const fileUrlHeader = res.headers.get('X-File-Url')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'task-cards.pdf'; a.click()
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
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>🗂️ Task Cards</h1>
        <a href="/dashboard/worksheet-generators" style={{ fontSize: 12, color: '#888' }}>← All Generators</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        A cut-apart set of question/task cards on any topic, with an answer key -- for stations, SCOOT games, task rotations, or early finishers.
      </p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic (e.g. dinosaurs, fractions, the water cycle)" style={{ flex: 1, minWidth: 240, fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }} />
          <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Grade (optional)" style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, width: 120 }} />
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional)" style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, width: 160 }} />
          <label style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
            Cards:
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ fontSize: 12, padding: '5px 6px', border: `1px solid ${C.border}`, borderRadius: 5 }}>
              <option value={8}>8</option>
              <option value={16}>16</option>
              <option value={24}>24</option>
              <option value={32}>32</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (for saving)" style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, minWidth: 180 }} />
          <button
            onClick={generate} disabled={generating || !userId || !topic.trim()}
            style={{ padding: '9px 18px', background: '#7a3c8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (generating || !topic.trim()) ? 0.6 : 1 }}
          >
            {generating ? 'Generating…' : '📄 Generate Task Cards'}
          </button>
        </div>
        {msg && <p style={{ fontSize: 12, color: msg.startsWith('✓') ? '#2f6b41' : '#a33', marginTop: 8 }}>{msg}</p>}
        <SaveAsProductBar userId={userId} fileUrl={fileUrl} defaultTitle={title || `${topic} Task Cards`} />
      </div>
    </div>
  )
}
