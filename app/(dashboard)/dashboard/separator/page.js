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

  // Style Match & Meld (Aj, 2026-07-20): "when I upload a product... AI
  // tell me it is kind of like these two free ones melded together and
  // make a new [asset] that combines this one with the free one." A
  // separate mode from bulk Separator above -- this NEVER extracts pixels
  // from the upload, it only describes the style and matches against
  // items Aj already owns free-and-clear, then AI-blends the matches.
  const [matchAnalyzing, setMatchAnalyzing] = useState(false)
  const [matchResult, setMatchResult] = useState(null)
  const [matchError, setMatchError] = useState(null)
  const [melding, setMelding] = useState(null) // category currently melding

  useEffect(() => { getCurrentUser().then((u) => { if (u) setUserId(u.id); setReady(true) }) }, [])

  async function handleMatchUpload(fileList) {
    const file = fileList?.[0]
    if (!file || !userId) return
    setMatchAnalyzing(true); setMatchResult(null); setMatchError(null)
    try {
      const formData = new FormData()
      formData.append('userId', userId)
      formData.append('file', file)
      const res = await fetch('/api/style-match/analyze-and-suggest', { method: 'POST', body: formData })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`)
      setMatchResult(d)
    } catch (e) {
      setMatchError(e.message)
    } finally {
      setMatchAnalyzing(false)
    }
  }

  async function handleMeld(category, matches) {
    if (!userId || matches.length < 2) return
    setMelding(category)
    try {
      const res = await fetch('/api/style-match/meld', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, category, partIds: matches.map((m) => m.id) }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Meld failed')
      setReviewRefreshKey((k) => k + 1) // new melded item shows up in Needs Review below
    } catch (e) {
      setMatchError(e.message)
    } finally {
      setMelding(null)
    }
  }

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

      <div style={{ background: '#f4f0fa', border: '1px solid #d9cbe8', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#5a2d6b', marginBottom: 4 }}>🔀 Style Match &amp; Meld</div>
        <p style={{ fontSize: 12, color: '#6b4b7a', margin: '0 0 14px', lineHeight: 1.5 }}>
          A different mode from bulk Separator above -- upload a product you like the LOOK of, and this
          never touches its pixels. It only describes the style in words, then finds the 2 closest items
          already in your free-license library and offers to AI-blend them into something new. That new
          blend still lands in Needs Review for you to edit before it's really yours.
        </p>
        <label style={{ display: 'inline-block', padding: '9px 18px', background: '#5a2d6b', color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: matchAnalyzing ? 'default' : 'pointer', opacity: matchAnalyzing ? 0.6 : 1 }}>
          {matchAnalyzing ? 'Analyzing…' : '📎 Upload a Product to Match'}
          <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }} disabled={matchAnalyzing} onChange={(e) => handleMatchUpload(e.target.files)} />
        </label>

        {matchError && <p style={{ fontSize: 11, color: '#a33', marginTop: 10 }}>{matchError}</p>}

        {matchResult && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {['border', 'section_header', 'icon_illustration'].map((cat) => {
              const s = matchResult.suggestions?.[cat]
              if (!s) return null
              const label = STYLE_CATEGORIES.find((c) => c.key === cat)?.label || cat
              return (
                <div key={cat} style={{ background: '#fff', border: '1px solid #e3d5f0', borderRadius: 6, padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#333', marginBottom: 4 }}>{label}</div>
                  <p style={{ fontSize: 11, color: '#777', margin: '0 0 8px', fontStyle: 'italic' }}>"{s.description}"</p>
                  {s.note && <p style={{ fontSize: 11, color: '#a06b1f' }}>{s.note}</p>}
                  {s.matches?.length > 0 && (
                    <>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                        {s.matches.map((m) => (
                          <div key={m.id} style={{ textAlign: 'center' }}>
                            <img src={m.file_url} alt={m.title} style={{ width: 70, height: 50, objectFit: 'contain', border: '1px solid #e3ddd0', borderRadius: 4, background: '#fafafa' }} />
                            <p style={{ fontSize: 9, color: '#555', margin: '3px 0 0', maxWidth: 80 }}>{m.title}</p>
                          </div>
                        ))}
                      </div>
                      {s.rationale && <p style={{ fontSize: 11, color: '#5a2d6b', margin: '0 0 8px' }}>💡 {s.rationale}</p>}
                      {s.matches.length >= 2 && (
                        <button onClick={() => handleMeld(cat, s.matches)} disabled={melding === cat}
                          style={{ fontSize: 11, fontWeight: 600, padding: '6px 14px', background: '#5a2d6b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: melding === cat ? 0.6 : 1 }}>
                          {melding === cat ? 'Melding…' : `Meld these ${s.matches.length} into something new →`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })}
            {matchResult.fontSuggestion?.match && (
              <div style={{ background: '#fff', border: '1px solid #e3d5f0', borderRadius: 6, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#333', marginBottom: 4 }}>🔤 Font</div>
                <p style={{ fontSize: 11, color: '#777', margin: '0 0 4px', fontStyle: 'italic' }}>"{matchResult.fontSuggestion.description}"</p>
                <p style={{ fontSize: 12, color: '#5a2d6b' }}>Closest font already in your library: <strong>{matchResult.fontSuggestion.match.title}</strong></p>
              </div>
            )}
            {matchResult.palette?.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e3d5f0', borderRadius: 6, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#333', marginBottom: 6 }}>🌈 Colors detected (free to use directly -- colors aren't copyrightable)</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {matchResult.palette.map((hex) => (
                    <div key={hex} title={hex} style={{ width: 28, height: 28, borderRadius: 4, background: hex, border: '1px solid #ddd' }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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
