// lib/pdf-extract.js — server-side PDF → plain text extraction for
// uploaded steering-document books/resources. Uses pdf-parse (pure JS,
// no native binary dependency, works fine on Vercel serverless).
//
// IMPORTANT: import the internal lib/pdf-parse.js directly, NOT the
// package's index.js. index.js has a debug-mode block gated on
// `isDebugMode = !module.parent` that misfires in bundled serverless
// environments (module.parent is often undefined there even when the
// module IS being required by something else), triggering a synchronous
// readFileSync() of a test fixture that doesn't exist in the deployed
// bundle -- which crashes the whole module at IMPORT time, before any
// route code runs, surfacing as a mysterious 404 rather than a normal
// error. Confirmed 2026-07-18 after Aj hit exactly this on a live route.
import pdfParse from 'pdf-parse/lib/pdf-parse.js'

/**
 * @param {Buffer} buffer - raw PDF file bytes
 * @returns {Promise<{ text: string, numPages: number }>}
 */
export async function extractPdfText(buffer) {
  const data = await pdfParse(buffer)
  return {
    text: data.text,
    numPages: data.numpages,
  }
}
