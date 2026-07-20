// lib/pdf-layer-render.js
// Acrobat-style visual "layers" for a flat PDF page (Aj, 2026-07-19).
//
// Flat teacher PDFs almost never carry real Optional Content Group layers, so
// there is nothing built in to toggle. We DERIVE three layers by content type
// and strip the disabled ones at the PDF-source level, then render normally
// with unpdf/@napi-rs/canvas (same stack as lib/pdf-page-render.js):
//   - text     : everything inside BT ... ET text objects
//   - images   : image XObject draws (/Name Do where Name is an /Image) and
//                inline images (BI ... ID ... EI)
//   - graphics : vector path PAINTING ops (fill/stroke) -> neutered to `n`
//
// MEMORY NOTE (learned the hard way on a real 7-page PDF, 2026-07-19): a
// tokenizer that builds one JS object per operator OOMs on graphics-heavy
// pages, and loading+re-saving the whole multi-page doc is wasteful. So this
// (1) copies ONLY the target page into a fresh 1-page doc before saving, and
// (2) filters the content stream in a single pass that emits verbatim slices,
// never materializing a full token array.
//
// Honest limits: content inside a Form XObject isn't recursed into; inline-
// image (BI..EI) skipping uses a delimited-'EI' scan that can misfire if the
// image's binary data contains those bytes; an isolated layer is a flattened
// raster, not editable content.

import { PDFDocument, PDFName, PDFArray, decodePDFRawStream } from 'pdf-lib';
import { renderPageAsImage, getDocumentProxy, getResolvedPDFJS } from 'unpdf';
import { createCanvas, loadImage, DOMMatrix } from '@napi-rs/canvas';

// Same durable fix as lib/pdf-page-render.js (2026-07-20): pdf.js needs a
// global DOMMatrix for complex-vector pages; unpdf's canvas factory doesn't
// register one. This file also calls renderPageAsImage and getOperatorList
// (viewport.convertToViewportPoint uses matrix math internally), so it's
// exposed to the identical failure mode on the same class of pages.
if (typeof globalThis.DOMMatrix === 'undefined' && DOMMatrix) {
  globalThis.DOMMatrix = DOMMatrix;
}

const PAINT_OPS = new Set(['S', 's', 'f', 'F', 'f*', 'B', 'B*', 'b', 'b*']);
const isWS = (c) => c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === '\f' || c === '\0';
const isDelim = (c) => '()<>[]{}/%'.includes(c);

// Finds the end index just past the next standalone occurrence of `op`.
function skipToAfter(str, from, op) {
  const n = str.length;
  let j = from;
  while (j < n) {
    const k = str.indexOf(op, j);
    if (k < 0) return n;
    const before = k === 0 ? ' ' : str[k - 1];
    const after = k + op.length >= n ? ' ' : str[k + op.length];
    if ((isWS(before) || isDelim(before)) && (isWS(after) || isDelim(after))) return k + op.length;
    j = k + op.length;
  }
  return n;
}

