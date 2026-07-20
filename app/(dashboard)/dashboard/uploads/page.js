'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import { getUserProducts } from '@/lib/products'
import { STYLE_CATEGORIES } from '@/lib/product-builder-categories'
import PendingReview from '@/components/PendingReview'

// Uploads (Aj, 2026-07-19): "a new folder called Uploads. This is where
// everything that I bring up is stored." One place to see everything
// you've brought into Forge -- Style Lab PDFs/URLs and Finished Products'
// files -- and from here, select any of it and send straight to the
// Separator without re-uploading.
const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024

async function buildChunkBytes(srcDoc, pageIndices, PDFDocument) {
  const chunkDoc = await PDFDocument.create()
  const copied = await chunkDoc.copyPages(srcDoc, pageIndices)
  copied.forEach((p) => chunkDoc.addPage(p))
  return chunkDoc.save()
}

async function splitPdfBySize(file, maxBytes) {
  const { PDFDocument } = await import('pdf-lib')
  if (file.size <= maxBytes) return [{ blob: file, name: file.name }]
  const bytes = new Uint8Array(await file.arrayBuffer())
  const srcDoc = await PDFDocument.load(bytes)
  const pageCount = srcDoc.getPageCount()
  const rawChunks = []
  async function splitRange(start, end) {
    const indices = []
    for (let i = start; i <= end; i++) indices.push(i)
    const chunkBytes = await buildChunkBytes(srcDoc, indices, PDFDocument)
    if (chunkBytes.length <= maxBytes || indices.length === 1) {
      rawChunks.push({ bytes: chunkBytes, startPage: start + 1, endPage: end + 1 })
      return
    }
    const mid = start + Math.floor((end - start) / 2)
    await splitRange(start, mid)
    await splitRange(mid + 1, end)
  }
  await splitRange(0, pageCount - 1)
  const baseName = file.name.replace(/\.pdf$/i, '')
  return rawChunks.map((c, i) => ({
    blob: new Blob([c.bytes], { type: 'application/pdf' }),
    name: `${baseName} (Part ${i + 1} of ${rawChunks.length}, pages ${c.startPage}-${c.endPage}).pdf`,
  }))
}

const EMPTY_TOTALS = { border: 0, section_header: 0, icon_illustration: 0, color_palette: 0, font: 0, spacing_alignment: 0 }

