'use client'
import { useState, useEffect, useCallback } from 'react'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import { LAYER_META } from '@/lib/style-lab-layers'

// Gallery / Inspiration browse view (Aj, 2026-07-19): "have AI organize
// them by the pre set layers we have made. Then I am able to change the
// organization and look at a live view one at a time... if I am looking
// for inspiration on Visual Layers, I can see a live view of each and can
// flip from one to the next, but when I find one that is especially
// appealing I can 'add it to Visual Layer Processing'." Defaults to the
// Visuals tab per Aj: "The visual layer is extremely important."
//
// Organization comes from the SAME layer_notes Extract Style Layers already
// produces -- a resource shows up under a layer tab only if it has at least
// one INCLUDED observation for that layer. "Change the organization" reuses
// the existing include/exclude toggle already built into Style Lab (toggle
// an observation off there and the resource drops out of that tab here) --
// no separate manual-override system, one source of truth.
export default function GalleryPage() {
  const [userId, setUserId] = useState(null)
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLayer, setSelectedLayer] = useState('visuals')
  const [indexByLayer, setIndexByLayer] = useState({})
  const [previews, setPreviews] = useState({}) // resourceId -> { loading, imageUrl, error }
  const [bulkExtracting, setBulkExtracting] = useState(false)
  const [bulkMsg, setBulkMsg] = useState(null)
  const [processingBusyId, setProcessingBusyId] = useState(null)

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) return
      setUserId(user.id)
      fetch(`/api/style-lab/resources?userId=${user.id}`)
        .then((r) => r.json())
        .then((d) => { setResources(d.resources || []); setLoading(false) })
    })
  }, [])

  const hasLayerNotes = (r) => !!r.layer_notes
  const resourcesForLayer = useCallback((layerKey) => {
    return resources.filter((r) => (r.layer_notes?.[layerKey] || []).some((item) => item.included))
  }, [resources])

  const unanalyzed = resources.filter((r) => !hasLayerNotes(r))
  const currentList = resourcesForLayer(selectedLayer)
  const currentIndex = Math.min(indexByLayer[selectedLayer] || 0, Math.max(0, currentList.length - 1))
  const current = currentList[currentIndex]

  function setIndex(layerKey, idx) {
    setIndexByLayer((prev) => ({ ...prev, [layerKey]: idx }))
  }

  function selectLayer(layerKey) {
    setSelectedLayer(layerKey)
    setIndexByLayer((prev) => ({ ...prev, [layerKey]: 0 }))
  }

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

  async function toggleProcessing(r) {
    setProcessingBusyId(r.id)
    try {
      const res = await fetch('/api/style-lab/resources', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'toggle_processing', id: r.id, marked: !r.marked_for_processing }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setResources((prev) => prev.map((x) => (x.id === r.id ? { ...x, marked_for_processing: d.resource.marked_for_processing } : x)))
    } catch (e) {
      alert(e.message)
    } finally {
      setProcessingBusyId(null)
    }
  }

  function go(delta) {
    const next = currentIndex + delta
    if (next >= 0 && next < currentList.length) setIndex(selectedLayer, next)
  }

  if (loading) return <div style={{ padding: 40, fontFamily: FONT_BODY }}>Loading gallery…</div>

  const activeLayerMeta = LAYER_META.find((l) => l.key === selectedLayer)
  const preview = current ? previews[current.id] : null

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 1240, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>🔍 Browse for Inspiration</h1>
        <a href="/dashboard/style-lab" style={{ fontSize: 12, color: '#888' }}>← Style Lab</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        Modeled on OneNote Class Notebook's Review Student Work pane: pick a layer, pick an item from
        the list, it opens large -- click any other item in the list to jump straight to it, or use
        the arrows to step through in order. When something's especially appealing, flag it for
        Visual Layer Processing -- nothing here is usable until it's saved to Parts Library. To
        change how something's organized, edit its observations on the Style Lab page (uncheck one
        there and it drops out of that tab here).
      </p>

      {unanalyzed.length > 0 && (
        <div style={{ background: '#fdf8ee', border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#555' }}>{unanalyzed.length} resource{unanalyzed.length === 1 ? '' : 's'} not analyzed yet, won&apos;t show up in any tab below.</span>
          <button
            onClick={bulkExtractUnanalyzed} disabled={bulkExtracting}
            style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: C.gold, border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
          >
            {bulkExtracting ? 'Analyzing…' : `🎨 Extract Style Layers for all ${unanalyzed.length}`}
          </button>
          {bulkMsg && <span style={{ fontSize: 11, color: C.green }}>{bulkMsg}</span>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {LAYER_META.map((layer) => {
          const count = resourcesForLayer(layer.key).length
          const isActive = selectedLayer === layer.key
          return (
            <button
              key={layer.key}
              onClick={() => selectLayer(layer.key)}
              title={layer.hint}
              style={{
                fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                border: `1.5px solid ${isActive ? C.gold : C.border}`,
                background: isActive ? '#fdf6ea' : '#fff',
                color: isActive ? C.gold : '#555',
              }}
            >
              {layer.label.replace(' Layer', '')} ({count})
            </button>
          )
        })}
      </div>

      {currentList.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 30, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#999', margin: 0 }}>
            Nothing in your library has an included observation for {activeLayerMeta?.label} yet.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {/* Persistent list, like OneNote's student roster in the Review
              Student Work pane -- click any item to jump straight to it,
              instead of only being able to step one at a time. Aj, 2026-07-19. */}
          <div style={{ flex: '0 0 240px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, background: '#fafafa', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {activeLayerMeta?.label} ({currentList.length})
            </div>
            <div style={{ maxHeight: 640, overflowY: 'auto' }}>
              {currentList.map((r, idx) => {
                const isSelected = idx === currentIndex
                return (
                  <button
                    key={r.id}
                    onClick={() => setIndex(selectedLayer, idx)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px',
                      border: 'none', borderBottom: '1px solid #f0ece3', cursor: 'pointer',
                      background: isSelected ? '#fdf6ea' : '#fff',
                      borderLeft: isSelected ? `3px solid ${C.gold}` : '3px solid transparent',
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: isSelected ? 700 : 500, color: isSelected ? C.gold : '#333', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.marked_for_processing && '🖼 '}{r.title}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Main area -- large, dominant, exactly what OneNote does when
              you click a student's name: the page fills the main view. */}
          <div style={{ flex: '1 1 600px', minWidth: 0, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
            {/* Prominent top nav -- per Aj: "right and left arrow at the top as the
                means for moving from one item to the next." Large, high-contrast,
                impossible to miss. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: `1px solid ${C.border}`, background: C.navy }}>
              <button
                onClick={() => go(-1)} disabled={currentIndex === 0}
                style={{ fontSize: 22, lineHeight: 1, border: 'none', background: 'none', color: '#fff', cursor: currentIndex === 0 ? 'default' : 'pointer', opacity: currentIndex === 0 ? 0.3 : 1, padding: '4px 16px' }}
              >←</button>
              <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{activeLayerMeta?.label} — {currentIndex + 1} of {currentList.length}</span>
              <button
                onClick={() => go(1)} disabled={currentIndex >= currentList.length - 1}
                style={{ fontSize: 22, lineHeight: 1, border: 'none', background: 'none', color: '#fff', cursor: currentIndex >= currentList.length - 1 ? 'default' : 'pointer', opacity: currentIndex >= currentList.length - 1 ? 0.3 : 1, padding: '4px 16px' }}
              >→</button>
            </div>

            {/* Visual, maximized -- this is the whole point of browsing for
                inspiration, per Aj: "Visual Layer maximized naturally." */}
            <div style={{ minHeight: 560, background: '#2b2b2b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              {preview?.loading && <p style={{ fontSize: 12, color: '#ccc' }}>Rendering preview…</p>}
              {preview?.error && <p style={{ fontSize: 12, color: '#ff8080' }}>{preview.error}</p>}
              {preview?.imageUrl && <img src={preview.imageUrl} alt={current.title} style={{ maxWidth: '100%', maxHeight: 700, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }} />}
              {!preview && current?.source_type === 'url' && <p style={{ fontSize: 12, color: '#ccc' }}>URL resource -- no page image to preview.</p>}
            </div>

            {/* Text, minimized -- a slim compact strip, not a competing panel.
                Per Aj: "Live view text minimized naturally." */}
            <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.border}`, background: '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: C.navy, margin: 0 }}>{current?.title}</p>
                {current?.origin === 'tpt_purchase' && (
                  <span style={{ fontSize: 8, fontWeight: 700, color: '#7a3c8a', background: '#f5eafa', border: '1px solid #d9b8e8', borderRadius: 4, padding: '1px 5px' }}>TPT PURCHASE</span>
                )}
                <span style={{ fontSize: 10, color: '#aaa' }}>
                  {(current?.layer_notes?.[selectedLayer] || []).filter((i) => i.included).map((i) => i.text).join(' · ')}
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                  <a href="/dashboard/style-lab" style={{ fontSize: 10, color: '#888' }}>Open in Style Lab →</a>
                  <button
                    onClick={() => toggleProcessing(current)}
                    disabled={processingBusyId === current?.id}
                    style={{
                      padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                      cursor: processingBusyId === current?.id ? 'default' : 'pointer',
                      background: current?.marked_for_processing ? '#eef6f0' : C.gold,
                      color: current?.marked_for_processing ? C.green : '#fff',
                      border: current?.marked_for_processing ? `1px solid ${C.green}` : 'none',
                    }}
                  >
                    {current?.marked_for_processing ? '✓ In Processing' : '🖼 Add to Processing'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
