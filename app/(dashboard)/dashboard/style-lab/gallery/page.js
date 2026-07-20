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
    <div style={{ fontFamily: FONT_BODY, maxWidth: 1000, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>🔍 Browse for Inspiration</h1>
        <a href="/dashboard/style-lab" style={{ fontSize: 12, color: '#888' }}>← Style Lab</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        Everything imported into Style Lab, organized by the same layers Extract Style Layers already
        pulls out. Flip through one at a time; when something's especially appealing, flag it for
        Visual Layer Processing -- nothing here is usable until it's actually saved to Parts Library.
        To change how something's organized, go edit its observations on the Style Lab page (uncheck
        one there and it drops out of that tab here).
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
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${C.border}`, background: '#fafafa' }}>
            <button onClick={() => go(-1)} disabled={currentIndex === 0} style={{ fontSize: 18, border: 'none', background: 'none', cursor: currentIndex === 0 ? 'default' : 'pointer', opacity: currentIndex === 0 ? 0.3 : 1 }}>←</button>
            <span style={{ fontSize: 12, color: '#666' }}>{currentIndex + 1} of {currentList.length} -- {activeLayerMeta?.label}</span>
            <button onClick={() => go(1)} disabled={currentIndex >= currentList.length - 1} style={{ fontSize: 18, border: 'none', background: 'none', cursor: currentIndex >= currentList.length - 1 ? 'default' : 'pointer', opacity: currentIndex >= currentList.length - 1 ? 0.3 : 1 }}>→</button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 360px', minHeight: 320, background: '#f7f5f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              {preview?.loading && <p style={{ fontSize: 12, color: '#888' }}>Rendering preview…</p>}
              {preview?.error && <p style={{ fontSize: 12, color: C.red }}>{preview.error}</p>}
              {preview?.imageUrl && <img src={preview.imageUrl} alt={current.title} style={{ maxWidth: '100%', maxHeight: 480, borderRadius: 6, boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }} />}
              {!preview && current?.source_type === 'url' && <p style={{ fontSize: 12, color: '#999' }}>URL resource -- no page image to preview.</p>}
            </div>
            <div style={{ flex: '1 1 320px', padding: 20 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.navy, margin: '0 0 4px' }}>{current?.title}</p>
              {current?.origin === 'tpt_purchase' && (
                <span style={{ fontSize: 9, fontWeight: 700, color: '#7a3c8a', background: '#f5eafa', border: '1px solid #d9b8e8', borderRadius: 4, padding: '1px 6px' }}>TPT PURCHASE</span>
              )}
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{activeLayerMeta?.label}</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#444', lineHeight: 1.6 }}>
                  {(current?.layer_notes?.[selectedLayer] || []).filter((i) => i.included).map((item) => (
                    <li key={item.id}>{item.text}</li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => toggleProcessing(current)}
                disabled={processingBusyId === current?.id}
                style={{
                  marginTop: 18, width: '100%', padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  cursor: processingBusyId === current?.id ? 'default' : 'pointer',
                  background: current?.marked_for_processing ? '#eef6f0' : C.gold,
                  color: current?.marked_for_processing ? C.green : '#fff',
                  border: current?.marked_for_processing ? `1px solid ${C.green}` : 'none',
                }}
              >
                {current?.marked_for_processing ? '✓ In Visual Layer Processing' : '🖼 Add to Visual Layer Processing'}
              </button>
              <a href="/dashboard/style-lab" style={{ display: 'block', textAlign: 'center', fontSize: 11, color: '#888', marginTop: 8 }}>
                Open full resource in Style Lab →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
