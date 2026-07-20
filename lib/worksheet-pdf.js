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
