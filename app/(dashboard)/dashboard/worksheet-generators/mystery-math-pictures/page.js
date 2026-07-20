'use client'
import { useState, useEffect } from 'react'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import { getUserBundles } from '@/lib/bundles'
import SaveAsProductBar from '@/components/SaveAsProductBar'

const OPS = [
  { key: '+', label: '+ Addition' },
  { key: '-', label: '\u2212 Subtraction' },
  { key: 'x', label: '\u00d7 Multiplication' },
]

export default function MysteryMathPicturesPage() {
  const [userId, setUserId] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [complexity, setComplexity] = useState('simple')
  const [operations, setOperations] = useState(['+', '-'])
  const [title, setTitle] = useState('')
  const [bundles, setBundles] = useState([])
  const [bundleId, setBundleId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState(null)
  const [fileUrl, setFileUrl] = useState(null)

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (!u) return
      setUserId(u.id)
      getUserBundles(u.id).then((b) => setBundles(b || [])).catch(() => {})
    })
  }, [])

  function toggleOp(key) {
    setOperations((prev) => (prev.includes(key) ? prev.filter((o) => o !== key) : [...prev, key]))
  }

  async function generate() {
    if (!prompt.trim()) { setMsg('Describe what to draw first (e.g. "a friendly whale").'); return }
    if (!operations.length) { setMsg('Choose at least one operation.'); return }
    setGenerating(true); setMsg(null); setFileUrl(null)
    try {
      const res = await fetch('/api/worksheet-generators/mystery-math-pictures', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId, prompt: prompt.trim(), complexity, operations,
          title: title || `Mystery Math Picture: ${prompt.trim()}`, bundleId: bundleId || undefined,
        }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Generation failed') }
      const fileUrlHeader = res.headers.get('X-File-Url')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'mystery-math-picture.pdf'; a.click()
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
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>🧮 Mystery Math Pictures</h1>
        <a href="/dashboard/worksheet-generators" style={{ fontSize: 12, color: '#888' }}>← All Generators</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Same idea as Color by Number, but every space holds a math problem instead of a plain number --
        solve it to find the key number, then color it in. Answers stay 1-6 so the color key is short.
        Needs GEMINI_API_KEY set in this project's environment variables.
      </p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>What should the picture show?</label>
          <input
            value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder='e.g. "a friendly whale", "a jack-o-lantern", "a school bus"'
            style={{ fontSize: 13, padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 5, width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: '#555' }}>Grid complexity:</label>
          <select value={complexity} onChange={(e) => setComplexity(e.target.value)} style={{ fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }}>
            <option value="simple">Simple (9x12 -- younger grades)</option>
            <option value="detailed">Detailed (12x16 -- older grades)</option>
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Operations:</label>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {OPS.map((o) => (
              <label key={o.key} style={{ fontSize: 12, color: '#333', display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={operations.includes(o.key)} onChange={() => toggleOp(o.key)} />
                {o.label}
              </label>
            ))}
          </div>
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
            {generating ? 'Generating… (can take ~20s)' : '📄 Generate Mystery Math Picture'}
          </button>
        </div>
        {msg && <p style={{ fontSize: 12, color: msg.startsWith('✓') ? '#2f6b41' : '#a33', marginTop: 8 }}>{msg}</p>}
        <SaveAsProductBar userId={userId} fileUrl={fileUrl} defaultTitle={title || `Mystery Math Picture: ${prompt}`} />
      </div>
    </div>
  )
}