// Single-pass, low-memory content-stream filter. Emits verbatim slices of the
// original stream, only diverging where a disabled layer must be removed.
function filterContentStream(str, imageNames, { text = true, images = true, graphics = true }) {
  if (text && images && graphics) return str;
  const n = str.length;
  const out = [];
  let runStart = 0;
  let i = 0;
  let prevName = null; // { start, end } of the immediately preceding /name
  const emitUpTo = (end) => { if (end > runStart) out.push(str.slice(runStart, end)); };

  while (i < n) {
    const c = str[i];
    if (isWS(c)) { i++; continue; }
    if (c === '%') { while (i < n && str[i] !== '\n' && str[i] !== '\r') i++; prevName = null; continue; }
    if (c === '(') { let depth = 0; do { const ch = str[i]; if (ch === '\\') { i += 2; continue; } if (ch === '(') depth++; if (ch === ')') depth--; i++; } while (i < n && depth > 0); prevName = null; continue; }
    if (c === '<' && str[i + 1] === '<') { let depth = 0; do { if (str[i] === '<' && str[i + 1] === '<') { depth++; i += 2; continue; } if (str[i] === '>' && str[i + 1] === '>') { depth--; i += 2; continue; } i++; } while (i < n && depth > 0); prevName = null; continue; }
    if (c === '<') { i++; while (i < n && str[i] !== '>') i++; i++; prevName = null; continue; }
    if (c === '[') { i++; while (i < n && str[i] !== ']') i++; i++; prevName = null; continue; }
    if (c === '/') { const s = i; i++; while (i < n && !isWS(str[i]) && !isDelim(str[i])) i++; prevName = { start: s, end: i }; continue; }
    const s = i; while (i < n && !isWS(str[i]) && !isDelim(str[i])) i++;
    const w = str.slice(s, i);
    if (/^[-+]?[0-9.]+$/.test(w)) { prevName = null; continue; } // numeric operand
    const op = w;
    if (op === 'BT') {
      if (!text) { emitUpTo(s); i = skipToAfter(str, i, 'ET'); runStart = i; }
      prevName = null; continue;
    }
    if (op === 'BI') {
      if (!images) { emitUpTo(s); i = skipToAfter(str, i, 'EI'); runStart = i; }
      prevName = null; continue;
    }
    if (op === 'Do') {
      if (!images && prevName && imageNames.has(str.slice(prevName.start, prevName.end))) {
        emitUpTo(prevName.start); runStart = i; // drop the name AND the Do
      }
      prevName = null; continue;
    }
    if (op === 'sh' && !graphics) { emitUpTo(s); runStart = i; prevName = null; continue; }
    if (!graphics && PAINT_OPS.has(op)) { emitUpTo(s); out.push('n'); runStart = i; prevName = null; continue; }
    prevName = null;
  }
  emitUpTo(n);
  return out.join('');
}

function decodeStream(s) {
  return Buffer.from(decodePDFRawStream(s).decode()).toString('latin1');
}

export async function getPageCount(pdfBytes) {
  const pdf = await getDocumentProxy(Uint8Array.from(pdfBytes));
  return pdf.numPages;
}

