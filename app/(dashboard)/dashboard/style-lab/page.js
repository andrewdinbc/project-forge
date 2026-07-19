'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import { STYLE_DIALS, defaultDialValues, dialValuesToPromptText } from '@/lib/style-dials'

// Style Lab (moved here from lesson-planner 2026-07-18, per Aj -- this app,
// project-forge, is the real TPT bundle/publishing platform, so the
// content-origination stage belongs here). Every PDF or URL uploaded lands
// here to have its abstract style/format extracted (never content), then
// blended into a personal genre and either pushed into AI steering or
// marked for TPT packaging.
const STATUS_LABELS = {
  raw: { label: 'Not reviewed yet', color: '#999' },
  edited: { label: 'Edited', color: '#a06b1f' },
  pushed_to_steering: { label: '✓ Live in AI Steering', color: '#1a7a3e' },
  marked_for_tpt: { label: '🏷 Marked for TPT', color: '#7a3c8a' },
  tpt_package_ready: { label: '📦 TPT Package Ready', color: '#7a3c8a' },
  published_tpt: { label: '✓ Published on TPT', color: '#1a7a3e' },
}

// The style/format layers we extract (Aj's breakdown, 2026-07-18) --
// Content, Branding, and Credits & Terms are deliberately excluded, see
// the comment block at the top of /api/style-lab/extract.
const LAYER_META = [
  { key: 'visuals', label: 'Visuals Layer', hint: 'Layout, color coding, formatting conventions -- described abstractly, never reproducing actual clipart/icon assets.' },
  { key: 'structure', label: 'Structure Layer', hint: 'Sequencing, scaffolding, differentiation, pacing, grouping, formatting.' },
  { key: 'interaction', label: 'Interaction Layer', hint: 'How students engage, as a generic format -- task cards, drag-and-drop, centers, games.' },
  { key: 'assessmentFormat', label: 'Assessment Layer', hint: 'Format of how understanding is checked -- self-checking, rubric tiers, auto-grading -- not the actual key/rubric content.' },
  { key: 'teacherDirections', label: 'Teacher Directions Layer', hint: 'Format of setup/prep notes, if present.' },
  { key: 'studentDirections', label: 'Student Directions Layer', hint: 'Format of how instructions are presented to students.' },
  { key: 'extension', label: 'Extension Layer', hint: 'Format of any early-finisher/enrichment provision.' },
  { key: 'digital', label: 'Digital Layer', hint: 'Which digital format(s) exist, as a plain fact.' },
]

