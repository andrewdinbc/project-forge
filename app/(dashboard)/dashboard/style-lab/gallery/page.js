'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'

// Visual Layer Live View (Aj, 2026-07-19, after seeing OneNote Class
// Notebook's Review Student Work UI): "I want to only see the Visual Layer
// Live View showing up. This will be in the place where the cougar is in
// the first picture. I want there to be [four] buttons on the right side
// only: Skip, Add to Style Editor, Add to Content Editor, Add to Schema
// Editor... These editors will be located on the side bar. From these
// editors, I make changes... and added to my parts library."
//
// This is a triage queue, not a free-browse gallery: ONE resource at a
// time, the image large and dominant (matching where OneNote puts the
// actual page content), a genuinely separate narrow panel on the right
// (matching OneNote's actual Class Notebook review pane) with exactly four
// actions. No layer tabs here anymore -- every OTHER layer (Structure,
// Interaction, etc.) moved to Content Editor, which is its own destination.
// Skip/any action advances to the next item in the queue.
export default function GalleryPage() {
  const router = useRouter()
  const [userId, setUserId] = useState(null)
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [previews, setPreviews] = useState({})
  const [bulkExtracting, setBulkExtracting] = useState(false)
  const [bulkMsg, setBulkMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) return
      setUserId(user.id)
      fetch(`/api/style-lab/resources?userId=${user.id}`)
        .then((r) => r.json())
        .then((d) => { setResources(d.resources || []); setLoading(false) })
    })
  }, [])

  const hasVisuals = (r) => (r.layer_notes?.visuals || []).some((item) => item.included)
  const unanalyzed = resources.filter((r) => !r.layer_notes)
  const queue = resources.filter(hasVisuals)
  const current = queue[Math.min(currentIndex, Math.max(0, queue.length - 1))]

  async function loadPreview(resource) {
    if (!resource || previews[resource.id]?.imageUrl || previews[resource.id]?.loading) return
    if (resource.visual_analysis?.imageUrl) {
      setPreviews((prev) => ({ ...prev, [resource.id]: { imageUrl: resource.visual_analysis.imageUrl } }))
      return
    }
    setPreviews((prev) => ({ ...prev, [resource.id]: { loading: true } }))
    try {
      const res = await fetch('/api/style-lab/analyze-components', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, resourceId: resource.id, page: 1 }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Preview failed')
      setPreviews((prev) => ({ ...prev, [resource.id]: { imageUrl: d.analysis?.imageUrl } }))
      setResources((prev) => prev.map((x) => (x.id === resource.id ? { ...x, visual_analysis: d.analysis } : x)))
      return d.analysis?.imageUrl
    } catch (e) {
      setPreviews((prev) => ({ ...prev, [resource.id]: { error: e.message } }))
    }
  }

  useEffect(() => {
    if (current) loadPreview(current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  async function bulkExtractUnanalyzed() {
    setBulkExtracting(true)
    setBulkMsg(null)
    let done = 0
    for (const r of unanalyzed) {
      try {
        const res = await fetch('/api/style-lab/extract', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, id: r.id }),
        })
        const d = await res.json()
        if (res.ok) {
          setResources((prev) => prev.map((x) => (x.id === r.id ? { ...x, style_notes: d.styleNotes, layer_notes: d.layers } : x)))
          done++
        }
      } catch {}
      setBulkMsg(`Analyzed ${done} of ${unanalyzed.length}…`)
    }
    setBulkMsg(`✓ Analyzed ${done} of ${unanalyzed.length} resources.`)
    setBulkExtracting(false)
  }

  function skip() {
    setCurrentIndex((i) => Math.min(i + 1, queue.length - 1))
  }

  async function addToStyleEditor() {
    if (!current) return
    setBusy(true)
    try {
      let imageUrl = previews[current.id]?.imageUrl
      if (!imageUrl) imageUrl = await loadPreview(current)
      const params = new URLSearchParams({ title: current.title || 'Asset' })
      if (imageUrl) params.set('assetUrl', imageUrl)
      router.push(`/dashboard/asset-modifier?${params.toString()}`)
    } finally {
      setBusy(false)
    }
  }

  function addToContentEditor() {
    if (!current) return
    router.push(`/dashboard/content-editor?resourceId=${current.id}`)
  }

  function addToSchemaEditor() {
    if (!current) return
    router.push(`/dashboard/schema-lab?preselect=${current.id}`)
  }

  if (loading) return <div style={{ padding: 40, fontFamily: FONT_BODY }}>Loading…</div>

  const preview = current ? previews[current.id] : null

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>🖼 Visual Layer Live View</h1>
        <a href="/dashboard/style-lab" style={{ fontSize: 12, color: '#888' }}>← Style Lab</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        One at a time, starting with the first. Skip past it, or send it to whichever editor you want
        to work on it in -- nothing here is usable until it's actually changed and saved to Parts
        Library from one of those editors.
      </p>

      {unanalyzed.length > 0 && (
        <div style={{ background: '#fdf8ee', border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#555' }}>{unanalyzed.length} resource{unanalyzed.length === 1 ? '' : 's'} not analyzed yet, won&apos;t show up here.</span>
          <button
            onClick={bulkExtractUnanalyzed} disabled={bulkExtracting}
            style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: C.gold, border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
          >
            {bulkExtracting ? 'Analyzing…' : `🎨 Extract Style Layers for all ${unanalyzed.length}`}
          </button>
          {bulkMsg && <span style={{ fontSize: 11, color: C.green }}>{bulkMsg}</span>}
        </div>
      )}

      {queue.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 30, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#999', margin: 0 }}>Nothing in your library has an included Visuals observation yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {/* Main area -- the image only, large and dominant, matching where
              OneNote's own page content (the cougar) sits. */}
          <div style={{ flex: '1 1 700px', minWidth: 0, background: '#fff' }}>
            <div style={{ padding: '12px 20px 6px', borderBottom: `1px solid ${C.border}` }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.navy, margin: 0 }}>{current?.title}</p>
              <p style={{ fontSize: 10, color: '#aaa', margin: '2px 0 0' }}>{currentIndex + 1} of {queue.length}</p>
            </div>
            <div style={{ minHeight: 600, background: '#2b2b2b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              {preview?.loading && <p style={{ fontSize: 12, color: '#ccc' }}>Rendering preview…</p>}
              {preview?.error && <p style={{ fontSize: 12, color: '#ff8080' }}>{preview.error}</p>}
              {preview?.imageUrl && <img src={preview.imageUrl} alt={current.title} style={{ maxWidth: '100%', maxHeight: 720, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }} />}
              {!preview && current?.source_type === 'url' && <p style={{ fontSize: 12, color: '#ccc' }}>URL resource -- no page image to preview.</p>}
            </div>
          </div>

          {/* Right panel -- exactly four buttons, nothing else. Genuinely
              separate from the main area, like OneNote's Class Notebook
              pane sitting to the right of the page content. */}
          <div style={{ flex: '0 0 220px', background: '#fafafa', borderLeft: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={skip} disabled={busy || currentIndex >= queue.length - 1}
              style={{ padding: '10px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#fff', color: '#666', border: `1px solid ${C.border}`, opacity: currentIndex >= queue.length - 1 ? 0.4 : 1 }}
            >
              ⏭ Skip
            </button>
            <button
              onClick={addToStyleEditor} disabled={busy}
              style={{ padding: '10px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#7a3c8a', color: '#fff', border: 'none' }}
            >
              🎨 Add to Style Editor
            </button>
            <button
              onClick={addToContentEditor} disabled={busy}
              style={{ padding: '10px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#2f6b41', color: '#fff', border: 'none' }}
            >
              📖 Add to Content Editor
            </button>
            <button
              onClick={addToSchemaEditor} disabled={busy}
              style={{ padding: '10px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: C.navy, color: '#fff', border: 'none' }}
            >
              🧬 Add to Schema Editor
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