// Reads the real font name(s) a page's /Resources /Font dictionary declares
// (Aj, 2026-07-19: "I want to be able to replicate the font as a
// component"). This reads PDF METADATA ONLY -- the font's declared name,
// e.g. "KG Shake It Off" -- never the embedded font PROGRAM (the actual
// glyph outlines), which is separately-licensed software we have no right to
// extract and reuse. The name is enough to go license that exact font
// yourself from its foundry; it deliberately stops short of anything that
// would let you skip doing that.
export async function getPageFonts(pdfBytes, pageNumber) {
  try {
    const doc = await PDFDocument.load(Uint8Array.from(pdfBytes), { updateMetadata: false });
    const pg = doc.getPages()[pageNumber - 1];
    if (!pg) return [];
    const node = pg.node;
    const res = node.Resources();
    const fontDict = res && res.get(PDFName.of('Font'));
    const names = new Set();
    if (fontDict && fontDict.entries) {
      for (const [, v] of fontDict.entries()) {
        const o = node.context.lookup(v);
        const base = o && o.get && o.get(PDFName.of('BaseFont'));
        if (!base) continue;
        let name = base.toString().replace(/^\//, '');
        name = name.replace(/^[A-Z]{6}\+/, ''); // strip subset prefix, e.g. "ABCDEF+"
        name = name.replace(/#([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
        if (name) names.add(name);
      }
    }
    return Array.from(names);
  } catch {
    return []; // font parsing is a nice-to-have; never fail the whole analysis over it
  }
}

// Computes the on-screen (device-pixel) rectangles covered by images on a page,
// by tracking the CTM through pdf.js's operator list and converting each image's
// unit square to viewport coords. Lets us remove images by painting over them on
// the ORIGINAL render — which keeps text pixel-perfect and fast, unlike resaving
// the PDF (which breaks text rendering in this serverless stack).
async function getImageBoxes(pdfBytes, pageNumber, scale) {
  const pdfjs = await getResolvedPDFJS();
  const OPS = pdfjs.OPS;
  const inv = Object.fromEntries(Object.entries(OPS).map(([k, v]) => [v, k]));
  const pdf = await getDocumentProxy(Uint8Array.from(pdfBytes));
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const ol = await page.getOperatorList();

  const IMG_OPS = new Set(['paintImageXObject', 'paintJpegXObject', 'paintImageMaskXObject', 'paintInlineImageXObject']);
  const mul = (a, b) => [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const boxes = [];
  for (let i = 0; i < ol.fnArray.length; i++) {
    const nm = inv[ol.fnArray[i]];
    const args = ol.argsArray[i];
    if (nm === 'save') stack.push(ctm.slice());
    else if (nm === 'restore') ctm = stack.pop() || ctm;
    else if (nm === 'transform') ctm = mul(ctm, args);
    else if (IMG_OPS.has(nm)) {
      const user = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => [
        ctm[0] * x + ctm[2] * y + ctm[4],
        ctm[1] * x + ctm[3] * y + ctm[5],
      ]);
      const dev = user.map(([x, y]) => viewport.convertToViewportPoint(x, y));
      const xs = dev.map((p) => p[0]);
      const ys = dev.map((p) => p[1]);
      boxes.push({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) });
    }
  }
  return boxes;
}

// Paints white over the given device-space rectangles on a rendered PNG.
async function maskRegions(pngBuffer, boxes) {
  const img = await loadImage(pngBuffer);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = '#ffffff';
  const pad = 1;
  for (const b of boxes) ctx.fillRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
  try { return await canvas.encode('png'); } catch { return canvas.toBuffer('image/png'); }
}

// Renders one page with the disabled layers removed.
// layers = { text, images } (true = keep). Graphics are always kept.
export async function renderPageWithLayers(pdfBytes, pageNumber, layers, scale = 1.3) {
  const base = Uint8Array.from(pdfBytes);

  // TEXT KEPT: never resave (resaving breaks text in this renderer). Render the
  // original page; if images are off, mask their regions on top.
  if (layers.text) {
    const basePng = await renderPageAsImage(Uint8Array.from(base), pageNumber, { canvas: () => import('@napi-rs/canvas'), scale });
    if (layers.images) return Buffer.from(basePng);
    const boxes = await getImageBoxes(base, pageNumber, scale);
    if (!boxes.length) return Buffer.from(basePng);
    return Buffer.from(await maskRegions(Buffer.from(basePng), boxes));
  }

  // TEXT DROPPED: safe (and fast) to resave, since there is no text to render.
  // Strip text (and images if requested) at the source; graphics are kept.
  const srcDoc = await PDFDocument.load(base, { updateMetadata: false });
  const pages = srcDoc.getPages();
  const pg = pages[pageNumber - 1];
  if (!pg) throw new Error(`Page ${pageNumber} does not exist`);
  const node = pg.node;

  const imageNames = new Set();
  const res = node.Resources();
  const xobj = res && res.get(PDFName.of('XObject'));
  if (xobj && xobj.entries) {
    for (const [k, v] of xobj.entries()) {
      const o = node.context.lookup(v);
      const sub = o && o.dict && o.dict.get(PDFName.of('Subtype'));
      if (sub && sub.toString() === '/Image') imageNames.add(k.toString());
    }
  }

  const contentsRef = node.get(PDFName.of('Contents'));
  const contents = node.context.lookup(contentsRef);
  let raw = '';
  if (contents instanceof PDFArray) {
    for (const r of contents.array) raw += decodeStream(node.context.lookup(r)) + '\n';
  } else if (contents) {
    raw = decodeStream(contents);
  }

  const filtered = filterContentStream(raw, imageNames, { text: false, images: layers.images, graphics: true });
  const newStream = node.context.stream(filtered);
  node.set(PDFName.of('Contents'), node.context.register(newStream));

  const outBytes = await srcDoc.save({ useObjectStreams: false });
  const png = await renderPageAsImage(Uint8Array.from(outBytes), pageNumber, { canvas: () => import('@napi-rs/canvas'), scale });
  return Buffer.from(png);
}
