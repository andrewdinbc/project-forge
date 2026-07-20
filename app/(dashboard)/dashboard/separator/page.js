'use client'
import { useState, useEffect } from 'react'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import { STYLE_CATEGORIES } from '@/lib/product-builder-categories'
import PendingReview from '@/components/PendingReview'

// Separator (Aj, 2026-07-19): "when I add a series of pdf documents to it,
// it will separate Border, Section Header, Font, Spacing & Alignment, and
// Icon & Illustration, colour palettes and create libraries out of them...
// so I can roll out activities extremely quickly." Upload a batch, walk
// away, come back to populated Parts Library sections instead of manually
// working through Style Lab/Asset Modifier one resource at a time.
const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024 // same platform-limit safety margin as Style Lab's bulk import

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

const EMPTY_TOTALS = { border: 0, section_header: 0, icon_illustration: 0, color_palette: 0, font_reference: 0, spacing_alignment: 0 }

export default function SeparatorPage() {
  const [userId, setUserId] = useState(null)
  const [ready, setReady] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(null)
  const [totals, setTotals] = useState(null)
  const [perFile, setPerFile] = useState([])
  const [errors, setErrors] = useState([])
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0)

  useEffect(() => { getCurrentUser().then((u) => { if (u) setUserId(u.id); setReady(true) }) }, [])

  async function handleFiles(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length || !userId) return
    setProcessing(true); setTotals({ ...EMPTY_TOTALS }); setPerFile([]); setErrors([])
    try {
      setProgress('Checking file sizes…')
      const units = []
      for (const f of files) {
        if (f.size > MAX_UPLOAD_BYTES) units.push(...(await splitPdfBySize(f, MAX_UPLOAD_BYTES)))
        else units.push({ blob: f, name: f.name })
      }

      const runningTotals = { ...EMPTY_TOTALS }
      for (let i = 0; i < units.length; i++) {
        const unit = units[i]
        setProgress(`Separating ${i + 1} of ${units.length}: ${unit.name}`)
        const formData = new FormData()
        formData.append('userId', userId)
        formData.append('file', unit.blob, unit.name)
        try {
          const res = await fetch('/api/separator/analyze', { method: 'POST', body: formData })
          const d = await res.json()
          if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`)
          runningTotals.border += d.saved.border ? 1 : 0
          runningTotals.section_header += d.saved.section_header ? 1 : 0
          runningTotals.icon_illustration += d.saved.icon_illustration?.length || 0
          runningTotals.color_palette += d.saved.color_palette ? 1 : 0
          runningTotals.font_reference += d.saved.font_reference?.length || 0
          runningTotals.spacing_alignment += d.saved.spacing_alignment ? 1 : 0
          setTotals({ ...runningTotals })
          setPerFile((prev) => [...prev, { name: unit.name, saved: d.saved, errors: d.errors || [] }])
          if (d.errors?.length) setErrors((prev) => [...prev, ...d.errors.map((e) => `${unit.name}: ${e}`)])
        } catch (e) {
          setErrors((prev) => [...prev, `${unit.name}: ${e.message}`])
        }
      }
    } finally {
      setProgress(null)
      setProcessing(false)
      setReviewRefreshKey((k) => k + 1)
    }
  }

  if (!ready) return <div style={{ padding: 40, fontFamily: FONT_BODY }}>Loading…</div>

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>✂️ Separator</h1>
        <a href="/dashboard/library-parts" style={{ fontSize: 12, color: '#888' }}>Parts Library →</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Add a batch of PDFs and it automatically pulls out a Border, Section Header, up to 5 Icon &amp;
        Illustration elements, and a Color Palette from each one -- as raw crops from that PDF, which
        land in <strong>Needs Review</strong> below, not your Parts Library. Edit each one in the Style
        Editor and save to actually add it to your library -- that's the copyright-safe step, since a
        raw crop is still someone else's pixels until you've changed it. Fonts and a starting Spacing
        &amp; Alignment preset aren't pixel copies, so those go straight to their libraries. Page 1 of
        each PDF only (same as other bulk tools here) -- deeper pages stay reachable via Style Lab if
        you want to work through those by hand.
      </p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, textAlign: 'center', marginBottom: 20 }}>
        <label style={{ display: 'inline-block', padding: '10px 20px', background: '#7a3c8a', color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: processing ? 'default' : 'pointer', opacity: processing ? 0.6 : 1 }}>
          {processing ? 'Separating…' : '📎 Choose PDF(s) to Separate'}
          <input type="file" accept="application/pdf" multiple style={{ display: 'none' }} disabled={processing} onChange={(e) => handleFiles(e.target.files)} />
        </label>
        {processing && progress && <p style={{ fontSize: 12, color: '#7a3c8a', marginTop: 10 }}>{progress}</p>}
      </div>

      <PendingReview userId={userId} refreshKey={reviewRefreshKey} />

      {totals && (
        <div style={{ background: '#eef6f0', border: '1px solid #b8dcc2', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2f6b41', marginBottom: 10 }}>
            {processing ? 'Extracted so far' : 'Done'}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {STYLE_CATEGORIES.map((cat) => (
              <div key={cat.key} style={{ fontSize: 12, color: '#333' }}>
                {cat.icon} {cat.label}: <strong>{totals[cat.key] ?? 0}</strong>
              </div>
            ))}
          </div>
          {!processing && (
            <p style={{ fontSize: 11, color: '#2f6b41', marginTop: 10 }}>
              Fonts and the Spacing &amp; Alignment preset are in their libraries now. Everything else is
              waiting in Needs Review above -- edit and save each one to add it to your library.
            </p>
          )}
        </div>
      )}

      {perFile.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 6 }}>Per file</div>
          {perFile.map((f, i) => (
            <div key={i} style={{ fontSize: 11, color: '#555', padding: '4px 0', borderBottom: '1px solid #eee' }}>
              {f.name}: border {f.saved.border ? '✓' : '—'}, header {f.saved.section_header ? '✓' : '—'}, {f.saved.icon_illustration?.length || 0} icon(s), palette {f.saved.color_palette ? '✓' : '—'}, {f.saved.font_reference?.length || 0} font(s)
            </div>
          ))}
        </div>
      )}

      {errors.length > 0 && (
        <div style={{ background: '#fdf2f2', border: '1px solid #eecccc', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#a33', marginBottom: 6 }}>Some items couldn't be extracted</div>
          {errors.map((e, i) => <div key={i} style={{ fontSize: 11, color: '#a33' }}>{e}</div>)}
        </div>
      )}

      <p style={{ fontSize: 10, color: '#aaa', marginTop: 20, lineHeight: 1.5 }}>
        Spacing &amp; Alignment presets from Separator are an approximate starting point (margins
        inferred from where a header/icons were detected, not real body-text regions) -- open the
        Spacing &amp; Alignment Editor to refine before relying on one.
      </p>
    </div>
  )
}
