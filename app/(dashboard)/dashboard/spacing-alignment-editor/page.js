'use client'
import { useState, useEffect } from 'react'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'

// Spacing & Alignment Editor (Aj, 2026-07-19): one of the five style
// categories Product Builder pulls from Parts Library. Unlike Border /
// Section Header / Font / Icon & Illustration -- all real images, all
// handled by the Style Editor (Asset Modifier) -- this one is a layout
// RULE, not a picture: page margins + text alignment, applied when Product
// Builder actually lays out a generated page. Saved as a Parts Library
// entry with no image (kind: 'component', category: 'spacing_alignment'),
// the preset itself serialized into notes as JSON so no schema change was
// needed to store it.
const DEFAULT_PRESET = { marginTop: 54, marginBottom: 54, marginLeft: 54, marginRight: 54, alignment: 'left', lineSpacing: 1.15 }
const PAGE_W = 180, PAGE_H = 233 // preview box, px -- roughly a Letter-page aspect ratio

export default function SpacingAlignmentEditorPage() {
  const [userId, setUserId] = useState(null)
  const [presets, setPresets] = useState([])
  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState(DEFAULT_PRESET)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) return
      setUserId(user.id)
      fetch(`/api/library-parts?userId=${user.id}`)
        .then((r) => r.json())
        .then((d) => setPresets((d.parts || []).filter((p) => p.category === 'spacing_alignment')))
        .finally(() => setLoading(false))
    })
  }, [])

  function setField(key, value) {
    setPreset((p) => ({ ...p, [key]: value }))
  }

  async function savePreset() {
    if (!name.trim() || saving) return
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/library-parts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId, kind: 'component', sourceId: `spacing-alignment:${Date.now()}`,
          title: name.trim(), category: 'spacing_alignment', notes: JSON.stringify(preset),
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Save failed')
      setPresets((prev) => [d.part, ...prev])
      setMsg('Saved to Parts Library ✓')
      setName('')
    } catch (e) {
      setMsg(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function removePreset(id) {
    try {
      await fetch(`/api/library-parts?userId=${userId}&id=${id}`, { method: 'DELETE' })
      setPresets((prev) => prev.filter((p) => p.id !== id))
    } catch (e) {
      alert(e.message)
    }
  }

  function loadPreset(p) {
    try {
      const parsed = JSON.parse(p.notes)
      setPreset({ ...DEFAULT_PRESET, ...parsed })
      setName(p.title)
    } catch {
      alert("Couldn't read this preset's saved data.")
    }
  }

  const scale = 0.9
  const mt = preset.marginTop * scale / 2, mb = preset.marginBottom * scale / 2
  const ml = preset.marginLeft * scale / 2, mr = preset.marginRight * scale / 2
  const justifyToFlex = { left: 'flex-start', center: 'center', right: 'flex-end', justify: 'stretch' }

  if (loading) return <div style={{ padding: 40, fontFamily: FONT_BODY }}>Loading…</div>

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>📐 Spacing & Alignment Editor</h1>
        <a href="/dashboard/product-builder" style={{ fontSize: 12, color: '#888' }}>← Product Builder</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Set page margins, text alignment, and line spacing, then save it as a named preset. Product Builder applies
        whichever preset you pick to every generated page -- this is a layout rule, not an image, so there's nothing
        to draw here.
      </p>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', minWidth: 280 }}>
          <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10 }}>Margins (points -- 72 = 1 inch)</div>
            {['marginTop', 'marginBottom', 'marginLeft', 'marginRight'].map((key) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: '#555' }}>
                <span style={{ width: 90, textTransform: 'capitalize' }}>{key.replace('margin', '')}</span>
                <input
                  type="range" min={0} max={144} value={preset[key]}
                  onChange={(e) => setField(key, Number(e.target.value))}
                  style={{ flex: 1, accentColor: '#2f6b41' }}
                />
                <input
                  type="number" min={0} max={288} value={preset[key]}
                  onChange={(e) => setField(key, Math.max(0, Math.min(288, Number(e.target.value))))}
                  style={{ width: 52, fontSize: 12, padding: '3px 5px', border: `1px solid ${C.border}`, borderRadius: 4, textAlign: 'center' }}
                />
              </label>
            ))}

            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, margin: '16px 0 10px' }}>Text alignment</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {['left', 'center', 'right', 'justify'].map((a) => (
                <button
                  key={a} onClick={() => setField('alignment', a)}
                  style={{
                    flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer',
                    borderRadius: 6, border: `1px solid ${preset.alignment === a ? '#2f6b41' : C.border}`,
                    background: preset.alignment === a ? '#eef6f0' : '#fff', color: preset.alignment === a ? '#2f6b41' : '#555',
                  }}
                >{a}</button>
              ))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Line spacing</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#555' }}>
              <input
                type="range" min={1} max={2} step={0.05} value={preset.lineSpacing}
                onChange={(e) => setField('lineSpacing', Number(e.target.value))}
                style={{ flex: 1, accentColor: '#2f6b41' }}
              />
              <span style={{ width: 36, textAlign: 'center' }}>{preset.lineSpacing.toFixed(2)}×</span>
            </label>
          </div>

          <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginTop: 14 }}>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder='Name this preset, e.g. "Wide Margins, Centered"'
              style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 5, marginBottom: 8, boxSizing: 'border-box' }}
            />
            <button
              onClick={savePreset} disabled={saving || !name.trim()}
              style={{ padding: '7px 16px', background: '#2f6b41', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: saving || !name.trim() ? 0.6 : 1 }}
            >
              {saving ? 'Saving…' : '⭐ Save Preset to Parts Library'}
            </button>
            {msg && <p style={{ fontSize: 11, color: msg.startsWith('Saved') ? '#2f6b41' : '#a33', marginTop: 6 }}>{msg}</p>}
          </div>
        </div>

        <div style={{ flex: '1 1 260px', minWidth: 240 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Live preview</div>
          <div style={{ width: PAGE_W, height: PAGE_H, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', position: 'relative', margin: '0 auto' }}>
            <div style={{
              position: 'absolute', top: mt, bottom: mb, left: ml, right: mr,
              border: '1px dashed #b8dcc2', display: 'flex', flexDirection: 'column',
              justifyContent: 'flex-start', alignItems: justifyToFlex[preset.alignment], gap: 4 * preset.lineSpacing, padding: 4,
            }}>
              {[1, 0.8, 0.9, 0.6].map((w, i) => (
                <div key={i} style={{ height: 5, width: `${w * 100}%`, background: '#c8dcc2', borderRadius: 2 }} />
              ))}
            </div>
          </div>
          <p style={{ fontSize: 10, color: '#aaa', textAlign: 'center', marginTop: 6 }}>Dashed line = text area after margins</p>

          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Saved presets ({presets.length})</div>
            {presets.length === 0 ? (
              <p style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>None yet -- name and save one above.</p>
            ) : (
              presets.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#333', flex: 1, minWidth: 0 }}>{p.title}</span>
                  <button onClick={() => loadPreset(p)} style={{ fontSize: 10, color: '#2f6b41', background: '#eef6f0', border: '1px solid #b8dcc2', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>Load</button>
                  <button onClick={() => removePreset(p.id)} style={{ fontSize: 10, color: '#a33', background: '#fff', border: '1px solid #eecccc', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>Delete</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