export default function UploadsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resources, setResources] = useState([])
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(null)
  const [importMsg, setImportMsg] = useState(null)
  const [sending, setSending] = useState(false)
  const [sendProgress, setSendProgress] = useState(null)
  const [sendTotals, setSendTotals] = useState(null)
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0)
  const [sendErrors, setSendErrors] = useState([])

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (!u) { router.push('/auth/login'); return }
      setUserId(u.id)
      Promise.all([
        fetch(`/api/style-lab/resources?userId=${u.id}`).then((r) => r.json()),
        getUserProducts(u.id).catch(() => []),
      ]).then(([resRes, prodList]) => {
        setResources(resRes.resources || [])
        setProducts((prodList || []).filter((p) => p.file_url))
      }).finally(() => setLoading(false))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle(key) {
    setSelected((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  async function bulkUpload(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) return
    setImporting(true); setImportMsg(null)
    try {
      setImportProgress('Checking file sizes…')
      const units = []
      for (const f of files) {
        if (f.size > MAX_UPLOAD_BYTES) units.push(...(await splitPdfBySize(f, MAX_UPLOAD_BYTES)))
        else units.push({ blob: f, name: f.name })
      }
      let importedCount = 0
      const errs = []
      for (let i = 0; i < units.length; i++) {
        const unit = units[i]
        setImportProgress(`Uploading ${i + 1} of ${units.length}: ${unit.name}`)
        const formData = new FormData()
        formData.append('userId', userId)
        formData.append('action', 'bulk_upload_tpt')
        formData.append('files', unit.blob, unit.name)
        try {
          const res = await fetch('/api/style-lab/resources', { method: 'POST', body: formData })
          const d = await res.json()
          if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`)
          setResources((prev) => [...(d.imported || []), ...prev])
          importedCount += (d.imported || []).length
          if (d.errors?.length) errs.push(...d.errors.map((e) => e.error || e))
        } catch (e) {
          errs.push(e.message)
        }
      }
      setImportMsg(`✓ Imported ${importedCount} file${importedCount === 1 ? '' : 's'}${errs.length ? ` (${errs.length} failed)` : ''}`)
    } finally {
      setImportProgress(null)
      setImporting(false)
    }
  }

  async function sendToSeparator() {
    if (selected.size === 0 || sending) return
    setSending(true); setSendTotals({ ...EMPTY_TOTALS }); setSendErrors([])
    const items = Array.from(selected).map((key) => {
      const [kind, id] = key.split(':')
      if (kind === 'resource') {
        const r = resources.find((x) => x.id === id)
        return r ? { title: r.title, fileUrl: r.file_url } : null
      }
      const p = products.find((x) => x.id === id)
      return p ? { title: p.title, fileUrl: p.file_url } : null
    }).filter((i) => i?.fileUrl)

    const running = { ...EMPTY_TOTALS }
    for (const item of items) {
      setSendProgress(`Separating: ${item.title}`)
      const formData = new FormData()
      formData.append('userId', userId)
      formData.append('fileUrl', item.fileUrl)
      formData.append('title', item.title)
      try {
        const res = await fetch('/api/separator/analyze', { method: 'POST', body: formData })
        const d = await res.json()
        if (!res.ok) throw new Error(d.error || 'Failed')
        running.border += d.saved.border ? 1 : 0
        running.section_header += d.saved.section_header ? 1 : 0
        running.icon_illustration += d.saved.icon_illustration?.length || 0
        running.color_palette += d.saved.color_palette ? 1 : 0
        running.font += d.saved.font_reference?.length || 0
        running.spacing_alignment += d.saved.spacing_alignment ? 1 : 0
        setSendTotals({ ...running })
        if (d.errors?.length) setSendErrors((prev) => [...prev, ...d.errors.map((e) => `${item.title}: ${e}`)])
      } catch (e) {
        setSendErrors((prev) => [...prev, `${item.title}: ${e.message}`])
      }
    }
    setSendProgress(null)
    setSending(false)
    setReviewRefreshKey((k) => k + 1)
  }

  if (loading) return <div style={{ padding: 40, fontFamily: FONT_BODY }}>Loading…</div>

  const allItems = [
    ...resources.map((r) => ({ key: `resource:${r.id}`, title: r.title, sub: r.source_type === 'pdf' ? 'PDF' : 'URL', fileUrl: r.file_url, kind: 'Style Lab upload' })),
    ...products.map((p) => ({ key: `product:${p.id}`, title: p.title, sub: p.status || 'draft', fileUrl: p.file_url, kind: 'Finished Product' })),
  ]

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>📤 Uploads</h1>
        <a href="/dashboard/separator" style={{ fontSize: 12, color: '#888' }}>Separator →</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Everything you've brought into Forge, in one place -- PDFs and URLs uploaded to Style Lab, plus
        every Finished Product with a file. Select anything below and send it straight to the Separator
        without re-uploading. Its raw crops land in Needs Review, not your Parts Library, until you've
        actually edited and saved each one in the Style Editor.
      </p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#7a3c8a', marginBottom: 6 }}>📎 Add Uploads</div>
        <label style={{ display: 'inline-block', padding: '8px 16px', background: '#7a3c8a', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: importing ? 'default' : 'pointer', opacity: importing ? 0.6 : 1 }}>
          {importing ? 'Uploading…' : '📎 Choose PDF(s)'}
          <input type="file" accept="application/pdf" multiple style={{ display: 'none' }} disabled={importing} onChange={(e) => bulkUpload(e.target.files)} />
        </label>
        {importing && importProgress && <p style={{ fontSize: 11, color: '#7a3c8a', marginTop: 6 }}>{importProgress}</p>}
        {importMsg && <p style={{ fontSize: 11, color: importMsg.startsWith('✓') ? '#2f6b41' : '#a33', marginTop: 6 }}>{importMsg}</p>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '8px 12px', background: '#f5eafa', border: '1px solid #d9b8e8', borderRadius: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#7a3c8a', fontWeight: 600 }}>{selected.size} selected</span>
        <button
          onClick={sendToSeparator} disabled={selected.size === 0 || sending}
          style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#7a3c8a', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: selected.size === 0 || sending ? 'default' : 'pointer', opacity: selected.size === 0 || sending ? 0.6 : 1 }}
        >
          {sending ? 'Separating…' : '✂️ Send to Separator'}
        </button>
        {sendProgress && <span style={{ fontSize: 11, color: '#7a3c8a' }}>{sendProgress}</span>}
      </div>

      <PendingReview userId={userId} refreshKey={reviewRefreshKey} />

      {sendTotals && (
        <div style={{ background: '#eef6f0', border: '1px solid #b8dcc2', borderRadius: 8, padding: 14, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2f6b41', marginBottom: 8 }}>{sending ? 'Extracted so far' : 'Done'}</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {STYLE_CATEGORIES.map((cat) => (
              <div key={cat.key} style={{ fontSize: 11, color: '#333' }}>
                {cat.icon} {cat.label}: <strong>{sendTotals[cat.key === 'font' ? 'font' : cat.key] ?? 0}</strong>
              </div>
            ))}
          </div>
          {!sending && (
            <p style={{ fontSize: 11, color: '#2f6b41', marginTop: 10 }}>
              Fonts and the Spacing &amp; Alignment preset are in their libraries now. Everything else is
              waiting in Needs Review above -- edit and save each one to add it to your library.
            </p>
          )}
          {sendErrors.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {sendErrors.map((e, i) => <div key={i} style={{ fontSize: 10, color: '#a33' }}>{e}</div>)}
            </div>
          )}
        </div>
      )}

      {allItems.length === 0 ? (
        <p style={{ fontSize: 13, color: '#888', fontStyle: 'italic' }}>Nothing here yet -- add a PDF above.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {allItems.map((item) => (
            <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={selected.has(item.key)} onChange={() => toggle(item.key)} disabled={!item.fileUrl} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1c3557', margin: 0 }}>{item.title}</p>
                <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#999', marginTop: 2 }}>
                  <span>{item.kind}</span>
                  <span>·</span>
                  <span>{item.sub}</span>
                </div>
              </div>
              {item.fileUrl && <a href={item.fileUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: 11, color: '#2f6b41' }}>Open ↗</a>}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
