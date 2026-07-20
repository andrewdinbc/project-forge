'use client'
import { useState, useEffect } from 'react'
import { COLORS as C } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'

// Interactive Notebook Generator (Aj, 2026-07-20): "In the end I want you to
// make a Interactive Notebook Generator." Pick a saved Schema (Schema Lab)
// + a subject/grade, and get back one real, laid-out, printable PDF -- the
// schema's structural components rendered either as actual Foldable Shape
// Library geometry (petals, flaps, layers, puzzle pieces...) or plain
// content pages, in one document, in the right order.
export default function InbGeneratorPage() {
  const [userId, setUserId] = useState(null)
  const [schemas, setSchemas] = useState([])
  const [loading, setLoading] = useState(true)

  const [schemaId, setSchemaId] = useState('')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [topic, setTopic] = useState('')
  const [jurisdiction, setJurisdiction] = useState('British Columbia, Canada')

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) return
      setUserId(user.id)
      fetch(`/api/schema-lab/list?userId=${user.id}`)
        .then((r) => r.json())
        .then((d) => {
          const list = d.schemas || []
          setSchemas(list)
          if (list.length && !schemaId) setSchemaId(list[0].id)
          setLoading(false)
        })
    })
  }, [])

  async function generate() {
    if (!schemaId || !subject.trim() || !grade.trim()) return
    setGenerating(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/inb-generator/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, schemaId, subject: subject.trim(), grade: grade.trim(), topic: topic.trim() || undefined, jurisdiction: jurisdiction.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const selectedSchema = schemas.find((s) => s.id === schemaId)

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>

  return (
    <div style={{ padding: 24, maxWidth: 780 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.navy, marginBottom: 4 }}>📓 Interactive Notebook Generator</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Pick a schema from the Schema Library, give it a subject and grade, and get back one fully laid-out,
        printable PDF -- real foldable geometry for shape components, plain pages for the rest.
      </p>

      {schemas.length === 0 ? (
        <div style={{ padding: 16, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8 }}>
          No schemas yet. Build one first in the <a href="/dashboard/schema-lab" style={{ color: C.gold }}>Schema Editor</a>.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>
            Schema
            <select value={schemaId} onChange={(e) => setSchemaId(e.target.value)} style={selectStyle}>
              {schemas.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({(s.source_titles || []).length} sources)</option>
              ))}
            </select>
          </label>

          {selectedSchema && (() => {
            let parsed = {}
            try { parsed = JSON.parse(selectedSchema.structural_summary) } catch {}
            return (
              <div style={{ fontSize: 12, color: '#555', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
                {parsed.structuralSummary}
                <div style={{ marginTop: 8, fontSize: 11, color: '#888' }}>
                  {(parsed.components || []).length} structural components \u2022 {selectedSchema.generation_count || 0} previous generations
                </div>
              </div>
            )
          })()}

          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.navy, flex: 1 }}>
              Subject
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Volcanoes" style={inputStyle} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.navy, width: 120 }}>
              Grade
              <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 5" style={inputStyle} />
            </label>
          </div>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>
            Topic/focus (optional)
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. types of volcanic eruptions" style={inputStyle} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>
            Jurisdiction
            <input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} style={inputStyle} />
          </label>

          <button
            onClick={generate}
            disabled={generating || !subject.trim() || !grade.trim()}
            style={{
              marginTop: 4, padding: '10px 16px', borderRadius: 8, border: 'none',
              background: generating ? '#ccc' : C.navy, color: 'white', fontWeight: 600, fontSize: 13,
              cursor: generating ? 'default' : 'pointer',
            }}
          >
            {generating ? 'Generating full notebook\u2026' : 'Generate Interactive Notebook'}
          </button>

          {error && <p style={{ color: C.red || 'crimson', fontSize: 12 }}>{error}</p>}

          {result && (
            <div style={{ marginTop: 16, padding: 16, border: `1px solid ${C.border}`, borderRadius: 8, background: 'white' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 4 }}>{result.title}</div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>{result.pageCount} pages \u2022 schema: {result.schemaName}</div>
              {result.coverImageUrl && (
                <img src={result.coverImageUrl} alt="cover" style={{ width: 160, border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 10 }} />
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <a href={result.pdfDataUrl} download={`${result.title}.pdf`} style={btnLink}>Download PDF</a>
                <a href={result.pdfUrl} target="_blank" rel="noreferrer" style={btnLinkGhost}>Open in new tab</a>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 4 }}>Component plan</div>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <tbody>
                    {result.componentPlan.map((c, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '4px 6px' }}>{c.name}</td>
                        <td style={{ padding: '4px 6px', color: '#888' }}>{c.kind}{c.shapeKey ? ` \u2192 ${c.shapeKey}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {result.skippedComponents?.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#888' }}>Skipped (not applicable to generated content): {result.skippedComponents.join(', ')}</div>
              )}
              {result.failedComponents?.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: C.red || 'crimson' }}>Needs regeneration: {result.failedComponents.join(', ')}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const inputStyle = { display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, boxSizing: 'border-box' }
const selectStyle = { ...inputStyle }
const btnLink = { padding: '8px 14px', borderRadius: 6, background: C.gold, color: 'white', fontSize: 12, fontWeight: 600, textDecoration: 'none' }
const btnLinkGhost = { padding: '8px 14px', borderRadius: 6, border: `1px solid ${C.border}`, color: C.navy, fontSize: 12, fontWeight: 600, textDecoration: 'none' }
