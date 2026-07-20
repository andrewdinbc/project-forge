'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { COLORS as C } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'

// Schema Lab (Aj, 2026-07-19): "Schema Creator... It is not the content
// itself I want but the idea of an activity of that type... interactive
// notebook... I want to be able to upload as many Interactive Notebooks I
// have, and extract that component to the Schema Library. That way I can
// have AI use it as inspiration in conjunction with design assets I have
// made to create it for me on new subject matter."
//
// Three steps, matching the three new routes:
//   1. Analyze Structure (per resource, vision-based) -- what students
//      physically do, recurring structural components. Distinct from Style
//      Lab's Visual Layers (removable assets) and abstract style layers
//      (tone/pacing text patterns) -- this is the GENRE structure.
//   2. Synthesize (across several resources, ideally from different
//      companies) -- finds what's actually DEFINING about the genre versus
//      one seller's specific take, saves a named Schema to the Library.
//   3. Generate from Schema -- new subject + grade, following the schema's
//      component breakdown. Produces structural TEXT content; laying it out
//      visually with your own design assets is a Composer/Asset Modifier/
//      Font Modifier step after, same as any other AI-generated content.
export default function SchemaLabPage() {
  const searchParams = useSearchParams()
  const preselectId = searchParams.get('preselect')
  const [userId, setUserId] = useState(null)
  const [schemas, setSchemas] = useState([])
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState([])

  const [selectedForSchema, setSelectedForSchema] = useState(new Set())
  const [analyzingId, setAnalyzingId] = useState(null)
  const [schemaName, setSchemaName] = useState('')
  const [synthesizing, setSynthesizing] = useState(false)
  const [synthesizeMsg, setSynthesizeMsg] = useState(null)

  const [genFor, setGenFor] = useState(null) // schema id whose generate form is open
  const [genSubject, setGenSubject] = useState('')
  const [genGrade, setGenGrade] = useState('')
  const [genTopic, setGenTopic] = useState('')
  const [genJurisdiction, setGenJurisdiction] = useState('British Columbia, Canada')
  const [genStyleProfileId, setGenStyleProfileId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState(null)

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) return
      setUserId(user.id)
      Promise.all([
        fetch(`/api/schema-lab/list?userId=${user.id}`).then((r) => r.json()),
        fetch(`/api/style-lab/resources?userId=${user.id}`).then((r) => r.json()),
        fetch(`/api/style-lab/blend?userId=${user.id}`).then((r) => r.json()),
      ]).then(([s, r, p]) => {
        setSchemas(s.schemas || [])
        setResources(r.resources || [])
        setProfiles(p.profiles || [])
        setLoading(false)
        // Sent here via "Add to Schema Editor" from the Visual Layer Live
        // View (Aj, 2026-07-19) -- auto-select it, and analyze its structure
        // first if that hasn't happened yet (selection requires it).
        if (preselectId) {
          setSelectedForSchema((prev) => new Set(prev).add(preselectId))
          const match = (r.resources || []).find((x) => x.id === preselectId)
          if (match && !match.activity_structure_notes) {
            analyzeStructure(match)
          }
        }
      })
    })
  }, [])

  function toggleSelect(id) {
    setSelectedForSchema((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  async function analyzeStructure(r) {
    setAnalyzingId(r.id)
    try {
      const res = await fetch('/api/schema-lab/analyze-structure', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, resourceId: r.id }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Analysis failed')
      setResources((prev) => prev.map((x) => (x.id === r.id ? { ...x, activity_structure_notes: d.notes } : x)))
    } catch (e) {
      alert(e.message)
    } finally {
      setAnalyzingId(null)
    }
  }

  async function synthesize() {
    if (!schemaName.trim() || selectedForSchema.size === 0) return
    setSynthesizing(true); setSynthesizeMsg(null)
    try {
      const res = await fetch('/api/schema-lab/synthesize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: schemaName.trim(), resourceIds: Array.from(selectedForSchema) }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Synthesis failed')
      setSchemas((prev) => [d.schema, ...prev])
      setSchemaName('')
      setSelectedForSchema(new Set())
      setSynthesizeMsg(`✓ Saved "${d.schema.name}" to your Schema Library, built from ${d.usedResourceCount} resource(s).`)
    } catch (e) {
      setSynthesizeMsg(e.message)
    } finally {
      setSynthesizing(false)
    }
  }

  async function generateFromSchema(schema) {
    if (!genSubject.trim() || !genGrade.trim()) return
    setGenerating(true); setGenResult(null)
    try {
      const res = await fetch('/api/schema-lab/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId, schemaId: schema.id, subject: genSubject.trim(), grade: genGrade.trim(),
          topic: genTopic.trim() || undefined, jurisdiction: genJurisdiction.trim() || undefined,
          styleProfileId: genStyleProfileId || undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Generation failed')
      setGenResult(d)
    } catch (e) {
      setGenResult({ error: e.message })
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <div style={{ padding: 40 }}>Loading Schema Lab…</div>

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.navy, marginBottom: 4 }}>🧬 Schema Lab</h1>
      <div style={{ background: '#eef4fb', border: '1px solid #c8dcf0', borderRadius: 8, padding: 12, marginBottom: 20 }}>
        <p style={{ fontSize: 12, color: '#333', margin: 0, lineHeight: 1.5 }}>
          <strong>What this is, and how it's different from Style Lab:</strong> Style Lab extracts a
          resource's abstract tone/pacing (Extract Style Layers) or its removable visual assets
          (Visual layers). Schema Lab extracts the reusable <em>activity type</em> itself -- what
          students physically do (cut, fold, glue, color, drag), and the recurring structural pieces
          (title page, foldable template, answer key) -- so it generalizes across companies and
          subjects. Analyze a few example resources of the same activity type (ideally from
          different sellers), synthesize them into one named Schema, then generate brand-new
          structural content for any new subject. Turning that into a finished visual document is a
          Composer/Asset Modifier/Font Modifier step after, using your own design assets.
        </p>
      </div>

      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 10 }}>📚 Schema Library ({schemas.length})</h2>
        {schemas.length === 0 ? (
          <p style={{ fontSize: 13, color: '#999', fontStyle: 'italic' }}>Nothing saved yet -- build your first schema below.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {schemas.map((s) => {
              let data = {}
              try { data = JSON.parse(s.structural_summary) } catch {}
              return (
                <div key={s.id} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: C.navy, margin: 0 }}>{s.name}</p>
                      <p style={{ fontSize: 11, color: '#999', margin: '2px 0 6px' }}>
                        Built from {s.source_titles?.length || 0} resource(s): {(s.source_titles || []).join(', ')}
                        {s.generation_count > 0 ? ` · used ${s.generation_count}×` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => { setGenFor(genFor === s.id ? null : s.id); setGenResult(null) }}
                      style={{ padding: '5px 12px', background: C.gold, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      🪄 Generate from this Schema
                    </button>
                  </div>
                  <p style={{ fontSize: 12, color: '#555', margin: '0 0 4px' }}>{data.structuralSummary}</p>
                  {data.components?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {data.components.map((c, i) => (
                        <span key={i} title={c.purpose} style={{ fontSize: 10, color: '#333', background: '#f0ece3', borderRadius: 4, padding: '2px 6px' }}>{c.name}</span>
                      ))}
                    </div>
                  )}

                  {genFor === s.id && (
                    <div style={{ marginTop: 10, padding: 12, background: '#fdf8ee', border: `1px solid ${C.border}`, borderRadius: 6 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
                        <input type="text" value={genSubject} onChange={(e) => setGenSubject(e.target.value)} placeholder="Subject (e.g. Photosynthesis)" style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4 }} />
                        <input type="text" value={genGrade} onChange={(e) => setGenGrade(e.target.value)} placeholder="Grade (e.g. 6)" style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4 }} />
                        <input type="text" value={genTopic} onChange={(e) => setGenTopic(e.target.value)} placeholder="Topic/focus (optional)" style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4 }} />
                        <input type="text" value={genJurisdiction} onChange={(e) => setGenJurisdiction(e.target.value)} placeholder="Jurisdiction" style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4 }} />
                      </div>
                      {profiles.length > 0 && (
                        <select value={genStyleProfileId} onChange={(e) => setGenStyleProfileId(e.target.value)} style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 8, width: '100%' }}>
                          <option value="">No style blend (optional)</option>
                          {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      )}
                      <button
                        onClick={() => generateFromSchema(s)}
                        disabled={generating || !genSubject.trim() || !genGrade.trim()}
                        style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: C.navy, border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', opacity: generating || !genSubject.trim() || !genGrade.trim() ? 0.6 : 1 }}
                      >
                        {generating ? 'Generating…' : 'Generate'}
                      </button>
                      {genResult && (
                        genResult.error ? (
                          <p style={{ fontSize: 12, color: C.red, marginTop: 8 }}>{genResult.error}</p>
                        ) : (
                          <div style={{ marginTop: 8 }}>
                            <p style={{ fontSize: 12, color: C.green, marginBottom: 4 }}>
                              ✓ "{genResult.content?.title}" saved to Style Lab
                              {genResult.curriculumConfidence === 'general_knowledge' && (
                                <span style={{ color: '#a06b1f' }}> — not grounded in scraped curriculum data, based on general knowledge</span>
                              )}
                            </p>
                            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, padding: 10, maxHeight: 240, overflow: 'auto' }}>
                              {(genResult.content?.components || []).map((c, i) => (
                                <div key={i} style={{ marginBottom: 8 }}>
                                  <p style={{ fontSize: 11, fontWeight: 700, color: C.navy, margin: 0 }}>{c.name}</p>
                                  <p style={{ fontSize: 11, color: '#444', margin: '2px 0', whiteSpace: 'pre-wrap' }}>{c.content}</p>
                                </div>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                              <a href="/dashboard/style-lab" style={{ fontSize: 11, color: C.navy }}>Open in Style Lab to edit, or Composer to lay it out →</a>
                              <button
                                onClick={() => {
                                  const comps = genResult.content?.components || []
                                  const items = comps.map((c) => ({ label: c.name, content: c.content }))
                                  sessionStorage.setItem('foldableShapePrefill', JSON.stringify({
                                    title: genResult.content?.title, items,
                                  }))
                                  window.location.href = '/dashboard/foldable-shapes'
                                }}
                                style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: '#7a3c8a', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                              >
                                🗂 Render as Foldable
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 4 }}>🔬 Build a New Schema</h3>
        <p style={{ fontSize: 11, color: '#888', margin: '0 0 10px' }}>
          Analyze the activity structure of a few example resources (Style Lab PDFs) -- ideally
          several of the same activity type from different sellers -- then select the analyzed ones
          and give the pattern a name.
        </p>
        {resources.length === 0 ? (
          <p style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>
            No Style Lab resources yet -- import PDFs on the Style Lab page first (interactive
            notebooks, color-by-numbers, task cards, or any other activity type you want to reuse).
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {resources.map((r) => {
              const analyzed = !!r.activity_structure_notes
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px' }}>
                  <input type="checkbox" checked={selectedForSchema.has(r.id)} disabled={!analyzed} onChange={() => toggleSelect(r.id)} title={analyzed ? 'Include in schema' : 'Analyze structure first'} />
                  <span style={{ fontSize: 12, color: '#333', flex: 1, minWidth: 0 }}>{r.title}</span>
                  {analyzed && <span title={r.activity_structure_notes.physicalFormat} style={{ fontSize: 9, color: C.green, background: '#eef6f0', borderRadius: 10, padding: '2px 8px' }}>✓ Analyzed</span>}
                  <button
                    onClick={() => analyzeStructure(r)}
                    disabled={analyzingId === r.id}
                    style={{ fontSize: 10, color: '#7a3c8a', background: '#f5eafa', border: '1px solid #d9b8e8', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}
                  >
                    {analyzingId === r.id ? 'Analyzing…' : analyzed ? '↻ Re-analyze' : 'Analyze Structure'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text" value={schemaName} onChange={(e) => setSchemaName(e.target.value)}
            placeholder='Schema name, e.g. "Interactive Notebook"'
            style={{ flex: 1, minWidth: 200, fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4 }}
          />
          <button
            onClick={synthesize}
            disabled={synthesizing || !schemaName.trim() || selectedForSchema.size === 0}
            style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#7a3c8a', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', opacity: synthesizing || !schemaName.trim() || selectedForSchema.size === 0 ? 0.6 : 1 }}
          >
            {synthesizing ? 'Synthesizing…' : `Synthesize into Schema (${selectedForSchema.size} selected)`}
          </button>
        </div>
        {synthesizeMsg && <p style={{ fontSize: 12, color: synthesizeMsg.startsWith('✓') ? C.green : C.red, marginTop: 6 }}>{synthesizeMsg}</p>}
      </div>
    </div>
  )
}
