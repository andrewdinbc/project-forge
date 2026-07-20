'use client'
import { useState, useEffect } from 'react'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import SaveAsProductBar from '@/components/SaveAsProductBar'

export default function ReadingPassageGeneratorPage() {
  const [userId, setUserId] = useState(null)
  const [topic, setTopic] = useState('')
  const [mode, setMode] = useState('single') // 'single' | 'differentiated'
  const [gradeLevel, setGradeLevel] = useState(3)
  const [title, setTitle] = useState('')

  const [parts, setParts] = useState([])
  const [borderPartId, setBorderPartId] = useState('')
  const [headerPartId, setHeaderPartId] = useState('')

  const [illustrationMode, setIllustrationMode] = useState('none') // 'none' | 'ai' | 'url'
  const [illustrationUrl, setIllustrationUrl] = useState('')
  const [illustrationGenerating, setIllustrationGenerating] = useState(false)

  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState(null)
  const [fileUrl, setFileUrl] = useState(null)
  const [levelsMeta, setLevelsMeta] = useState(null)

  useEffect(() => { getCurrentUser().then((u) => u && setUserId(u.id)) }, [])
  useEffect(() => {
    if (!userId) return
    fetch(`/api/library-parts?userId=${userId}`).then((r) => r.json()).then((d) => setParts(d.parts || [])).catch(() => {})
  }, [userId])

  const borders = parts.filter((p) => p.category === 'border')
  const headers = parts.filter((p) => p.category === 'section_header')

  async function generateIllustration() {
    if (!topic.trim() || !userId) return
    setIllustrationGenerating(true); setMsg(null)
    try {
      const res = await fetch('/api/design-assets/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          prompt: `A simple, friendly illustration of ${topic.trim()}, suitable for a children's reading comprehension worksheet`,
          provider: 'gemini',
          style: 'flat_color_icon',
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Illustration generation failed')
      setIllustrationUrl(d.url)
    } catch (e) {
      setMsg(e.message)
    } finally {
      setIllustrationGenerating(false)
    }
  }

  async function generate() {
    if (!userId || !topic.trim()) return
    setGenerating(true); setMsg(null); setFileUrl(null); setLevelsMeta(null)
    try {
      const res = await fetch('/api/worksheet-generators/reading-passage/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId, topic: topic.trim(), mode, gradeLevel: Number(gradeLevel),
          borderPartId: borderPartId || undefined, headerPartId: headerPartId || undefined,
          illustrationUrl: illustrationMode !== 'none' ? illustrationUrl || undefined : undefined,
          title: title || undefined,
        }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Generation failed') }
      const fileUrlHeader = res.headers.get('X-File-Url')
      const levelsHeader = res.headers.get('X-Levels-Meta')
      if (levelsHeader) { try { setLevelsMeta(JSON.parse(decodeURIComponent(levelsHeader))) } catch {} }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'reading-passage.pdf'; a.click()
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
    <div style={{ fontFamily: FONT_BODY, maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>📖 Reading Passage Generator</h1>
        <a href="/dashboard/worksheet-generators" style={{ fontSize: 12, color: '#888' }}>← All Generators</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Pick a topic and a grade level. The passage is written fresh by AI, but its sentence length and
        vocabulary complexity are calibrated against the real, professionally-leveled HELPS Curriculum (100
        free reading-fluency passages) so the grade level is grounded, not guessed. Every passage comes with
        an annotation guide, comprehension questions, and an answer key -- add your own border/header art
        from the Parts Library and an illustration to finish the look.
      </p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Topic:</label>
          <input
            value={topic} onChange={(e) => setTopic(e.target.value)}
            placeholder='e.g. "dinosaurs", "the water cycle", "Terry Fox"'
            style={{ width: '100%', fontSize: 13, padding: '7px 9px', border: `1px solid ${C.border}`, borderRadius: 5, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Level:</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button
              onClick={() => setMode('single')}
              style={{ flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 6, border: `1px solid ${mode === 'single' ? '#2f6b41' : C.border}`, background: mode === 'single' ? '#eef6f0' : '#fff', color: mode === 'single' ? '#2f6b41' : '#555' }}
            >
              Single grade level
            </button>
            <button
              onClick={() => setMode('differentiated')}
              style={{ flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 6, border: `1px solid ${mode === 'differentiated' ? '#7a3c8a' : C.border}`, background: mode === 'differentiated' ? '#f5eafa' : '#fff', color: mode === 'differentiated' ? '#7a3c8a' : '#555' }}
            >
              3-tier differentiated (same content, 3 levels)
            </button>
          </div>
          <input
            type="number" step="0.5" min="0.5" max="12"
            value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}
            style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, width: 100 }}
          />
          <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>
            {mode === 'differentiated' ? 'This is the middle (On-Level) grade; Support and Challenge are generated around it.' : 'US grade level, e.g. 3 for Grade 3.'}
          </span>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Illustration:</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={() => setIllustrationMode('none')} style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', borderRadius: 6, border: `1px solid ${illustrationMode === 'none' ? '#555' : C.border}`, background: illustrationMode === 'none' ? '#f2f2f2' : '#fff' }}>None</button>
            <button onClick={() => setIllustrationMode('ai')} style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', borderRadius: 6, border: `1px solid ${illustrationMode === 'ai' ? '#7a3c8a' : C.border}`, background: illustrationMode === 'ai' ? '#f5eafa' : '#fff', color: illustrationMode === 'ai' ? '#7a3c8a' : '#555' }}>✨ AI-generate for this topic</button>
            <button onClick={() => setIllustrationMode('url')} style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', borderRadius: 6, border: `1px solid ${illustrationMode === 'url' ? '#2f6b41' : C.border}`, background: illustrationMode === 'url' ? '#eef6f0' : '#fff', color: illustrationMode === 'url' ? '#2f6b41' : '#555' }}>Paste my own URL</button>
          </div>
          {illustrationMode === 'ai' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={generateIllustration} disabled={illustrationGenerating || !topic.trim()} style={{ fontSize: 11, padding: '6px 10px', borderRadius: 5, border: 'none', background: '#7a3c8a', color: '#fff', cursor: 'pointer', opacity: illustrationGenerating ? 0.6 : 1 }}>
                {illustrationGenerating ? 'Generating…' : 'Generate illustration'}
              </button>
              {illustrationUrl && <img src={illustrationUrl} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4, border: `1px solid ${C.border}` }} />}
            </div>
          )}
          {illustrationMode === 'url' && (
            <input value={illustrationUrl} onChange={(e) => setIllustrationUrl(e.target.value)} placeholder="https://..." style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, boxSizing: 'border-box' }} />
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Border (Parts Library):</label>
            <select value={borderPartId} onChange={(e) => setBorderPartId(e.target.value)} style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }}>
              <option value="">None</option>
              {borders.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Section header (Parts Library):</label>
            <select value={headerPartId} onChange={(e) => setHeaderPartId(e.target.value)} style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }}>
              <option value="">None</option>
              {headers.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (for saving)" style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, minWidth: 180 }} />
          <button
            onClick={generate} disabled={generating || !userId || !topic.trim()}
            style={{ padding: '9px 18px', background: '#7a3c8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: generating ? 0.6 : 1 }}
          >
            {generating ? 'Generating…' : '📄 Generate Reading Passage'}
          </button>
        </div>
        {msg && <p style={{ fontSize: 12, color: msg.startsWith('✓') ? '#2f6b41' : '#a33', marginTop: 8 }}>{msg}</p>}

        {levelsMeta && (
          <div style={{ marginTop: 10, padding: 10, background: '#f7f7f7', borderRadius: 6, fontSize: 11, color: '#555' }}>
            <strong>Grade-level check</strong> (independently computed, not just the AI's claim):
            {levelsMeta.map((l, i) => (
              <div key={i} style={{ marginTop: 4 }}>
                {l.label && l.label !== 'Passage' ? `${l.label}: ` : ''}
                target grade {l.targetGrade?.toFixed?.(1)} → actual grade {l.actualGrade}
                {l.gradeGapFlag && <span style={{ color: '#a33', fontWeight: 600 }}> ⚠ off by more than 2.5 grades -- review before using</span>}
              </div>
            ))}
          </div>
        )}

        <SaveAsProductBar userId={userId} fileUrl={fileUrl} defaultTitle={title || `Reading Passage: ${topic}`} />
      </div>
    </div>
  )
}
