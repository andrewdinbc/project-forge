'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import { LAYER_META } from '@/lib/style-lab-layers'

// Content Editor (Aj, 2026-07-19): one of three destinations reachable from
// the Visual Layer Live View ("Add to Content Editor"), alongside Style
// Editor (Asset Modifier) and Schema Editor (Schema Lab). Where Visual Layer
// Live View is only ever about the Visuals layer, Content Editor is
// everything else -- Structure, Interaction, Assessment, Teacher/Student
// Directions, Extension, Digital -- each with "Explore this layer →" and
// 👍/👎, exactly the same per-layer preference UI already built into Style
// Lab's inline resource cards, just promoted to its own focused destination
// instead of being buried in a long list alongside every other resource.
const CONTENT_LAYERS = LAYER_META.filter((l) => l.key !== 'visuals')

export default function ContentEditorPage() {
  const searchParams = useSearchParams()
  const resourceIdParam = searchParams.get('resourceId')
  const [userId, setUserId] = useState(null)
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(resourceIdParam)
  const [expandedLayer, setExpandedLayer] = useState(null)
  const [extracting, setExtracting] = useState(false)

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) return
      setUserId(user.id)
      fetch(`/api/style-lab/resources?userId=${user.id}`)
        .then((r) => r.json())
        .then((d) => { setResources(d.resources || []); setLoading(false) })
    })
  }, [])

  const current = resources.find((r) => r.id === selectedId)

  async function extractLayers() {
    if (!current) return
    setExtracting(true)
    try {
      const res = await fetch('/api/style-lab/extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, id: current.id }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Extraction failed')
      setResources((prev) => prev.map((x) => (x.id === current.id ? { ...x, style_notes: d.styleNotes, layer_notes: d.layers } : x)))
    } catch (e) {
      alert(e.message)
    } finally {
      setExtracting(false)
    }
  }

  async function toggleObservation(layerKey, observationId, included) {
    setResources((prev) => prev.map((x) => {
      if (x.id !== current.id) return x
      const layers = { ...(x.layer_notes || {}) }
      layers[layerKey] = (layers[layerKey] || []).map((item) => (item.id === observationId ? { ...item, included } : item))
      return { ...x, layer_notes: layers }
    }))
    try {
      await fetch('/api/style-lab/resources', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, id: current.id, action: 'toggle_observation', layerKey, observationId, included }),
      })
    } catch {}
  }

  async function toggleLayer(layerKey, items, included) {
    setResources((prev) => prev.map((x) => {
      if (x.id !== current.id) return x
      const layers = { ...(x.layer_notes || {}) }
      layers[layerKey] = (layers[layerKey] || []).map((item) => ({ ...item, included }))
      return { ...x, layer_notes: layers }
    }))
    await Promise.all((items || []).map((it) =>
      fetch('/api/style-lab/resources', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, id: current.id, action: 'toggle_observation', layerKey, observationId: it.id, included }),
      }).catch(() => {})
    ))
  }

  async function setLayerPreference(layerKey, currentPref, newPref) {
    const nextPref = currentPref === newPref ? null : newPref
    setResources((prev) => prev.map((x) => (x.id === current.id ? { ...x, layer_preferences: { ...(x.layer_preferences || {}), [layerKey]: nextPref } } : x)))
    try {
      await fetch('/api/style-lab/resources', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, id: current.id, action: 'set_layer_preference', layerKey, preference: nextPref }),
      })
    } catch {}
  }

  if (loading) return <div style={{ padding: 40, fontFamily: FONT_BODY }}>Loading…</div>

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 800, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>📖 Content Editor</h1>
        <a href="/dashboard/style-lab/gallery" style={{ fontSize: 12, color: '#888' }}>← Visual Layer Live View</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Everything except Visuals -- Structure, Interaction, Assessment, Teacher/Student Directions,
        Extension, Digital. Explore a layer to see its individual observations, 👍/👎 a whole layer to
        weight it in future blends.
      </p>

      {!current ? (
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>Pick a resource:</p>
          {resources.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', borderBottom: '1px solid #f0ece3', background: '#fff', cursor: 'pointer', fontSize: 13 }}
            >
              {r.title}
            </button>
          ))}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: C.navy, margin: 0 }}>{current.title}</p>
            <button onClick={() => setSelectedId(null)} style={{ fontSize: 11, color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>Change resource</button>
          </div>

          {!current.layer_notes ? (
            <div style={{ background: '#fdf8ee', border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>This resource hasn't been analyzed yet.</p>
              <button
                onClick={extractLayers} disabled={extracting}
                style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#2f6b41', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}
              >
                {extracting ? 'Extracting…' : '🎨 Extract Style Layers'}
              </button>
            </div>
          ) : (
            <div>
              {CONTENT_LAYERS.map((layer) => {
                const items = Array.isArray(current.layer_notes[layer.key]) ? current.layer_notes[layer.key] : []
                if (!items.length) return null
                const isExpanded = expandedLayer === layer.key
                const pref = (current.layer_preferences || {})[layer.key]
                const allIncluded = items.length > 0 && items.every((i) => i.included)
                const someIncluded = items.some((i) => i.included)
                return (
                  <div key={layer.key} style={{ background: '#eef6f0', border: `1px solid ${pref === 'like' ? '#4a8a5f' : pref === 'dislike' ? '#c47a7a' : '#b8dcc2'}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={allIncluded}
                        ref={(el) => { if (el) el.indeterminate = someIncluded && !allIncluded }}
                        onChange={(e) => toggleLayer(layer.key, items, e.target.checked)}
                        style={{ marginTop: 3, flexShrink: 0 }}
                      />
                      <button
                        onClick={() => setExpandedLayer(isExpanded ? null : layer.key)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', flex: 1 }}
                      >
                        <strong style={{ fontSize: 13, color: '#2f6b41' }}>• {layer.label}</strong>{' '}
                        <span style={{ color: '#4a8a5f', textDecoration: 'underline', fontSize: 11 }}>
                          {isExpanded ? 'Hide' : 'Explore this layer →'}
                        </span>
                      </button>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => setLayerPreference(layer.key, pref, 'like')}
                          title="I like this layer overall -- emphasize it in blends"
                          style={{ background: pref === 'like' ? '#4a8a5f' : '#fff', color: pref === 'like' ? '#fff' : '#4a8a5f', border: '1px solid #4a8a5f', borderRadius: 4, fontSize: 13, padding: '2px 8px', cursor: 'pointer' }}
                        >👍</button>
                        <button
                          onClick={() => setLayerPreference(layer.key, pref, 'dislike')}
                          title="I dislike this layer overall -- avoid it in blends"
                          style={{ background: pref === 'dislike' ? '#c47a7a' : '#fff', color: pref === 'dislike' ? '#fff' : '#c47a7a', border: '1px solid #c47a7a', borderRadius: 4, fontSize: 13, padding: '2px 8px', cursor: 'pointer' }}
                        >👎</button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ marginTop: 8, paddingLeft: 22 }}>
                        {items.map((item) => (
                          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', opacity: item.included ? 1 : 0.4 }}>
                            <input
                              type="checkbox" checked={item.included}
                              onChange={(e) => toggleObservation(layer.key, item.id, e.target.checked)}
                            />
                            <span style={{ fontSize: 12, color: '#333' }}>{item.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              <a href="/dashboard/style-lab" style={{ fontSize: 11, color: '#888', display: 'block', marginTop: 10 }}>
                Select a few resources and blend them into a Style Profile on the Style Lab page →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
