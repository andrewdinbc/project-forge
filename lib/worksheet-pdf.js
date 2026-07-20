import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const PAGE_W = 612;
export const PAGE_H = 792;
export const INK = rgb(0.1, 0.1, 0.1);
export const NAVY = rgb(0.11, 0.21, 0.34);
export const GRAY = rgb(0.55, 0.55, 0.55);
export const LINE = rgb(0.7, 0.7, 0.7);

export async function newWorksheetDoc() {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { doc, helv, helvBold };
}

// Standard worksheet header: title + optional subtitle + a Name/Date line
// every generator here uses, so a batch of these all looks consistent.
// Plain/untethed version -- no bundle theme. Use addThemedWorksheetPage
// when a bundleId/theme is available.
export function addWorksheetPage(doc, helvBold, helv, title, subtitle) {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  page.drawText(title, { x: 54, y: PAGE_H - 56, size: 18, font: helvBold, color: NAVY });
  let y = PAGE_H - 78;
  if (subtitle) {
    page.drawText(subtitle, { x: 54, y, size: 10, font: helv, color: GRAY });
    y -= 18;
  }
  page.drawText('Name: _______________________________     Date: _______________', { x: 54, y, size: 11, font: helv, color: INK });
  return page;
}

// Async variant: since embedding a border image is async and addWorksheetPage
// is sync (pdf-lib page creation + text draw doesn't need to be), this awaits
// the border embed and draws it FIRST (so text drawn afterward sits on top),
// then re-draws the standard header on top of it. Use this in generators
// that accept a bundleId/theme; use plain addWorksheetPage otherwise.
export async function addThemedWorksheetPage(doc, helvBold, helv, title, subtitle, theme) {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  await drawThemeBorder(doc, page, theme);
  page.drawText(title, { x: 54, y: PAGE_H - 56, size: 18, font: helvBold, color: NAVY });
  let y = PAGE_H - 78;
  if (subtitle) {
    page.drawText(subtitle, { x: 54, y, size: 10, font: helv, color: GRAY });
    y -= 18;
  }
  page.drawText('Name: _______________________________     Date: _______________', { x: 54, y, size: 11, font: helv, color: INK });
  return page;
}

export function wrapLines(text, font, size, maxWidth) {
  const out = [];
  for (const paragraph of String(text || '').split('\n')) {
    if (!paragraph.trim()) { out.push(''); continue; }
    const words = paragraph.split(' ');
    let line = '';
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        out.push(line);
        line = w;
      } else {
        line = candidate;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

export async function uploadWorksheetPdf(admin, userId, bytes, folder, filename) {
  const path = `${userId}/worksheet-generators/${folder}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error } = await admin.storage.from('product-files').upload(path, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true });
  if (error) throw new Error(error.message);
  const { data } = admin.storage.from('product-files').getPublicUrl(path);
  return data.publicUrl;
}

// ---------- Bundle theming (Aj, 2026-07-19 evening) ----------
// Worksheet Generators have always produced plain, unstyled pages -- no
// border, no section header art -- while Product Builder already has a
// real Border/Section Header/Font/Spacing/Icon/Color system pulled from
// the Parts Library (app/api/product-builder/generate/route.ts). This is
// the same pattern, extracted into a shared helper so every generator in
// the catalog (sudoku, kenken, word search, bingo, etc.) can optionally
// carry a bundle's chosen visual theme without each route re-implementing
// image fetch/embed/draw logic. Pass a bundleId; if the bundle has no
// theme picked, or a part fails to load, this is a silent no-op -- a
// worksheet must never fail to generate because of a missing border.
export async function loadBundleTheme(admin, userId, bundleId) {
  if (!bundleId) return null;
  try {
    const { data: bundle } = await admin.from('bundles').select('style_selections').eq('id', bundleId).eq('user_id', userId).single();
    const sel = bundle?.style_selections;
    if (!sel || (!sel.border && !sel.section_header)) return null;
    const fetchPart = async (id) => {
      if (!id) return null;
      const { data } = await admin.from('library_parts').select('file_url, title').eq('id', id).eq('user_id', userId).single();
      return data || null;
    };
    const [borderPart, headerPart] = await Promise.all([fetchPart(sel.border), fetchPart(sel.section_header)]);
    if (!borderPart?.file_url && !headerPart?.file_url) return null;
    return { borderUrl: borderPart?.file_url || null, headerUrl: headerPart?.file_url || null };
  } catch {
    return null; // theming is always optional -- never block generation
  }
}

async function embedThemeImage(doc, url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`theme image fetch failed (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  try { return await doc.embedPng(bytes); } catch { return await doc.embedJpg(bytes); }
}

// Draws a bundle's full-bleed border image behind a page's existing
// content. Call AFTER addWorksheetPage (or before drawing puzzle content)
// -- pdf-lib draws in call order, so a full-page image drawn first sits
// underneath everything added after it. Caches the embedded image on the
// theme object so a multi-page worksheet (puzzle + answer key) only
// fetches/embeds the border once.
export async function drawThemeBorder(doc, page, theme) {
  if (!theme?.borderUrl) return;
  try {
    if (!theme._borderImg) theme._borderImg = await embedThemeImage(doc, theme.borderUrl);
    page.drawImage(theme._borderImg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
  } catch { /* decorative -- never fail the worksheet over a border image */ }
}

// Same idea for the section-header banner, placed as a strip under the
// title/subtitle instead of full-bleed. Returns the y position below the
// banner so the caller can continue laying out content from there.
export async function drawThemeHeader(doc, page, theme, topY) {
  if (!theme?.headerUrl) return topY;
  try {
    if (!theme._headerImg) theme._headerImg = await embedThemeImage(doc, theme.headerUrl);
    const w = PAGE_W - 108;
    const h = Math.min(60, (theme._headerImg.height / theme._headerImg.width) * w);
    page.drawImage(theme._headerImg, { x: 54, y: topY - h, width: w, height: h });
    return topY - h - 10;
  } catch {
    return topY;
  }
}

// Simple deterministic PRNG helpers so "generate again" gives a fresh set
// each time without needing a seed the client has to manage.
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
