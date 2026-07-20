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
export default function PendingReview({ userId, refreshKey }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    fetch(`/api/library-parts?userId=${userId}&pendingOnly=1`)
      .then((r) => r.json())
      .then((d) => setItems(d.parts || []))
      .finally(() => setLoading(false))
  }, [userId, refreshKey])

  async function dismiss(id) {
    setBusyId(id)
    try {
      await fetch(`/api/library-parts?userId=${userId}&id=${id}`, { method: 'DELETE' })
      setItems((prev) => prev.filter((p) => p.id !== id))
    } finally {
      setBusyId(null)
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
        they don't count as Parts Library items yet. Edit each one in the Style Editor and save to
        actually add it to your library (that's the copyright-safe step); Dismiss to throw one away
        without editing it.
      </p>
      {STYLE_CATEGORIES.map((cat) => {
        const catItems = byCategory[cat.key]
        if (!catItems?.length) return null
        return (
          <div key={cat.key} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#333', marginBottom: 6 }}>
              {cat.icon} {cat.label} ({catItems.length})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
              {catItems.map((p) => (
                <div key={p.id} style={{ background: '#fff', border: '1px solid #e8d9b0', borderRadius: 6, overflow: 'hidden' }}>
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
