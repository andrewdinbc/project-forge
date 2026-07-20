'use client'
import { useState, useEffect } from 'react'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import { getUserBundles } from '@/lib/bundles'
import SaveAsProductBar from '@/components/SaveAsProductBar'

const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8']

// Where a generated list can go next -- each existing generator that
// takes a plain "one word per line" list. sessionStorage handoff, same
// pattern as Schema Lab -> Foldable Shapes (key: wordListHandoff).
const SEND_TARGETS = [
  { path: '/dashboard/worksheet-generators/spelling-test', label: '📝 Spelling Test', icon: '📝' },
  { path: '/dashboard/worksheet-generators/word-search', label: '🔎 Word Search', icon: '🔎' },
  { path: '/dashboard/worksheet-generators/word-scramble', label: '🔤 Word Scramble', icon: '🔤' },
  { path: '/dashboard/worksheet-generators/abc-order', label: '🔡 ABC Order', icon: '🔡' },
  { path: '/dashboard/worksheet-generators/flashcards', label: '🃏 Flashcards', icon: '🃏' },
  { path: '/dashboard/worksheet-generators/missing-letters', label: '✏️ Missing Letters', icon: '✏️' },
]

export default function SpellingListPage() {
  const [userId, setUserId] = useState(null)
  const [grade, setGrade] = useState('3')
  const [topic, setTopic] = useState('')
  const [wordCount, setWordCount] = useState('')
  const [title, setTitle] = useState('')
  const [bundles, setBundles] = useState([])
  const [bundleId, setBundleId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState(null)
  const [fileUrl, setFileUrl] = useState(null)
  const [wordList, setWordList] = useState('') // editable, one per line, populated after generating

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
      const res = await fetch('/api/worksheet-generators/spelling-list', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, grade, topic: topic || undefined, wordCount: wordCount || undefined, title: title || undefined, bundleId: bundleId || undefined }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Generation failed') }
      const fileUrlHeader = res.headers.get('X-File-Url')
      const wordListHeader = res.headers.get('X-Word-List')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'spelling-list.pdf'; a.click()
      window.URL.revokeObjectURL(url)
      if (fileUrlHeader) setFileUrl(decodeURIComponent(fileUrlHeader))
      if (wordListHeader) setWordList(decodeURIComponent(wordListHeader).split(',').join('\n'))
      setMsg('✓ Generated and downloaded')
    } catch (e) {
      setMsg(e.message)
    } finally {
      setGenerating(false)
    }
  }

  function sendTo(path) {
    const words = wordList.split('\n').map((w) => w.trim()).filter(Boolean)
    if (!words.length) return
    try {
      sessionStorage.setItem('wordListHandoff', JSON.stringify({ words, title: title || `Grade ${grade} Spelling${topic ? `: ${topic}` : ''}` }))
    } catch {}
    window.location.href = path
  }

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 700, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>📋 Spelling List Generator</h1>
        <a href="/dashboard/worksheet-generators" style={{ fontSize: 12, color: '#888' }}>← All Generators</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Generate a grade-appropriate spelling list -- by theme, spelling pattern, or just "give me a
        good list for this grade." Word count follows real classroom guidance (10 or fewer for K-2,
        15-20 for older grades). Once generated, send the list straight into a Spelling Test, Word
        Search, Word Scramble, ABC Order, Flashcards, or Missing Letters worksheet with one click.
      </p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: '#555' }}>Grade:</label>
          <select value={grade} onChange={(e) => setGrade(e.target.value)} style={{ fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }}>
            {GRADES.map((g) => (<option key={g} value={g}>{g === 'K' ? 'Kindergarten' : `Grade ${g}`}</option>))}
          </select>
          <label style={{ fontSize: 12, color: '#555' }}>Word count (optional):</label>
          <input value={wordCount} onChange={(e) => setWordCount(e.target.value)} placeholder="auto" type="number" min="5" max="25" style={{ fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5, width: 70 }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Theme or spelling pattern (optional):</label>
          <input
            value={topic} onChange={(e) => setTopic(e.target.value)}
            placeholder='e.g. "ocean animals", "silent e words", "commonly misspelled words" -- leave blank for a general grade-level list'
            style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, width: '100%', boxSizing: 'border-box' }}
          />
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
            {generating ? 'Generating…' : '📄 Generate List'}
          </button>
        </div>
        {msg && <p style={{ fontSize: 12, color: msg.startsWith('✓') ? '#2f6b41' : '#a33', marginTop: 8 }}>{msg}</p>}
        <SaveAsProductBar userId={userId} fileUrl={fileUrl} defaultTitle={title || `Grade ${grade} Spelling List`} />
      </div>

      {wordList && (
        <div style={{ background: '#faf9f5', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Your word list (edit if you'd like, then send it onward):</div>
          <textarea
            value={wordList} onChange={(e) => setWordList(e.target.value)}
            rows={Math.min(12, wordList.split('\n').length + 1)}
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 5, fontFamily: 'inherit', resize: 'vertical', marginBottom: 12 }}
          />
          <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>Send this list to:</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SEND_TARGETS.map((t) => (
              <button
                key={t.path} onClick={() => sendTo(t.path)}
                style={{ padding: '7px 12px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#333' }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
