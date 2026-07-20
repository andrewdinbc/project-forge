'use client'
import { useState, useEffect } from 'react'
import { STYLE_CATEGORIES } from '@/lib/product-builder-categories'

// Needs Review (Aj, 2026-07-19): "I dont want that... The parts library is
// only for after going through style lab and been changed by me for
// copyright purposes." Raw Separator extractions (border/section header/
// icon/palette crops -- actual pixels from someone else's PDF) land here,
// pending_review=true, excluded from every normal Parts Library view.
// Edit opens the Style Editor with ?fromPending=1; a successful save there
// deletes this pending row (the edited result is a new, separate,
// non-pending library item). Dismiss throws one away unedited.
//
// Bulk edit (Aj, 2026-07-20): "make a component... where I can request
// changes and additions to different parts in the needs review section
// so we can modify them in bulk... picking up on the patterns I work
// through, remembering them and replicating the same level of
// modification... in order to do it more autonomously afterwards."
// Select multiple items, type one instruction, apply it to all of them
// via the same FLUX Kontext edit the single-item Asset Modifier already
// uses (/api/library-parts/bulk-edit). Every batch is logged as a
// pattern (/api/library-parts/pattern-suggestions), so the box pre-fills
// with what Aj has actually done before for that category on future
// batches -- a real memory of his own edit habits, not a guess.
export default function PendingReview({ userId, refreshKey }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [instruction, setInstruction] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [applying, setApplying] = useState(false)
  const [batchMsg, setBatchMsg] = useState(null)
  const [localRefresh, setLocalRefresh] = useState(0)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    fetch(`/api/library-parts?userId=${userId}&pendingOnly=1`)
      .then((r) => r.json())
      .then((d) => setItems(d.parts || []))
      .finally(() => setLoading(false))
  }, [userId, refreshKey, localRefresh])

  const selectedItems = items.filter((p) => selected.has(p.id))
  const selectedCategories = new Set(selectedItems.map((p) => p.category))
  const singleCategory = selectedCategories.size === 1 ? [...selectedCategories][0] : null

  useEffect(() => {
    if (!userId || !singleCategory) { setSuggestions([]); return }
    fetch(`/api/library-parts/pattern-suggestions?userId=${userId}&category=${encodeURIComponent(singleCategory)}`)
      .then((r) => r.json())
      .then((d) => setSuggestions(d.patterns || []))
      .catch(() => setSuggestions([]))
  }, [userId, singleCategory])

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function selectAllInCategory(catItems) {
    setSelected((prev) => {
      const next = new Set(prev)
      const allIn = catItems.every((p) => next.has(p.id))
      catItems.forEach((p) => { if (allIn) next.delete(p.id); else next.add(p.id) })
      return next
    })
  }

  async function dismiss(id) {
    setBusyId(id)
    try {
      await fetch(`/api/library-parts?userId=${userId}&id=${id}`, { method: 'DELETE' })
      setItems((prev) => prev.filter((p) => p.id !== id))
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next })
    } finally {
      setBusyId(null)
    }
  }

  async function bulkDismiss() {
    setApplying(true); setBatchMsg(null)
    try {
      await Promise.all([...selected].map((id) => fetch(`/api/library-parts?userId=${userId}&id=${id}`, { method: 'DELETE' })))
      setItems((prev) => prev.filter((p) => !selected.has(p.id)))
      setBatchMsg(`Dismissed ${selected.size} item(s).`)
      setSelected(new Set())
    } finally {
      setApplying(false)
    }
  }

  async function applyBulkEdit() {
    if (!instruction.trim() || selected.size === 0) return
    setApplying(true); setBatchMsg(null)
    try {
      const res = await fetch('/api/library-parts/bulk-edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, partIds: [...selected], instruction: instruction.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Bulk edit failed')
      setBatchMsg(`Applied to ${data.succeeded} of ${data.succeeded + data.failed}. ${data.failed > 0 ? `${data.failed} failed -- left in Needs Review.` : 'Everything else moved to your real Parts Library.'}`)
      setSelected(new Set())
      setInstruction('')
      setLocalRefresh((n) => n + 1)
    } catch (e) {
      setBatchMsg(e.message)
    } finally {
      setApplying(false)
    }
  }

  if (loading || items.length === 0) return null

  const byCategory = {}
  for (const item of items) {
    (byCategory[item.category] = byCategory[item.category] || []).push(item)
  }

  return (
    <div style={{ background: '#fdf8ee', border: '1px solid #e8d9b0', borderRadius: 8, padding: 16, marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#a06b1f', marginBottom: 4 }}>
        ⚠️ Needs Review ({items.length})
      </div>
      <p style={{ fontSize: 11, color: '#8a6d3b', margin: '0 0 12px', lineHeight: 1.5 }}>
        Raw crops from Separator -- direct pixels from someone else's PDF, not yet changed by you, so
        they don't count as Parts Library items yet. Check items and use Bulk Edit below to apply one
        change to several at once (the copyright-safe edit step, just done in batches), edit
        individually, or Dismiss to throw one away.
      </p>

      {selected.size > 0 && (
        <div style={{ background: '#fff', border: '1px solid #d8c290', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#1c3557', margin: '0 0 6px' }}>
            {selected.size} selected{singleCategory ? ` -- all ${STYLE_CATEGORIES.find((c) => c.key === singleCategory)?.label || singleCategory}` : ' (mixed categories)'}
          </p>
          {suggestions.length > 0 && (
            <div style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#8a6d3b' }}>You've done this before for {STYLE_CATEGORIES.find((c) => c.key === singleCategory)?.label}:</span>
              {suggestions.map((s) => (
                <button key={s.instruction} onClick={() => setInstruction(s.instruction)}
                  style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: '#f7f5f0', border: '1px solid #e3ddd0', color: '#7a3c8a', cursor: 'pointer' }}>
                  "{s.instruction}" ({s.times_used}×)
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={instruction} onChange={(e) => setInstruction(e.target.value)}
              placeholder='e.g. "crop tighter to the border edge" or "warm up the color palette"'
              style={{ flex: 1, fontSize: 12, padding: '7px 10px', border: '1px solid #e3ddd0', borderRadius: 6 }}
            />
            <button onClick={applyBulkEdit} disabled={applying || !instruction.trim()}
              style={{ fontSize: 12, fontWeight: 700, padding: '7px 14px', background: '#7a3c8a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: applying || !instruction.trim() ? 0.6 : 1, whiteSpace: 'nowrap' }}>
              {applying ? 'Applying…' : `Apply to ${selected.size}`}
            </button>
            <button onClick={bulkDismiss} disabled={applying}
              style={{ fontSize: 12, padding: '7px 14px', background: '#fff', color: '#a33', border: '1px solid #e3ddd0', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Dismiss {selected.size}
            </button>
          </div>
          {batchMsg && <p style={{ fontSize: 11, color: '#2f6b41', margin: '6px 0 0' }}>{batchMsg}</p>}
        </div>
      )}

      {STYLE_CATEGORIES.map((cat) => {
        const catItems = byCategory[cat.key]
        if (!catItems?.length) return null
        const allSelected = catItems.every((p) => selected.has(p.id))
        return (
          <div key={cat.key} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#333' }}>
                {cat.icon} {cat.label} ({catItems.length})
              </div>
              <button onClick={() => selectAllInCategory(catItems)}
                style={{ fontSize: 10, color: '#7a3c8a', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
              {catItems.map((p) => (
                <div key={p.id} style={{ background: '#fff', border: selected.has(p.id) ? '2px solid #7a3c8a' : '1px solid #e8d9b0', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                  <label style={{ position: 'absolute', top: 4, left: 4, zIndex: 1, background: 'rgba(255,255,255,0.85)', borderRadius: 4, padding: 2 }}>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                  </label>
                  {p.file_url ? (
                    <img src={p.file_url} alt={p.title} style={{ width: '100%', height: 70, objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', height: 70, background: '#f5efe0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{cat.icon}</div>
                  )}
                  <div style={{ padding: 5 }}>
                    <p style={{ fontSize: 9, color: '#555', margin: 0, lineHeight: 1.3 }} title={p.title}>{p.title}</p>
                    <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                      <a
                        href={`/dashboard/asset-modifier?${new URLSearchParams({ assetUrl: p.file_url || '', title: p.title || 'Asset', sourcePartId: p.id, category: p.category, fromPending: '1' }).toString()}`}
                        style={{ fontSize: 9, color: '#7a3c8a', textDecoration: 'underline' }}
                      >
                        Edit
                      </a>
                      <button onClick={() => dismiss(p.id)} disabled={busyId === p.id} style={{ fontSize: 9, color: '#a33', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                        {busyId === p.id ? '…' : 'Dismiss'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
