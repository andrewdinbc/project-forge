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
import { renderPageAsImage, getDocumentProxy } from 'unpdf';

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

// Renders one page with the disabled content layers stripped.
// layers = { text, images, graphics } (true = keep).
export async function renderPageWithLayers(pdfBytes, pageNumber, layers, scale = 1.3) {
  const base = Uint8Array.from(pdfBytes);

  // Fast path: nothing to strip.
  if (layers.text && layers.images && layers.graphics) {
    const png = await renderPageAsImage(Uint8Array.from(base), pageNumber, { canvas: () => import('@napi-rs/canvas'), scale });
    return Buffer.from(png);
  }

  // Copy ONLY the target page into a fresh 1-page doc so save() stays small.
  const srcDoc = await PDFDocument.load(base, { updateMetadata: false });
  if (pageNumber < 1 || pageNumber > srcDoc.getPageCount()) throw new Error(`Page ${pageNumber} does not exist`);
  const oneDoc = await PDFDocument.create();
  const [copied] = await oneDoc.copyPages(srcDoc, [pageNumber - 1]);
  oneDoc.addPage(copied);
  const node = copied.node;

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

  const filtered = filterContentStream(raw, imageNames, layers);
  const newStream = node.context.stream(filtered);
  node.set(PDFName.of('Contents'), node.context.register(newStream));

  const outBytes = await oneDoc.save({ useObjectStreams: false });
  const png = await renderPageAsImage(Uint8Array.from(outBytes), 1, { canvas: () => import('@napi-rs/canvas'), scale });
  return Buffer.from(png);
}
