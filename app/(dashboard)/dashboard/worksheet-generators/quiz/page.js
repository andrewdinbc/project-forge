'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import SaveAsProductBar from '@/components/SaveAsProductBar'

const TYPES = {
  multiple_choice: {
    label: 'Multiple Choice', title: 'Multiple Choice Quiz',
    help: 'Question, then one option per line. Prefix the correct one with * (used for the answer key only). Separate questions with a blank line.',
    placeholder: 'What is the capital of France?\n*Paris\nLondon\nBerlin\nMadrid\n\nWhat is 2 + 2?\n3\n*4\n5\n6',
  },
  matching: {
    label: 'Matching', title: 'Matching Quiz',
    help: 'One pair per line, as "term = definition". The right-hand answers get shuffled and lettered automatically.',
    placeholder: 'Photosynthesis = How plants make food using sunlight\nMitosis = Cell division that makes two identical cells\nHabitat = The natural home of an animal or plant',
  },
  fill_blank: {
    label: 'Fill-in-the-Blank', title: 'Fill-in-the-Blank Quiz',
    help: 'One question per line. Use ___ where the blank should go.',
    placeholder: 'The capital of France is ___.\nWater freezes at ___ degrees Celsius.',
  },
  short_answer: {
    label: 'Short Answer / Essay', title: 'Short Answer / Essay Test',
    help: 'One prompt per paragraph (separate with a blank line). Each gets four ruled lines to write on.',
    placeholder: 'Explain why plants need sunlight to grow.\n\nDescribe one way animals adapt to cold climates.',
  },
}

function QuizGeneratorInner() {
  const searchParams = useSearchParams()
  const [userId, setUserId] = useState(null)
  const [type, setType] = useState(searchParams.get('type') || 'multiple_choice')
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState(null)
  const [fileUrl, setFileUrl] = useState(null)

  useEffect(() => { getCurrentUser().then((u) => u && setUserId(u.id)) }, [])

  const cfg = TYPES[type] || TYPES.multiple_choice

  async function generate() {
    setGenerating(true); setMsg(null); setFileUrl(null)
    try {
      const res = await fetch('/api/worksheet-generators/quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type, content, title: title || cfg.title }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Generation failed') }
      const fileUrlHeader = res.headers.get('X-File-Url')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'quiz.pdf'; a.click()
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
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>📝 Quiz Generator</h1>
        <a href="/dashboard/worksheet-generators" style={{ fontSize: 12, color: '#888' }}>← All Generators</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>{cfg.help}</p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: '#555', marginRight: 8 }}>Type:</label>
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }}>
            {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <textarea
          value={content} onChange={(e) => setContent(e.target.value)} rows={12}
          placeholder={cfg.placeholder}
          style={{ width: '100%', fontSize: 13, padding: 10, border: `1px solid ${C.border}`, borderRadius: 6, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (for saving)" style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, minWidth: 180 }} />
          <button
            onClick={generate} disabled={generating || !userId || !content.trim()}
            style={{ padding: '9px 18px', background: '#7a3c8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: generating ? 0.6 : 1 }}
          >
            {generating ? 'Generating…' : '📄 Generate Quiz'}
          </button>
        </div>
        {msg && <p style={{ fontSize: 12, color: msg.startsWith('✓') ? '#2f6b41' : '#a33', marginTop: 8 }}>{msg}</p>}
        <SaveAsProductBar userId={userId} fileUrl={fileUrl} defaultTitle={title || cfg.title} />
      </div>
    </div>
  )
}

export default function QuizGeneratorPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, fontFamily: FONT_BODY }}>Loading…</div>}>
      <QuizGeneratorInner />
    </Suspense>
  )
}
