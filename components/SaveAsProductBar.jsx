'use client'
import { useState } from 'react'

// Every generator in the Worksheet Generators suite ends here: a generated
// PDF can be saved as a Finished Product (Aj, 2026-07-19), which is what
// makes it "attached to" Bundle Builder -- bundles are built FROM Finished
// Products, so anything saved here is immediately available to add to one.
export default function SaveAsProductBar({ userId, fileUrl, defaultTitle }) {
  const [title, setTitle] = useState(defaultTitle || '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  async function save() {
    if (!fileUrl || !title.trim() || saving) return
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title: title.trim(), file_url: fileUrl, status: 'draft' }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Save failed')
      setMsg('✓ Saved as a Finished Product -- available in Bundle Builder')
    } catch (e) {
      setMsg(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!fileUrl) return null

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, padding: 12, background: '#eef6f0', border: '1px solid #b8dcc2', borderRadius: 8 }}>
      <input
        value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="Product title"
        style={{ flex: 1, minWidth: 180, fontSize: 12, padding: '6px 8px', border: '1px solid #b8dcc2', borderRadius: 5 }}
      />
      <button
        onClick={save} disabled={saving || !title.trim()}
        style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#2f6b41', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: saving || !title.trim() ? 'default' : 'pointer', opacity: saving || !title.trim() ? 0.6 : 1 }}
      >
        {saving ? 'Saving…' : '💾 Save as Finished Product'}
      </button>
      {msg && <span style={{ fontSize: 11, color: msg.startsWith('✓') ? '#2f6b41' : '#a33' }}>{msg}</span>}
    </div>
  )
}
