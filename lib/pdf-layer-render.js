// lib/pdf-layer-render.js
// Acrobat-style visual "layers" for a flat PDF page (Aj, 2026-07-19).
//
// Flat teacher PDFs almost never carry real Optional Content Group layers,
// so there is nothing built in to toggle. Instead we DERIVE three visual
// layers by content type and strip the disabled ones at the PDF-source level,
// then render the result normally with unpdf/@napi-rs/canvas (the same stack
// lib/pdf-page-render.js already uses):
//   - text     : everything inside BT ... ET text objects
//   - images   : image XObject draws (/Name Do where Name is an /Image) and
//                inline images (BI ... ID ... EI)
//   - graphics : vector path PAINTING ops (fill/stroke); path construction is
//                left in place but neutered to `n` (end path, no paint), which
//                preserves the graphics state / clipping.
//
// Verified end-to-end before shipping: removing any one type leaves a valid,
// renderable PDF and the corresponding operators disappear from pdf.js's
// operator list.
//
// Known limits (honest): content inside a Form XObject is not recursed into,
// so vector/text drawn via a form isn't split out; and any layer isolated as
// a render is a flattened raster, not editable content. Good enough for
// "see the page without the clipart / borders / text" — not a PDF editor.

import { PDFDocument, PDFName, PDFArray, decodePDFRawStream } from 'pdf-lib';
import { renderPageAsImage, getDocumentProxy } from 'unpdf';

const PAINT_OPS = new Set(['S', 's', 'f', 'F', 'f*', 'B', 'B*', 'b', 'b*']);

// Minimal PDF content-stream tokenizer. Yields { t, v } tokens where t is one
// of: str, hex, dict, arr, name, num, op. Handles (), <>, <<>>, [], /name,
// comments, and whitespace the way the PDF spec requires.
function tokenize(str) {
  const toks = [];
  let i = 0;
  const n = str.length;
  const isWS = (c) => c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === '\f' || c === '\0';
  const isDelim = (c) => '()<>[]{}/%'.includes(c);
  while (i < n) {
    const c = str[i];
    if (isWS(c)) { i++; continue; }
    if (c === '%') { while (i < n && str[i] !== '\n' && str[i] !== '\r') i++; continue; }
    if (c === '(') {
      let depth = 0, j = i;
      do {
        const ch = str[j];
        if (ch === '\\') { j += 2; continue; }
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        j++;
      } while (j < n && depth > 0);
      toks.push({ t: 'str', v: str.slice(i, j) }); i = j; continue;
    }
    if (c === '<' && str[i + 1] === '<') {
      let depth = 0, j = i;
      do {
        if (str[j] === '<' && str[j + 1] === '<') { depth++; j += 2; continue; }
        if (str[j] === '>' && str[j + 1] === '>') { depth--; j += 2; continue; }
        j++;
      } while (j < n && depth > 0);
      toks.push({ t: 'dict', v: str.slice(i, j) }); i = j; continue;
    }
    if (c === '<') { let j = i + 1; while (j < n && str[j] !== '>') j++; j++; toks.push({ t: 'hex', v: str.slice(i, j) }); i = j; continue; }
    if (c === '[') { let j = i + 1; while (j < n && str[j] !== ']') j++; j++; toks.push({ t: 'arr', v: str.slice(i, j) }); i = j; continue; }
    if (c === '/') { let j = i + 1; while (j < n && !isWS(str[j]) && !isDelim(str[j])) j++; toks.push({ t: 'name', v: str.slice(i, j) }); i = j; continue; }
    let j = i; while (j < n && !isWS(str[j]) && !isDelim(str[j])) j++;
    const w = str.slice(i, j); i = j;
    if (/^[-+]?[0-9.]+$/.test(w)) toks.push({ t: 'num', v: w });
    else toks.push({ t: 'op', v: w });
  }
  return toks;
}

function filterContentStream(str, imageNames, { text = true, images = true, graphics = true }) {
  const toks = tokenize(str);
  const out = [];
  let operands = [];
  let inText = false;
  const flush = () => { for (const o of operands) out.push(o); operands = []; };
  for (let k = 0; k < toks.length; k++) {
    const tk = toks[k];
    if (tk.t !== 'op') { operands.push(tk); continue; }
    const op = tk.v;
    if (op === 'BI') {
      let j = k;
      while (j < toks.length && !(toks[j].t === 'op' && toks[j].v === 'EI')) j++;
      if (!images) { operands = []; k = j; continue; }
      flush(); out.push(tk); continue;
    }
    if (op === 'BT') { inText = true; if (text) { flush(); out.push(tk); } else { operands = []; } continue; }
    if (op === 'ET') { if (text) out.push(tk); inText = false; operands = []; continue; }
    if (inText) { if (text) { flush(); out.push(tk); } else { operands = []; } continue; }
    if (op === 'Do') {
      const nm = operands[operands.length - 1];
      const isImg = nm && nm.t === 'name' && imageNames.has(nm.v);
      if (isImg && !images) { operands = []; continue; }
      flush(); out.push(tk); continue;
    }
    if (op === 'sh' && !graphics) { operands = []; continue; }
    if (PAINT_OPS.has(op) && !graphics) { flush(); out.push({ t: 'op', v: 'n' }); continue; }
    flush(); out.push(tk);
  }
  return out.map((t) => t.v).join(' ');
}

function decodeStream(s) {
  return Buffer.from(decodePDFRawStream(s).decode()).toString('latin1');
}

// Returns the count of pages in the PDF (thin wrapper for the route).
export async function getPageCount(pdfBytes) {
  // unpdf may transfer the buffer to a worker; hand it a standalone copy so the
  // caller's bytes are never detached.
  const pdf = await getDocumentProxy(Uint8Array.from(pdfBytes));
  return pdf.numPages;
}

// Produces a PNG of one page with the disabled content layers stripped out.
// layers = { text, images, graphics } (booleans; true = keep that layer).
export async function renderPageWithLayers(pdfBytes, pageNumber, layers, scale = 1.5) {
  const base = Uint8Array.from(pdfBytes); // own copy we control

  // If every layer is on, skip the surgery and just render the original.
  if (layers.text && layers.images && layers.graphics) {
    const png = await renderPageAsImage(Uint8Array.from(base), pageNumber, { canvas: () => import('@napi-rs/canvas'), scale });
    return Buffer.from(png);
  }

  const doc = await PDFDocument.load(base, { updateMetadata: false });
  const pages = doc.getPages();
  const pg = pages[pageNumber - 1];
  if (!pg) throw new Error(`Page ${pageNumber} does not exist`);
  const node = pg.node;

  // Which XObjects on this page are images (vs forms)?
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

  // Decode the page content (may be a single stream or an array of streams).
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
  const ref = node.context.register(newStream);
  node.set(PDFName.of('Contents'), ref);

  const outBytes = await doc.save({ useObjectStreams: false });
  const png = await renderPageAsImage(Uint8Array.from(outBytes), pageNumber, { canvas: () => import('@napi-rs/canvas'), scale });
  return Buffer.from(png);
}
