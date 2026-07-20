'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { getCurrentUser } from '@/lib/auth'
import SaveAsProductBar from '@/components/SaveAsProductBar'

const OP_LABELS = { addition: 'Addition', subtraction: 'Subtraction', multiplication: 'Multiplication', division: 'Division' }

function MathGeneratorInner() {
  const searchParams = useSearchParams()
  const [userId, setUserId] = useState(null)
  const [op, setOp] = useState(searchParams.get('op') || 'addition')
  const [mode, setMode] = useState(searchParams.get('mode') || 'basic')
  const [title, setTitle] = useState('')
  const [problemsPerPage, setProblemsPerPage] = useState(25)
  const [maxFactor, setMaxFactor] = useState(12)
  const [minDivisor, setMinDivisor] = useState(1)
  const [maxDivisor, setMaxDivisor] = useState(10)
  const [minQuotient, setMinQuotient] = useState(1)
  const [maxQuotient, setMaxQuotient] = useState(10)
  const [digits1, setDigits1] = useState(3)
  const [digits2, setDigits2] = useState(2)
  const [digits, setDigits] = useState(3)
  const [borrowing, setBorrowing] = useState('mixed')
  const [remainders, setRemainders] = useState('mixed')
  const [orientation, setOrientation] = useState('vertical')
  const [wordProblems, setWordProblems] = useState(false)
  const [count, setCount] = useState(12)
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState(null)
  const [fileUrl, setFileUrl] = useState(null)

  useEffect(() => { getCurrentUser().then((u) => u && setUserId(u.id)) }, [])

  async function generate() {
    setGenerating(true); setMsg(null); setFileUrl(null)
    const config = {}
    if (mode === 'basic') {
      config.problemsPerPage = problemsPerPage
      if (op === 'multiplication') config.maxFactor = maxFactor
      if (op === 'division') { config.minDivisor = minDivisor; config.maxDivisor = maxDivisor; config.minQuotient = minQuotient; config.maxQuotient = maxQuotient }
    } else {
      config.count = count
      if (op === 'addition') { config.digits1 = digits1; config.digits2 = digits2; config.wordProblems = wordProblems }
      if (op === 'subtraction') { config.digits = digits; config.borrowing = borrowing; config.orientation = orientation }
      if (op === 'multiplication') { config.digits1 = digits1; config.digits2 = digits2; config.orientation = orientation }
      if (op === 'division') { config.dividendDigits = digits1; config.divisorDigits = digits2; config.remainders = remainders }
    }
    try {
      const res = await fetch('/api/worksheet-generators/math', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, op, mode, config, title: title || `${OP_LABELS[op]} (${mode === 'basic' ? 'Basic' : 'Advanced'})` }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Generation failed') }
      const fileUrlHeader = res.headers.get('X-File-Url')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${OP_LABELS[op]}-${mode}.pdf`; a.click()
      window.URL.revokeObjectURL(url)
      if (fileUrlHeader) setFileUrl(decodeURIComponent(fileUrlHeader))
      setMsg('✓ Generated and downloaded')
    } catch (e) {
      setMsg(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const inputStyle = { fontSize: 12, padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 5, width: 70 }
  const rowStyle = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12, color: '#333' }

  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 700, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>➕ Math Worksheet Generator</h1>
        <a href="/dashboard/worksheet-generators" style={{ fontSize: 12, color: '#888' }}>← All Generators</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
        Covers Basic and Advanced Addition, Subtraction, Multiplication, and Division -- pick the
        operation and mode below.
      </p>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
        <div style={rowStyle}>
          <label>Operation:</label>
          <select value={op} onChange={(e) => setOp(e.target.value)} style={{ ...inputStyle, width: 140 }}>
            {Object.entries(OP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label>Mode:</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ ...inputStyle, width: 110 }}>
            <option value="basic">Basic</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div style={rowStyle}>
          <label>Worksheet title:</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${OP_LABELS[op]} Practice`} style={{ ...inputStyle, width: 220 }} />
        </div>

        {mode === 'basic' && (
          <>
            <div style={rowStyle}>
              <label>Problems per page:</label>
              <select value={problemsPerPage} onChange={(e) => setProblemsPerPage(Number(e.target.value))} style={inputStyle}>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
            {op === 'multiplication' && (
              <div style={rowStyle}>
                <label>Factors up to:</label>
                <input type="number" min={2} max={12} value={maxFactor} onChange={(e) => setMaxFactor(Math.max(2, Math.min(12, Number(e.target.value))))} style={inputStyle} />
              </div>
            )}
            {op === 'division' && (
              <>
                <div style={rowStyle}>
                  <label>Divisor range:</label>
                  <input type="number" min={1} value={minDivisor} onChange={(e) => setMinDivisor(Number(e.target.value))} style={inputStyle} />
                  <span>to</span>
                  <input type="number" min={1} value={maxDivisor} onChange={(e) => setMaxDivisor(Number(e.target.value))} style={inputStyle} />
                </div>
                <div style={rowStyle}>
                  <label>Quotient range:</label>
                  <input type="number" min={1} value={minQuotient} onChange={(e) => setMinQuotient(Number(e.target.value))} style={inputStyle} />
                  <span>to</span>
                  <input type="number" min={1} value={maxQuotient} onChange={(e) => setMaxQuotient(Number(e.target.value))} style={inputStyle} />
                </div>
              </>
            )}
          </>
        )}

        {mode === 'advanced' && (
          <>
            <div style={rowStyle}>
              <label>How many problems:</label>
              <input type="number" min={4} max={30} value={count} onChange={(e) => setCount(Number(e.target.value))} style={inputStyle} />
            </div>
            {(op === 'addition' || op === 'multiplication') && (
              <div style={rowStyle}>
                <label>Digits in each {op === 'addition' ? 'addend' : 'factor'}:</label>
                <input type="number" min={2} max={7} value={digits1} onChange={(e) => setDigits1(Math.max(2, Math.min(7, Number(e.target.value))))} style={inputStyle} />
                <span>and</span>
                <input type="number" min={2} max={7} value={digits2} onChange={(e) => setDigits2(Math.max(2, Math.min(7, Number(e.target.value))))} style={inputStyle} />
              </div>
            )}
            {op === 'addition' && (
              <div style={rowStyle}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={wordProblems} onChange={(e) => setWordProblems(e.target.checked)} />
                  Include word problems
                </label>
              </div>
            )}
            {op === 'subtraction' && (
              <>
                <div style={rowStyle}>
                  <label>Digits:</label>
                  <input type="number" min={2} max={7} value={digits} onChange={(e) => setDigits(Math.max(2, Math.min(7, Number(e.target.value))))} style={inputStyle} />
                </div>
                <div style={rowStyle}>
                  <label>Borrowing:</label>
                  <select value={borrowing} onChange={(e) => setBorrowing(e.target.value)} style={{ ...inputStyle, width: 110 }}>
                    <option value="mixed">Mixed</option>
                    <option value="yes">Always</option>
                    <option value="no">Never</option>
                  </select>
                </div>
              </>
            )}
            {op === 'division' && (
              <div style={rowStyle}>
                <label>Dividend / divisor digits:</label>
                <input type="number" min={2} max={7} value={digits1} onChange={(e) => setDigits1(Math.max(2, Math.min(7, Number(e.target.value))))} style={inputStyle} />
                <span>/</span>
                <input type="number" min={1} max={6} value={digits2} onChange={(e) => setDigits2(Math.max(1, Math.min(6, Number(e.target.value))))} style={inputStyle} />
                <label style={{ marginLeft: 10 }}>Remainders:</label>
                <select value={remainders} onChange={(e) => setRemainders(e.target.value)} style={{ ...inputStyle, width: 110 }}>
                  <option value="mixed">Mixed</option>
                  <option value="yes">Always</option>
                  <option value="no">Never</option>
                </select>
              </div>
            )}
            {(op === 'subtraction' || op === 'multiplication') && !wordProblems && (
              <div style={rowStyle}>
                <label>Layout:</label>
                <select value={orientation} onChange={(e) => setOrientation(e.target.value)} style={{ ...inputStyle, width: 110 }}>
                  <option value="vertical">Vertical</option>
                  <option value="horizontal">Horizontal</option>
                </select>
              </div>
            )}
          </>
        )}

        <button
          onClick={generate} disabled={generating || !userId}
          style={{ marginTop: 6, padding: '9px 18px', background: '#7a3c8a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: generating ? 0.6 : 1 }}
        >
          {generating ? 'Generating…' : '📄 Generate Worksheet'}
        </button>
        {msg && <p style={{ fontSize: 12, color: msg.startsWith('✓') ? '#2f6b41' : '#a33', marginTop: 8 }}>{msg}</p>}

        <SaveAsProductBar userId={userId} fileUrl={fileUrl} defaultTitle={title || `${OP_LABELS[op]} (${mode === 'basic' ? 'Basic' : 'Advanced'})`} />
      </div>
    </div>
  )
}

export default function MathGeneratorPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, fontFamily: FONT_BODY }}>Loading…</div>}>
      <MathGeneratorInner />
    </Suspense>
  )
}
