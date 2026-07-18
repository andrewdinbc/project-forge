// lib/pdf-page-extract.js — per-page PDF text extraction, needed for
// AI auto-tagging (unlike lib/pdf-extract.js's whole-document extraction,
// the composer's product_components table tags specific PAGE RANGES, so
// the AI classifier needs to see each page's text separately to figure
// out where one component ends and the next begins).
//
// Fixed 2026-07-18: import the internal lib/pdf-parse.js directly, not
// the package's index.js, which crashes at import time in bundled
// serverless environments -- see lib/pdf-extract.js for the full
// explanation, same root cause.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

/**
 * @param {Buffer} buffer - raw PDF file bytes
 * @returns {Promise<{ pages: string[], numPages: number }>}
 */
export async function extractPdfPagesText(buffer) {
  const pages = [];
  await pdfParse(buffer, {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      const text = textContent.items.map((item) => item.str).join(' ');
      pages.push(text);
      return text;
    },
  });
  return { pages, numPages: pages.length };
}
