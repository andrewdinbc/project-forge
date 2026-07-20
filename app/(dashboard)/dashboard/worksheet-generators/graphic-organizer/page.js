'use client'
import { useState, useEffect } from 'react'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import { ORGANIZER_CATALOG, findOrganizer } from '@/lib/graphic-organizer-catalog'
import SaveAsProductBar from '@/components/SaveAsProductBar'

export default function GraphicOrganizerPage() {
  const [userId, setUserId] = useState(null)
  const [organizerKey, setOrganizerKey] = useState(ORGANIZER_CATALOG[0].tools[0].key)
  const [task, setTask] = useState('')
  const [grade, setGrade] = useState('')
  const [fillMode, setFillMode] = useState('blank') // 'blank' | 'ai'
  const [title, setTitle] = useState('')
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState(null)
  const [fileUrl, setFileUrl] = useState(null)

  useEffect(() => { getCurrentUser().then((u) => u && setUserId(u.id)) }, [])

  const tool = findOrganizer(organizerKey)
  const isTree = tool?.layout === 'tree'

  async function generate() {
    setGenerating(true); setMsg(null); setFileUrl(null)
    try {
      let content = null
      if (fillMode === 'ai' && !isTree) {
        if (!task.trim()) throw new Error('Enter a topic/task for the AI to personalize this around.')
        const pRes = await fetch('/api/worksheet-generators/graphic-organizer/personalize', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizerKey, task, grade }),
        })
        const pd = await pRes.json()
        if (!pRes.ok) throw new Error(pd.error || 'Personalization failed')
        content = pd.content
      }
      const res = await fetch('/api/worksheet-generators/graphic-organizer/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, organizerKey, content, task, title: title || tool.label }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Generation failed') }
      const fileUrlHeader = res.headers.get('X-File-Url')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'organizer.pdf'; a.click()
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
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>🗺️ Graphic Organizer Generator</h1>
        <a href="/dashboard/worksheet-generators" style={{ fontSize: 12, color: '#888' }}>← All Generators</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Covers webs, Venn diagrams, T-charts, KWL/KWHL charts, story maps, vocabulary organizers, relationship trees, and more. Leave it blank for students to fill in themselves, or have AI write original content into it for a specific topic -- no need to upload or type it all in by hand.
      </p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Organizer type:</label>
          <select value={organizerKey} onChange={(e) => setOrganizerKey(e.target.value)} style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }}>
            {ORGANIZER_CATALOG.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.tools.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>How should it be filled in?</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setFillMode('blank')}
              style={{ flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 6, border: `1px solid ${fillMode === 'blank' ? '#2f6b41' : C.border}`, background: fillMode === 'blank' ? '#eef6f0' : '#fff', color: fillMode === 'blank' ? '#2f6b41' : '#555' }}
            >
              ✍️ Blank -- students fill it in
            </button>
            <button
              onClick={() => setFillMode('ai')} disabled={isTree}
              title={isTree ? "AI-fill isn't available for Relationship Trees yet" : undefined}
              style={{ flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 600, cursor: isTree ? 'not-allowed' : 'pointer', borderRadius: 6, border: `1px solid ${fillMode === 'ai' ? '#7a3c8a' : C.border}`, background: fillMode === 'ai' ? '#f5eafa' : '#fff', color: isTree ? '#bbb' : fillMode === 'ai' ? '#7a3c8a' : '#555', opacity: isTree ? 0.6 : 1 }}
            >
              ✨ AI-filled -- personalized to a topic
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>
            Topic / task {fillMode === 'ai' ? '(required)' : '(optional -- shown as a subtitle)'}:
          </label>
          <input
            value={task} onChange={(e) => setTask(e.target.value)}
            placeholder={'e.g. "Compare frogs and toads" or "Chapter 3 of Charlotte\u2019s Web"'}
            style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, boxSizing: 'border-box' }}
          />
        </div>

        {fillMode === 'ai' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Grade level (optional):</label>
            <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 3rd grade" style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, width: 160 }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (for saving)" style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, minWidth: 180 }} />
          <button
            onClick={generate} disabled={generating || !userId}
            style={{ padding: '9px 18px', background: '#7a3c8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: generating ? 0.6 : 1 }}
          >
            {generating ? 'Generating…' : '📄 Generate Organizer'}
          </button>
        </div>
        {msg && <p style={{ fontSize: 12, color: msg.startsWith('✓') ? '#2f6b41' : '#a33', marginTop: 8 }}>{msg}</p>}
        <SaveAsProductBar userId={userId} fileUrl={fileUrl} defaultTitle={title || tool?.label} />
      </div>
    </div>
  )
}
