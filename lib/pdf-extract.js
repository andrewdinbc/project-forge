// lib/pdf-extract.js — server-side PDF → plain text extraction for
// uploaded steering-document books/resources. Uses pdf-parse (pure JS,
// no native binary dependency, works fine on Vercel serverless).

import pdfParse from 'pdf-parse'

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