export default function StyleLabPage() {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState({}) // id -> draft text
  const [busyId, setBusyId] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [extractingId, setExtractingId] = useState(null)
  const [expandedLayer, setExpandedLayer] = useState(null) // `${resourceId}::${layerKey}`
  const [selectedForBlend, setSelectedForBlend] = useState(new Set())
  const [blendName, setBlendName] = useState('')
  const [personalTwist, setPersonalTwist] = useState('')
  const [blending, setBlending] = useState(false)
  const [profiles, setProfiles] = useState([])
  const [profileBusyId, setProfileBusyId] = useState(null)
  const [contentDraft, setContentDraft] = useState({}) // profileId -> {subject, grade, topic, result}
  const [generatingContentId, setGeneratingContentId] = useState(null)
  const [userId, setUserId] = useState(null)
  const [savedToLibrary, setSavedToLibrary] = useState({}) // resourceId -> true, for Parts Library star button
  const router = useRouter()

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (!user) { router.push('/auth/login'); return }
        setUserId(user.id)
      })
      .catch(() => router.push('/auth/login'))
  }, [router])

  useEffect(() => {
    if (!userId) return
    fetch(`/api/style-lab/blend?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => setProfiles(d.profiles || []))
  }, [userId])

  async function extractStylePattern(r) {
    setExtractingId(r.id)
    try {
      const res = await fetch('/api/style-lab/extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, id: r.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResources((prev) => prev.map((x) => (x.id === r.id ? { ...x, style_notes: data.styleNotes, layer_notes: data.layers } : x)))
    } catch (e) {
      alert(`Couldn't extract style pattern: ${e.message}`)
    } finally {
      setExtractingId(null)
    }
  }

  function toggleBlendSelection(id) {
    setSelectedForBlend((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function createBlend() {
    if (!blendName.trim() || selectedForBlend.size === 0) return
    setBlending(true)
    try {
      const res = await fetch('/api/style-lab/blend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: blendName, resourceIds: [...selectedForBlend], personalTwist }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setProfiles((prev) => [data.profile, ...prev])
      setBlendName('')
      setPersonalTwist('')
      setSelectedForBlend(new Set())
    } catch (e) {
      alert(`Couldn't create blend: ${e.message}`)
    } finally {
      setBlending(false)
    }
  }

  async function pushProfileToSteering(profile) {
    setProfileBusyId(profile.id)
    try {
      const res = await fetch('/api/style-lab/push-to-steering', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, id: profile.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setProfiles((prev) => prev.map((p) => (p.id === profile.id ? { ...p, pushed_to_steering_doc_id: data.steering_doc_id } : p)))
    } catch (e) {
      alert(e.message)
    } finally {
      setProfileBusyId(null)
    }
  }

  const dialSaveTimers = useRef({})
  const [reportBusyId, setReportBusyId] = useState(null)

  async function toggleObservation(resourceId, layerKey, observationId, included) {
    setResources((prev) => prev.map((x) => {
      if (x.id !== resourceId) return x
      const layers = { ...(x.layer_notes || {}) }
      layers[layerKey] = (layers[layerKey] || []).map((item) => (item.id === observationId ? { ...item, included } : item))
      return { ...x, layer_notes: layers }
    }))
    try {
      await fetch('/api/style-lab/resources', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, id: resourceId, action: 'toggle_observation', layerKey, observationId, included }),
      })
    } catch { /* local state still reflects the change */ }
  }

  const editSaveTimers = useRef({})
  function editObservationText(resourceId, layerKey, observationId, text) {
    setResources((prev) => prev.map((x) => {
      if (x.id !== resourceId) return x
      const layers = { ...(x.layer_notes || {}) }
      layers[layerKey] = (layers[layerKey] || []).map((item) => (item.id === observationId ? { ...item, text } : item))
      return { ...x, layer_notes: layers }
    }))
    const timerKey = `${resourceId}::${layerKey}::${observationId}`
    if (editSaveTimers.current[timerKey]) clearTimeout(editSaveTimers.current[timerKey])
    editSaveTimers.current[timerKey] = setTimeout(async () => {
      try {
        await fetch('/api/style-lab/resources', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, id: resourceId, action: 'edit_observation', layerKey, observationId, text }),
        })
      } catch { /* local state still reflects the change */ }
    }, 600)
  }

  async function setLayerPreference(resourceId, layerKey, currentPref, newPref) {
    const nextPref = currentPref === newPref ? null : newPref // click again to clear
    setResources((prev) => prev.map((x) => (x.id === resourceId ? { ...x, layer_preferences: { ...(x.layer_preferences || {}), [layerKey]: nextPref } } : x)))
    try {
      await fetch('/api/style-lab/resources', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, id: resourceId, action: 'set_layer_preference', layerKey, preference: nextPref }),
      })
    } catch { /* local state still reflects the change */ }
  }

  async function generateDifferentiationReport(profile) {
    setReportBusyId(profile.id)
    try {
      const res = await fetch('/api/style-lab/differentiation-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, id: profile.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setProfiles((prev) => prev.map((p) => (p.id === profile.id ? { ...p, differentiation_report: data.report } : p)))
    } catch (e) {
      alert(`Couldn't generate report: ${e.message}`)
    } finally {
      setReportBusyId(null)
    }
  }

  function downloadReport(profile) {
    if (!profile.differentiation_report) return
    const blob = new Blob([profile.differentiation_report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${profile.name.replace(/[^a-z0-9]+/gi, '-')}-differentiation-report.txt`
    a.click()
    URL.revokeObjectURL(url)
  }


  function updateDial(profile, dialKey, value) {
    const currentDials = { ...(profile.dial_values || defaultDialValues()), [dialKey]: value }
    setProfiles((prev) => prev.map((p) => (p.id === profile.id ? { ...p, dial_values: currentDials } : p)))

    if (dialSaveTimers.current[profile.id]) clearTimeout(dialSaveTimers.current[profile.id])
    dialSaveTimers.current[profile.id] = setTimeout(async () => {
      try {
        await fetch('/api/style-lab/blend', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, action: 'update_dials', id: profile.id, dialValues: currentDials }),
        })
      } catch { /* transient save failure -- slider still reflects the change locally */ }
    }, 500)
  }

  async function generateOriginalContent(profile) {
    const draft = contentDraft[profile.id] || {}
    if (!draft.subject || !draft.grade) { alert('Pick a subject and the grade the end user wants first.'); return }
    setGeneratingContentId(profile.id)
    try {
      const res = await fetch('/api/style-lab/generate-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, styleProfileId: profile.id, subject: draft.subject, grade: draft.grade, topic: draft.topic, jurisdiction: draft.jurisdiction }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setContentDraft((prev) => ({ ...prev, [profile.id]: { ...draft, result: data.content, curriculumConfidence: data.curriculumConfidence, resultJurisdiction: data.jurisdiction } }))
      // Refresh resources so the newly generated item shows up in Style Lab.
      const r2 = await fetch(`/api/style-lab/resources?userId=${userId}`)
      const d2 = await r2.json()
      setResources(d2.resources || [])
    } catch (e) {
      alert(`Couldn't generate content: ${e.message}`)
    } finally {
      setGeneratingContentId(null)
    }
  }

  useEffect(() => {
    if (!userId) return
    fetch(`/api/style-lab/resources?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => setResources(d.resources || []))
      .finally(() => setLoading(false))
  }, [userId])

  async function bulkImportTpt(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) return
    setImporting(true)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('userId', userId)
      formData.append('action', 'bulk_upload_tpt')
      files.forEach((f) => formData.append('files', f))
      const res = await fetch('/api/style-lab/resources', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResources((prev) => [...(data.imported || []), ...prev])
      setImportResult({ count: data.imported.length, errors: data.errors })
    } catch (e) {
      setImportResult({ count: 0, errors: [{ error: e.message }] })
    } finally {
      setImporting(false)
    }
  }

  function draftFor(r) {
    return editing[r.id] !== undefined ? editing[r.id] : (r.edited_text || r.original_text || '')
  }

  async function saveEdit(r) {
    setBusyId(r.id)
    try {
      await fetch('/api/style-lab/resources', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, id: r.id, action: 'save_edit', editedText: draftFor(r) }),
      })
      setResources((prev) => prev.map((x) => (x.id === r.id ? { ...x, edited_text: draftFor(r), status: 'edited' } : x)))
    } finally {
      setBusyId(null)
    }
  }

  // Parts Library -- stars this resource for reuse across future
  // products, independent of which subject/unit it was originally
  // attached to. Aj, 2026-07-19.
  async function saveToLibrary(r) {
    try {
      const res = await fetch('/api/library-parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId, kind: 'resource', sourceId: r.id,
          title: r.title, category: r.source_type, fileUrl: r.file_url,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to save to library')
      }
      setSavedToLibrary((prev) => ({ ...prev, [r.id]: true }))
    } catch (e) {
      alert(e.message || 'Failed to save to library')
    }
  }

  async function runAction(r, action) {
    setBusyId(r.id)
    try {
      const res = await fetch('/api/style-lab/resources', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, id: r.id, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResources((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: action === 'push_to_steering' ? 'pushed_to_steering' : 'marked_for_tpt' } : x)))
    } catch (e) {
      alert(e.message)
    } finally {
      setBusyId(null)
    }
  }

  async function generateTptPackage(r) {
    setBusyId(r.id)
    try {
      const res = await fetch('/api/style-lab/tpt-package', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, id: r.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResources((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: 'tpt_package_ready', tpt_package: data.tpt_package } : x)))
    } catch (e) {
      alert(`Couldn't generate TPT package: ${e.message}`)
    } finally {
      setBusyId(null)
    }
  }

  function downloadTptPackage(r) {
    const p = r.tpt_package
    if (!p) return
    const text = `PRODUCT TITLE\n${p.productTitle}\n\nDESCRIPTION\n${p.description}\n\nPREVIEW BLURB\n${p.previewBlurb}\n\nSUGGESTED TAGS\n${(p.suggestedTags || []).join(', ')}\n\nSUGGESTED PRICE RANGE\n${p.suggestedPriceRange}\n\n--- SELLER NOTE (not for the public listing) ---\n${p.sellerNote}\n`
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(r.title || 'tpt-package').replace(/[^a-z0-9]+/gi, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div style={{ padding: 40, fontFamily: FONT_BODY }}>Loading…</div>

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
      <h1 style={{ color: C.navy, fontSize: 22, marginBottom: 4 }}>🎨 Style Lab</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
        Everything you've uploaded or linked while building resources lands here. Edit it down to the parts you actually want, then either make it a standing AI preference or flag it for a future TPT listing.
      </p>
      <div style={{ background: '#eef4fb', border: '1px solid #c8dcf0', borderRadius: 8, padding: 12, marginBottom: 20 }}>
        <p style={{ fontSize: 12, color: '#333', margin: 0, lineHeight: 1.5 }}>
          <strong>What this actually does, and how it's different from Composer:</strong> Style Lab
          works with its own separate set of items -- PDFs you upload or import here (including past
          TPT purchases), plus content this page generates -- not the products on your main
          Dashboard. For each item, "Extract Style Layers" reads it and pulls out abstract
          *format* patterns only (layout, pacing, how students interact, formatting conventions) --
          it deliberately never touches or reproduces the actual content/text. You can like/dislike
          or edit individual observations, then select a few items and "Blend" them into a named
          style profile (like combining musical influences into a genre). That blend can be
          fine-tuned with dials, pushed into AI Steering so future generations lean on it
          automatically, or used directly to generate wholly original content in that style for a
          subject/grade you pick. Nothing from your Dashboard products shows up here automatically --
          if you want a product's style available in Style Lab, upload or import it here separately.
          (For mixing actual content pages from existing products into a new hybrid PDF, that's
          Composer, not this page.)
        </p>
      </div>

      {resources.length === 0 && (
        <p style={{ fontSize: 13, color: '#888' }}>Nothing here yet -- upload a PDF or add a URL from the Resources page.</p>
      )}

      <div style={{ background: '#fff', border: '1px solid #d9b8e8', borderRadius: 8, padding: 14, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#7a3c8a', marginBottom: 4 }}>📚 Import Your TPT Purchases</div>
        <p style={{ fontSize: 11, color: '#888', margin: '0 0 8px' }}>
          Upload PDFs of resources you've already bought on TPT -- they'll land here to edit/remix and push into AI Steering, so generation can draw on material you already own. PDF only for now.
        </p>
        <label style={{ display: 'inline-block', padding: '6px 14px', background: '#7a3c8a', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {importing ? 'Importing…' : '📎 Choose PDF(s) to Import'}
          <input
            type="file" accept="application/pdf" multiple style={{ display: 'none' }}
            disabled={importing}
            onChange={(e) => bulkImportTpt(e.target.files)}
          />
        </label>
        {importResult && (
          <div style={{ marginTop: 8, fontSize: 11 }}>
            {importResult.count > 0 && <span style={{ color: '#1a7a3e' }}>✓ Imported {importResult.count} file{importResult.count > 1 ? 's' : ''}.</span>}
            {importResult.errors?.length > 0 && (
              <div style={{ color: '#a33', marginTop: 4 }}>
                {importResult.errors.map((e, i) => <div key={i}>{e.filename ? `${e.filename}: ` : ''}{e.error}</div>)}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ background: '#eef6f0', border: '1px solid #b8dcc2', borderRadius: 8, padding: 14, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#2f6b41', marginBottom: 4 }}>🎨 Blend a Style / Genre</div>
        <p style={{ fontSize: 11, color: '#888', margin: '0 0 8px' }}>
          Extract a STYLE pattern from a resource below (structure, tone, pacing, format only -- never its actual content), then check a few and blend them into your own named genre feel, like combining musical influences. AI generation writes wholly original material in that style -- it never reproduces the source content itself.
        </p>
        {selectedForBlend.size > 0 && (
          <div style={{ marginTop: 8 }}>
            <input
              value={blendName} onChange={(e) => setBlendName(e.target.value)}
              placeholder='Name this blend, e.g. "Playful Rigor"'
              style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid #b8dcc2', borderRadius: 5, marginBottom: 6, boxSizing: 'border-box' }}
            />
            <textarea
              value={personalTwist} onChange={(e) => setPersonalTwist(e.target.value)}
              placeholder="Optional: your own personal twist to layer in, e.g. 'more collaborative, less worksheet-heavy'"
              rows={2}
              style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid #b8dcc2', borderRadius: 5, marginBottom: 6, boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
            <button
              onClick={createBlend} disabled={blending || !blendName.trim()}
              style={{ padding: '6px 14px', background: '#2f6b41', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              {blending ? 'Blending…' : `Blend ${selectedForBlend.size} Style${selectedForBlend.size > 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>

      {profiles.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Your Style Blends</div>
          {profiles.map((p) => (
            <div key={p.id} style={{ background: '#fff', border: '1px solid #b8dcc2', borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2f6b41' }}>{p.name}</div>
              <p style={{ fontSize: 12, color: '#555', margin: '4px 0' }}>{p.blended_style_text}</p>
              <button
                onClick={() => pushProfileToSteering(p)} disabled={profileBusyId === p.id || !!p.pushed_to_steering_doc_id}
                style={{ padding: '5px 12px', background: C.gold, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: p.pushed_to_steering_doc_id ? 'default' : 'pointer', opacity: p.pushed_to_steering_doc_id ? 0.6 : 1 }}
              >
                {p.pushed_to_steering_doc_id ? '✓ In AI Steering' : '→ Push to AI Steering'}
              </button>

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e6e0d5' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
                  🎛️ Fine-tune this blend
                </div>
                {STYLE_DIALS.map((dial) => {
                  const value = (p.dial_values || defaultDialValues())[dial.key]
                  const source = p.source_dial_estimates?.[dial.key]
                  const delta = typeof source === 'number' ? value - source : null
                  return (
                    <div key={dial.key} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888', marginBottom: 2 }}>
                        <span>{dial.loLabel}</span>
                        <span style={{ fontWeight: 700, color: '#2f6b41' }}>{dial.label}</span>
                        <span>{dial.hiLabel}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="range" min={0} max={100} value={value}
                          onChange={(e) => updateDial(p, dial.key, Number(e.target.value))}
                          style={{ flex: 1, accentColor: '#2f6b41' }}
                        />
                        <input
                          type="number" min={0} max={100} value={value}
                          onChange={(e) => updateDial(p, dial.key, Math.max(0, Math.min(100, Number(e.target.value))))}
                          style={{ width: 44, fontSize: 11, padding: '2px 4px', border: '1px solid #b8dcc2', borderRadius: 4, textAlign: 'center' }}
                        />
                        {delta !== null && delta !== 0 && (
                          <span style={{ fontSize: 9, color: '#a06b1f', whiteSpace: 'nowrap', minWidth: 68 }}>
                            {delta > 0 ? '+' : ''}{delta} vs source
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Live view -- shows the EXACT text these dial settings turn
                    into at generation time (lib/style-dials.js
                    dialValuesToPromptText), updating instantly on every drag
                    since it's a pure client-side computation, no AI call.
                    Per Aj, 2026-07-19: "I want to see what that looks like
                    live" -- for Style Lab specifically, since dials are
                    directives (HOW something gets written), not literal
                    pages, the meaningful "live view" is the actual
                    instruction text this behavior produces, not a rendered
                    document (that only exists once real content gets
                    generated from it). */}
                <div style={{ marginTop: 10, padding: 10, background: '#f7f5f0', border: '1px dashed #b8dcc2', borderRadius: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#2f6b41', marginBottom: 4 }}>
                    👁 Live view -- what this actually tells the AI
                  </div>
                  <pre style={{ fontSize: 10, color: '#555', whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
                    {dialValuesToPromptText(p.dial_values || defaultDialValues()) || '(All dials near neutral -- no strong directives yet. Move a slider to see it appear here.)'}
                  </pre>
                </div>
              </div>

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e6e0d5' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 4 }}>
                  📋 Legal Documentation
                </div>
                <p style={{ fontSize: 10, color: '#999', margin: '0 0 6px' }}>
                  Generates a factual record of exactly how far this blend's dial values diverge from the averaged source material, plus which elements you flagged like/dislike. For your own recordkeeping -- not legal advice.
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => generateDifferentiationReport(p)} disabled={reportBusyId === p.id}
                    style={{ padding: '5px 12px', background: '#fff', border: '1px solid #a06b1f', color: '#a06b1f', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {reportBusyId === p.id ? 'Generating…' : p.differentiation_report ? '↻ Regenerate Report' : '📋 Generate Differentiation Report'}
                  </button>
                  {p.differentiation_report && (
                    <button
                      onClick={() => downloadReport(p)}
                      style={{ padding: '5px 12px', background: '#a06b1f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                      ⬇ Download
                    </button>
                  )}
                </div>
                {p.differentiation_report && (
                  <pre style={{ marginTop: 8, fontSize: 10, color: '#555', background: '#f7f5f0', border: '1px solid #e6e0d5', borderRadius: 6, padding: 8, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
                    {p.differentiation_report}
                  </pre>
                )}
              </div>

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e6e0d5' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 4 }}>
                  Generate original content in this style
                </div>
                <p style={{ fontSize: 10, color: '#999', margin: '0 0 6px' }}>
                  Content is written fresh for the grade the end user picks below -- grounded in the real BC curriculum for that grade, never taken from any uploaded/purchased resource.
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  <input
                    placeholder="Subject, e.g. Mathematics"
                    value={contentDraft[p.id]?.subject || ''}
                    onChange={(e) => setContentDraft((prev) => ({ ...prev, [p.id]: { ...prev[p.id], subject: e.target.value } }))}
                    style={{ flex: 1, minWidth: 140, fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }}
                  />
                  <select
                    value={contentDraft[p.id]?.grade || ''}
                    onChange={(e) => setContentDraft((prev) => ({ ...prev, [p.id]: { ...prev[p.id], grade: e.target.value } }))}
                    style={{ fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5 }}
                  >
                    <option value="">Grade (end user picks)</option>
                    {['K', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((g) => <option key={g} value={g}>Grade {g}</option>)}
                  </select>
                </div>
                <input
                  placeholder="Curriculum jurisdiction -- e.g. 'British Columbia, Canada', 'Ontario, Canada', 'Texas, USA', 'Australia'"
                  value={contentDraft[p.id]?.jurisdiction || ''}
                  onChange={(e) => setContentDraft((prev) => ({ ...prev, [p.id]: { ...prev[p.id], jurisdiction: e.target.value } }))}
                  style={{ width: '100%', fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5, marginBottom: 6, boxSizing: 'border-box' }}
                />
                <p style={{ fontSize: 9, color: '#aaa', margin: '-4px 0 6px' }}>
                  Defaults to British Columbia, Canada if left blank. BC content is grounded in scraped Ministry data; other jurisdictions rely on general model knowledge of that region's standards -- worth double-checking against the official curriculum document.
                </p>
                <input
                  placeholder="Optional topic/focus"
                  value={contentDraft[p.id]?.topic || ''}
                  onChange={(e) => setContentDraft((prev) => ({ ...prev, [p.id]: { ...prev[p.id], topic: e.target.value } }))}
                  style={{ width: '100%', fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5, marginBottom: 6, boxSizing: 'border-box' }}
                />
                <button
                  onClick={() => generateOriginalContent(p)} disabled={generatingContentId === p.id}
                  style={{ padding: '6px 14px', background: '#2f6b41', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                >
                  {generatingContentId === p.id ? 'Generating…' : '✨ Generate Original Content'}
                </button>
                {contentDraft[p.id]?.result && (
                  <div style={{ marginTop: 8, background: '#f7f5f0', border: `1px solid ${C.border}`, borderRadius: 6, padding: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.navy }}>{contentDraft[p.id].result.title}</div>
                    <p style={{ fontSize: 10, color: '#1a7a3e', margin: '2px 0 6px' }}>✓ Saved to Forge as a new, wholly original resource</p>
                    {contentDraft[p.id].curriculumConfidence === 'general_knowledge' && (
                      <p style={{ fontSize: 10, color: '#a06b1f', margin: '0 0 6px' }}>
                        ⚠ {contentDraft[p.id].resultJurisdiction} isn't grounded in scraped official curriculum data -- based on general knowledge, worth double-checking against the real standard.
                      </p>
                    )}
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#555' }}>
                      {contentDraft[p.id].result.items.map((item, i) => (
                        <li key={i} style={{ marginBottom: 3 }}><em>[{item.type}]</em> {item.text}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {resources.map((r) => {
        const statusInfo = STATUS_LABELS[r.status] || STATUS_LABELS.raw
        return (
          <div key={r.id} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <input
                  type="checkbox" checked={selectedForBlend.has(r.id)} onChange={() => toggleBlendSelection(r.id)}
                  disabled={!r.layer_notes}
                  title={r.layer_notes ? 'Select for style blend' : 'Extract style layers first'}
                  style={{ marginTop: 4 }}
                />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>
                    {r.title} <span style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>({r.source_type === 'pdf' ? 'PDF' : 'URL'})</span>
                    {r.origin === 'tpt_purchase' && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#7a3c8a', background: '#f5eafa', border: '1px solid #d9b8e8', borderRadius: 4, padding: '1px 6px', marginLeft: 6 }}>
                        📚 TPT Purchase
                      </span>
                    )}
                    {r.origin === 'ai_generated_original' && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#2f6b41', background: '#eef6f0', border: '1px solid #b8dcc2', borderRadius: 4, padding: '1px 6px', marginLeft: 6 }}>
                        ✨ Original, AI-Generated
                      </span>
                    )}
                  </div>
                  {r.source_url && <a href={r.source_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#888' }}>{r.source_url}</a>}
                  {r.file_url && <a href={r.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#2f6b41', marginLeft: r.source_url ? 8 : 0 }}>📄 View original file</a>}
                  {(r.subject || r.unit_name) && (
                    <div style={{ fontSize: 11, color: '#999' }}>{[r.subject, r.unit_name].filter(Boolean).join(' — ')}</div>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: statusInfo.color, whiteSpace: 'nowrap' }}>{statusInfo.label}</span>
            </div>

            <div style={{ marginBottom: 8 }}>
              <button
                onClick={() => extractStylePattern(r)} disabled={extractingId === r.id}
                style={{ padding: '4px 10px', background: '#fff', border: '1px solid #b8dcc2', color: '#2f6b41', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                {extractingId === r.id ? 'Extracting…' : r.layer_notes ? '🎨 Re-extract Style Layers' : '🎨 Extract Style Layers'}
              </button>
              {r.layer_notes && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 6 }}>
                  <div style={{ flex: '1 1 340px', minWidth: 0 }}>
                  {LAYER_META.map((layer) => {
                    const items = Array.isArray(r.layer_notes[layer.key]) ? r.layer_notes[layer.key] : []
                    if (!items.length) return null
                    const expandKey = `${r.id}::${layer.key}`
                    const isExpanded = expandedLayer === expandKey
                    const pref = (r.layer_preferences || {})[layer.key]
                    return (
                      <div key={layer.key} style={{ fontSize: 11, color: '#2f6b41', background: '#eef6f0', border: `1px solid ${pref === 'like' ? '#4a8a5f' : pref === 'dislike' ? '#c47a7a' : '#b8dcc2'}`, borderRadius: 5, padding: '5px 8px', marginTop: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <button
                            onClick={() => setExpandedLayer(isExpanded ? null : expandKey)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', flex: 1 }}
                          >
                            <strong>• {layer.label}</strong>{' '}
                            <span style={{ color: '#4a8a5f', textDecoration: 'underline', fontSize: 10 }}>
                              {isExpanded ? 'Hide' : 'Explore this layer →'}
                            </span>
                          </button>
                          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                            <button
                              onClick={() => setLayerPreference(r.id, layer.key, pref, 'like')}
                              title="I like this layer overall -- emphasize it in blends"
                              style={{ background: pref === 'like' ? '#4a8a5f' : '#fff', color: pref === 'like' ? '#fff' : '#4a8a5f', border: '1px solid #4a8a5f', borderRadius: 4, fontSize: 11, padding: '2px 6px', cursor: 'pointer' }}
                            >👍</button>
                            <button
                              onClick={() => setLayerPreference(r.id, layer.key, pref, 'dislike')}
                              title="I dislike this layer overall -- avoid it in blends"
                              style={{ background: pref === 'dislike' ? '#c47a7a' : '#fff', color: pref === 'dislike' ? '#fff' : '#c47a7a', border: '1px solid #c47a7a', borderRadius: 4, fontSize: 11, padding: '2px 6px', cursor: 'pointer' }}
                            >👎</button>
                          </div>
                        </div>

                        <div style={{ marginTop: 4 }}>
                          {items.map((item) => (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', opacity: item.included ? 1 : 0.4 }}>
                              <input
                                type="checkbox" checked={item.included}
                                onChange={(e) => toggleObservation(r.id, layer.key, item.id, e.target.checked)}
                                title={item.included ? 'Included -- click to exclude' : 'Excluded -- click to include'}
                              />
                              <input
                                value={item.text}
                                onChange={(e) => editObservationText(r.id, layer.key, item.id, e.target.value)}
                                style={{ flex: 1, fontSize: 11, padding: '2px 6px', border: '1px solid #b8dcc2', borderRadius: 4, background: '#fff', textDecoration: item.included ? 'none' : 'line-through' }}
                              />
                            </div>
                          ))}
                        </div>

                        {isExpanded && (
                          <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid #b8dcc2', fontSize: 10, color: '#5a8a68', fontStyle: 'italic' }}>
                            {layer.hint} Uncheck any item above to exclude it from blends and future generation, or edit its text directly -- changes save automatically.
                          </div>
                        )}
                      </div>
                    )
                  })}
                  </div>
                  <div style={{ flex: '1 1 260px', minWidth: 0, position: 'sticky', top: 12, alignSelf: 'flex-start' }}>
                    {(() => {
                      const layersOut = LAYER_META
                        .map((layer) => {
                          const items = (Array.isArray(r.layer_notes[layer.key]) ? r.layer_notes[layer.key] : []).filter((it) => it.included)
                          return items.length ? { key: layer.key, label: layer.label, items } : null
                        })
                        .filter(Boolean)
                      return (
                        <div style={{ padding: 10, background: '#f7f5f0', border: '1px dashed #b8dcc2', borderRadius: 6 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#2f6b41', marginBottom: 6 }}>
                            👁 Live view — the style with your current selections
                          </div>
                          {layersOut.length === 0 ? (
                            <div style={{ fontSize: 11, color: '#999' }}>
                              Nothing selected — every observation is unchecked, so this resource would contribute no style. Check items on the left to build it back up.
                            </div>
                          ) : (
                            layersOut.map((L) => (
                              <div key={L.key} style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: C.navy, marginBottom: 2 }}>{L.label}</div>
                                <ul style={{ margin: 0, paddingLeft: 16 }}>
                                  {L.items.map((it) => (
                                    <li key={it.id} style={{ fontSize: 11, color: '#555', marginBottom: 1 }}>{it.text}</li>
                                  ))}
                                </ul>
                              </div>
                            ))
                          )}
                          <div style={{ fontSize: 9, color: '#999', marginTop: 6, borderTop: '1px solid #e6e0d5', paddingTop: 4 }}>
                            Uncheck an item on the left and it disappears here; uncheck a whole layer and it drops out entirely. This is exactly the included-observation set that feeds a blend / AI Steering.
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>

            <textarea
              value={draftFor(r)}
              onChange={(e) => setEditing((prev) => ({ ...prev, [r.id]: e.target.value }))}
              rows={6}
              style={{ width: '100%', fontSize: 12, padding: 8, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => saveToLibrary(r)} disabled={!!savedToLibrary[r.id]}
                title={savedToLibrary[r.id] ? 'Saved to Parts Library' : 'Save to Parts Library'}
                style={{ padding: '5px 10px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, cursor: savedToLibrary[r.id] ? 'default' : 'pointer' }}
              >
                {savedToLibrary[r.id] ? '⭐' : '☆'}
              </button>
              <button
                onClick={() => saveEdit(r)} disabled={busyId === r.id}
                style={{ padding: '5px 12px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, cursor: 'pointer' }}
              >
                Save Edit
              </button>
              <button
                onClick={() => runAction(r, 'push_to_steering')} disabled={busyId === r.id || r.status === 'pushed_to_steering'}
                style={{ padding: '5px 12px', background: C.gold, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: r.status === 'pushed_to_steering' ? 'default' : 'pointer', opacity: r.status === 'pushed_to_steering' ? 0.6 : 1 }}
              >
                {r.status === 'pushed_to_steering' ? '✓ In AI Steering' : '→ Push to AI Steering'}
              </button>
              <button
                onClick={() => runAction(r, 'mark_for_tpt')} disabled={busyId === r.id || ['marked_for_tpt', 'tpt_package_ready'].includes(r.status)}
                style={{ padding: '5px 12px', background: '#7a3c8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: ['marked_for_tpt', 'tpt_package_ready'].includes(r.status) ? 'default' : 'pointer', opacity: ['marked_for_tpt', 'tpt_package_ready'].includes(r.status) ? 0.6 : 1 }}
              >
                {['marked_for_tpt', 'tpt_package_ready'].includes(r.status) ? '🏷 Marked for TPT' : '🏷 Mark for TPT'}
              </button>
              {['marked_for_tpt', 'tpt_package_ready'].includes(r.status) && (
                <button
                  onClick={() => generateTptPackage(r)} disabled={busyId === r.id}
                  style={{ padding: '5px 12px', background: '#fff', border: '1px solid #7a3c8a', color: '#7a3c8a', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                >
                  {busyId === r.id ? 'Generating…' : r.tpt_package ? '↻ Regenerate TPT Package' : '📦 Generate TPT Package'}
                </button>
              )}
            </div>

            {r.tpt_package && (
              <div style={{ marginTop: 10, background: '#f5eafa', border: '1px solid #d9b8e8', borderRadius: 6, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#7a3c8a', marginBottom: 6 }}>TPT Listing Prep -- copy/paste into your TPT listing form</div>
                <div style={{ fontSize: 11, color: '#444', marginBottom: 4 }}><strong>Title:</strong> {r.tpt_package.productTitle}</div>
                <div style={{ fontSize: 11, color: '#444', marginBottom: 4, whiteSpace: 'pre-wrap' }}><strong>Description:</strong> {r.tpt_package.description}</div>
                <div style={{ fontSize: 11, color: '#444', marginBottom: 4 }}><strong>Preview blurb:</strong> {r.tpt_package.previewBlurb}</div>
                <div style={{ fontSize: 11, color: '#444', marginBottom: 4 }}><strong>Tags:</strong> {(r.tpt_package.suggestedTags || []).join(', ')}</div>
                <div style={{ fontSize: 11, color: '#444', marginBottom: 8 }}><strong>Suggested price:</strong> {r.tpt_package.suggestedPriceRange}</div>
                <div style={{ fontSize: 10, color: '#888', fontStyle: 'italic', marginBottom: 8 }}>Seller note (not part of the listing): {r.tpt_package.sellerNote}</div>
                <button
                  onClick={() => downloadTptPackage(r)}
                  style={{ padding: '5px 12px', background: '#7a3c8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                >
                  ⬇ Download as .txt
                </button>
                <p style={{ fontSize: 10, color: '#999', marginTop: 6, marginBottom: 0 }}>
                  There's no automatic publishing to TPT -- you still create and publish the actual listing yourself on teacherspayteachers.com. This is prep copy only.
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
