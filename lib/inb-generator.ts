import { rgb } from 'pdf-lib';
import { matchComponentToShape, ShapeMatch } from './schema-shape-match';

// Interactive Notebook Generator (Aj, 2026-07-20): "In the end I want you to
// make a Interactive Notebook Generator." This is the closing link Schema
// Lab's own generate route explicitly said it deliberately stopped short of:
// "this generates the STRUCTURAL TEXT CONTENT... it does NOT generate a
// finished, laid-out foldable-template PDF." That gap is exactly what this
// module + app/api/inb-generator/generate/route.ts fill in, using the
// Foldable Shape Library + lib/schema-shape-match.ts built alongside it.
//
// Every schema component is classified into one of four buckets:
//   'shape' -- matches a Foldable Shape Library entry (AI writes N labeled
//              sub-items, code draws the real cut/fold geometry)
//   'text'  -- genuine new subject content, no fixed geometry (AI writes a
//              short paragraph, code lays it out as a plain page)
//   'auto'  -- structural/mechanical, not content -- generated entirely in
//              code, no AI call (cover, table of contents, assembly order)
//   'skip'  -- doesn't make sense for freshly-generated original material
//              (Terms of Use, Credits, Promotional/Resource Link pages --
//              those describe the ORIGINAL seller's TPT listing, not
//              anything this generator produces)

const AUTO_KEYWORDS = ['title/cover page', 'table of contents', 'assembly direction', 'directions page'];
const SKIP_KEYWORDS = ['terms of use', 'credits', 'promotional', 'resource link'];

export type ComponentKind = 'shape' | 'text' | 'auto' | 'skip';

export interface ClassifiedComponent {
  name: string;
  purpose: string;
  kind: ComponentKind;
  shape: ShapeMatch | null;
}

export function classifyComponents(components: { name: string; purpose: string }[]): ClassifiedComponent[] {
  return components.map((c) => {
    const text = `${c.name} ${c.purpose}`.toLowerCase();
    if (SKIP_KEYWORDS.some((k) => text.includes(k))) return { ...c, kind: 'skip' as const, shape: null };
    if (AUTO_KEYWORDS.some((k) => text.includes(k))) return { ...c, kind: 'auto' as const, shape: null };
    const shape = matchComponentToShape(c.name, c.purpose);
    if (shape) return { ...c, kind: 'shape' as const, shape };
    return { ...c, kind: 'text' as const, shape: null };
  });
}

const BLACK = rgb(0, 0, 0);
const NAVY = rgb(0.11, 0.21, 0.34); // #1c3557, Chalk & Circuit brand navy
const GOLD = rgb(0.71, 0.49, 0.16); // #b57c2a
const GRAY = rgb(0.5, 0.5, 0.5);

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = (text || '').split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function centeredText(page: any, text: string, cx: number, y: number, size: number, font: any, color: any) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: cx - w / 2, y, size, font, color });
}

export function drawCoverPage(page: any, opts: { width: number; height: number; title: string; subject: string; grade: string | number; jurisdiction: string; font: any; boldFont: any }) {
  const { width, height, title, subject, grade, jurisdiction, font, boldFont } = opts;
  const cx = width / 2;
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: GOLD, borderWidth: 2.5 });
  page.drawRectangle({ x: 34, y: 34, width: width - 68, height: height - 68, borderColor: NAVY, borderWidth: 1 });

  const titleLines = wrapText(title, boldFont, 28, width * 0.7);
  let ty = height * 0.62 + ((titleLines.length - 1) * 32) / 2;
  for (const line of titleLines) {
    centeredText(page, line, cx, ty, 28, boldFont, NAVY);
    ty -= 32;
  }
  centeredText(page, 'Interactive Notebook', cx, ty - 10, 14, font, GOLD);
  centeredText(page, `${subject} \u2014 Grade ${grade}`, cx, height * 0.35, 16, boldFont, BLACK);
  centeredText(page, jurisdiction, cx, height * 0.35 - 22, 11, font, GRAY);
  centeredText(page, 'Generated with Chalk & Circuit Schema Lab', cx, 60, 8, font, GRAY);
}

export function drawTOCPage(page: any, opts: { width: number; height: number; items: string[]; font: any; boldFont: any }) {
  const { width, height, items, font, boldFont } = opts;
  page.drawText('Table of Contents', { x: 50, y: height - 60, size: 20, font: boldFont, color: NAVY });
  page.drawLine({ start: { x: 50, y: height - 72 }, end: { x: width - 50, y: height - 72 }, thickness: 1.5, color: GOLD });
  let y = height - 100;
  items.forEach((label, i) => {
    if (y < 60) return;
    page.drawText(`${i + 1}.`, { x: 50, y, size: 11, font: boldFont, color: NAVY });
    page.drawText(label, { x: 78, y, size: 11, font, color: BLACK });
    y -= 22;
  });
}

export function drawDirectionsPage(page: any, opts: { width: number; height: number; items: { label: string; instructions: string }[]; font: any; boldFont: any }) {
  const { width, height, items, font, boldFont } = opts;
  page.drawText('Assembly Directions', { x: 50, y: height - 60, size: 20, font: boldFont, color: NAVY });
  page.drawLine({ start: { x: 50, y: height - 72 }, end: { x: width - 50, y: height - 72 }, thickness: 1.5, color: GOLD });
  page.drawText('Glue each page into your notebook in this order. Cut/fold each page as noted on it before gluing.', { x: 50, y: height - 92, size: 9.5, font, color: GRAY });
  let y = height - 120;
  items.forEach((it, i) => {
    if (y < 60) return;
    page.drawText(`${i + 1}. ${it.label}`, { x: 50, y, size: 11, font: boldFont, color: BLACK });
    y -= 15;
    const lines = wrapText(it.instructions, font, 9, width - 120);
    for (const line of lines) {
      if (y < 50) break;
      page.drawText(line, { x: 68, y, size: 9, font, color: GRAY });
      y -= 12;
    }
    y -= 6;
  });
}

export function drawTextPage(page: any, opts: { width: number; height: number; title: string; content: string; font: any; boldFont: any }) {
  const { width, height, title, content, font, boldFont } = opts;
  page.drawText(title, { x: 50, y: height - 60, size: 18, font: boldFont, color: NAVY });
  page.drawLine({ start: { x: 50, y: height - 72 }, end: { x: width - 50, y: height - 72 }, thickness: 1.5, color: GOLD });
  const lines = wrapText(content, font, 11, width - 100);
  let y = height - 100;
  for (const line of lines) {
    if (y < 50) break;
    page.drawText(line, { x: 50, y, size: 11, font, color: BLACK });
    y -= 16;
  }
}
