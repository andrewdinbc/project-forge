// lib/pdf-page-render.js
// Renders a PDF page to a real raster image, and crops a pixel region out
// of that render -- step 2 of "disassemble a PDF to reuse the parts I
// like" (Aj, 2026-07-19). This covers everything step 1 (embedded-image
// extraction, lib/pdf-image-extract.js) can't: hand-drawn diagrams,
// vector art, a single question box, anything laid out rather than
// stored as a discrete image object. The tradeoff is real and worth
// stating plainly: a crop becomes a flattened picture of that region,
// not editable/reusable vector content.
//
// Uses `unpdf` (a serverless-safe redistribution of Mozilla's PDF.js)
// with `@napi-rs/canvas` for the actual rasterization. This combination
// is specifically built to avoid the classic Vercel/Lambda failure mode
// where the plain `canvas` npm package needs a native Cairo build that
// doesn't exist in serverless environments -- @napi-rs/canvas ships
// prebuilt binaries for the platforms Vercel actually runs on instead.
import { getDocumentProxy, renderPageAsImage } from 'unpdf';
import { createCanvas, loadImage, DOMMatrix } from '@napi-rs/canvas';

// Durable fix (2026-07-20): pdf.js needs a global DOMMatrix for pages with
// complex vector graphics/transforms (e.g. a full-bleed patterned cover
// graphic) -- unpdf's `canvas: () => import('@napi-rs/canvas')` factory
// supplies canvas/image primitives but never registers DOMMatrix globally,
// so any page that actually exercises that code path throws "DOMMatrix is
// not defined" at render time. Found via Style Match & Meld crashing on a
// PDF's page 1 (a full-page checkered-background cover graphic) even
// though Separator's own pickBestPage happened to avoid the same failure
// by picking a plainer page -- meaning this was a latent bug that would
// hit ANY caller rendering a visually complex page, not just page 1s.
// @napi-rs/canvas ships a real DOMMatrix implementation; just needs wiring
// to the global pdf.js actually looks for.
if (typeof globalThis.DOMMatrix === 'undefined' && DOMMatrix) {
  globalThis.DOMMatrix = DOMMatrix;
}

export async function getPdfPageCount(pdfBytes) {
  const buffer = Uint8Array.from(pdfBytes);
  const pdf = await getDocumentProxy(buffer);
  return pdf.numPages;
}

// Renders one page to a PNG buffer at the given scale (1 = PDF's native
// point size, so 2 renders at roughly double resolution for a sharper
// crop later).
export async function renderPdfPageToPng(pdfBytes, pageNumber, scale = 1.5) {
  const buffer = Uint8Array.from(pdfBytes);
  const result = await renderPageAsImage(buffer, pageNumber, {
    canvas: () => import('@napi-rs/canvas'),
    scale,
  });
  return Buffer.from(result);
}

// Crops a rectangular pixel region out of an already-rendered page PNG.
// Coordinates are in the SAME pixel space as the rendered PNG (i.e. the
// client must translate on-screen selection coordinates by the ratio of
// the displayed image size to its natural size before calling this).
export async function cropPngRegion(pngBuffer, x, y, width, height) {
  const img = await loadImage(pngBuffer);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
  try {
    return await canvas.encode('png');
  } catch {
    // Defensive fallback in case this @napi-rs/canvas version doesn't
    // expose .encode() -- .toBuffer() is the older/alternate API shape.
    return canvas.toBuffer('image/png');
  }
}
