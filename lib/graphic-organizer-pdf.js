import { rgb } from 'pdf-lib';
import { addThemedWorksheetPage, drawThemeBorder, wrapLines, PAGE_W, PAGE_H, INK, NAVY, LINE } from './worksheet-pdf';

const BOX = rgb(0.2, 0.2, 0.2);
const FILL_TEXT = rgb(0.15, 0.3, 0.2);

// Draws either wrapped AI-generated text, or blank ruled lines to write on,
// inside a given rectangle -- every primitive below uses this so "blank"
// vs "AI-filled" behaves identically everywhere.
function fillArea(page, helv, x, y, w, h, text) {
  if (text) {
    const lines = wrapLines(text, helv, 9, w - 10);
    let ty = y + h - 14;
    for (const line of lines) {
      if (ty < y + 4) break;
      page.drawText(line, { x: x + 5, y: ty, size: 9, font: helv, color: FILL_TEXT });
      ty -= 12;
    }
  } else {
    const ruleCount = Math.max(1, Math.floor((h - 14) / 14));
    for (let i = 0; i < ruleCount; i++) {
      const ly = y + h - 16 - i * 14;
      page.drawLine({ start: { x: x + 5, y: ly }, end: { x: x + w - 5, y: ly }, thickness: 0.5, color: LINE });
    }
  }
}

function labeledBox(page, helvBold, helv, x, y, w, h, label, text) {
  page.drawRectangle({ x, y, width: w, height: h, borderColor: BOX, borderWidth: 1 });
  page.drawText(label, { x: x + 5, y: y + h - 12, size: 9, font: helvBold, color: NAVY });
  fillArea(page, helv, x, y, w, h - 16, text);
}

// ---- boxes: vertically stacked labeled boxes (paragraph organizers, persuasive writing, story maps) ----
export async function drawBoxesLayout({ doc, helv, helvBold, title, subtitle, theme }, slots, content) {
  let page = await addThemedWorksheetPage(doc, helvBold, helv, title, subtitle, theme);
  const top = PAGE_H - 140, boxW = PAGE_W - 108;
  const boxH = Math.min(90, (top - 60) / slots.length);
  let y = top;
  for (const label of slots) {
    if (y - boxH < 50) { page = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, page, theme); y = PAGE_H - 60; }
    labeledBox(page, helvBold, helv, 54, y - boxH, boxW, boxH, label, content?.[label]);
    y -= boxH + 10;
  }
}

// ---- columns: 2-4 column table (T-charts, KWL/KWHL, column organizers, character comparisons) ----
export async function drawColumnsLayout({ doc, helv, helvBold, title, subtitle, theme }, columns, content) {
  const page = await addThemedWorksheetPage(doc, helvBold, helv, title, subtitle, theme);
  const top = PAGE_H - 140, totalW = PAGE_W - 108, colW = totalW / columns.length, colH = top - 70;
  columns.forEach((label, i) => {
    const x = 54 + i * colW;
    page.drawRectangle({ x, y: 70, width: colW, height: colH, borderColor: BOX, borderWidth: 1 });
    const tw = helvBold.widthOfTextAtSize(label, 11);
    page.drawText(label, { x: x + (colW - tw) / 2, y: 70 + colH - 18, size: 11, font: helvBold, color: NAVY });
    fillArea(page, helv, x, 70, colW, colH - 22, content?.[label]);
  });
}

// ---- radial: center + N surrounding slots connected by lines (webs, wheels, vocab web, question words) ----
export async function drawRadialLayout({ doc, helv, helvBold, title, subtitle, theme }, centerLabel, slots, content) {
  const page = await addThemedWorksheetPage(doc, helvBold, helv, title, subtitle, theme);
  const cx = PAGE_W / 2, cy = PAGE_H / 2 - 40, centerR = 55;
  page.drawEllipse({ x: cx, y: cy, xScale: centerR, yScale: centerR, borderColor: BOX, borderWidth: 1.5, color: rgb(0.96, 0.96, 0.9) });
  const centerText = content?.[centerLabel] || centerLabel;
  const lines = wrapLines(centerText, helvBold, 10, centerR * 1.7);
  let ty = cy + ((lines.length - 1) * 12) / 2;
  for (const line of lines) {
    const w = helvBold.widthOfTextAtSize(line, 10);
    page.drawText(line, { x: cx - w / 2, y: ty, size: 10, font: helvBold, color: NAVY });
    ty -= 12;
  }
  const n = slots.length, radius = 230, boxW = 130, boxH = 70;
  slots.forEach((label, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const px = cx + radius * Math.cos(angle), py = cy + radius * Math.sin(angle) * 0.62;
    const bx = Math.max(54, Math.min(PAGE_W - 54 - boxW, px - boxW / 2));
    const by = Math.max(54, Math.min(PAGE_H - 140, py - boxH / 2));
    page.drawLine({ start: { x: cx, y: cy }, end: { x: bx + boxW / 2, y: by + boxH / 2 }, thickness: 1, color: LINE });
    labeledBox(page, helvBold, helv, bx, by, boxW, boxH, label, content?.[label]);
  });
}

// ---- venn: two overlapping circles (Venn diagrams, character comparisons) ----
export async function drawVennLayout({ doc, helv, helvBold, title, subtitle, theme }, labelA, labelB, labelBoth, content) {
  const page = await addThemedWorksheetPage(doc, helvBold, helv, title, subtitle, theme);
  const r = 160, cy = PAGE_H / 2 - 60, cxA = PAGE_W / 2 - 90, cxB = PAGE_W / 2 + 90;
  page.drawEllipse({ x: cxA, y: cy, xScale: r, yScale: r, borderColor: BOX, borderWidth: 1.5 });
  page.drawEllipse({ x: cxB, y: cy, xScale: r, yScale: r, borderColor: BOX, borderWidth: 1.5 });
  page.drawText(labelA, { x: cxA - r + 20, y: cy + r - 20, size: 11, font: helvBold, color: NAVY });
  page.drawText(labelB, { x: cxB + r - 20 - helvBold.widthOfTextAtSize(labelB, 11), y: cy + r - 20, size: 11, font: helvBold, color: NAVY });
  const bw = helvBold.widthOfTextAtSize(labelBoth, 10);
  page.drawText(labelBoth, { x: PAGE_W / 2 - bw / 2, y: cy - 4, size: 10, font: helvBold, color: NAVY });
  fillArea(page, helv, cxA - r + 15, cy - 60, 110, 130, content?.[labelA]);
  fillArea(page, helv, cxB + r - 125, cy - 60, 110, 130, content?.[labelB]);
  fillArea(page, helv, PAGE_W / 2 - 45, cy - 60, 90, 50, content?.[labelBoth]);
}

// ---- chain: N boxes in sequence, left to right, wrapping rows (sequence chains, sequencing film) ----
export async function drawChainLayout({ doc, helv, helvBold, title, subtitle, theme }, count, content) {
  const page = await addThemedWorksheetPage(doc, helvBold, helv, title, subtitle, theme);
  const cols = count <= 4 ? count : 3, boxW = (PAGE_W - 108 - (cols - 1) * 16) / cols, boxH = 110;
  let x = 54, y = PAGE_H - 160;
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    if (col === 0 && i > 0) y -= boxH + 30;
    x = 54 + col * (boxW + 16);
    labeledBox(page, helvBold, helv, x, y, boxW, boxH, `Step ${i + 1}`, content?.[`Step ${i + 1}`]);
    if (col < cols - 1 && i < count - 1) {
      page.drawText('→', { x: x + boxW + 2, y: y + boxH / 2 - 6, size: 16, font: helvBold, color: BOX });
    }
  }
}

// ---- quadrant: center word + 4 surrounding boxes (Frayer model) ----
export async function drawQuadrantLayout({ doc, helv, helvBold, title, subtitle, theme }, centerLabel, slots, content) {
  const page = await addThemedWorksheetPage(doc, helvBold, helv, title, subtitle, theme);
  const size = 220, cx = PAGE_W / 2 - size / 2, cy = PAGE_H / 2 - size / 2 - 30;
  const half = size / 2;
  [[cx, cy + half], [cx + half, cy + half], [cx, cy], [cx + half, cy]].forEach(([x, y], i) => {
    labeledBox(page, helvBold, helv, x, y, half, half, slots[i], content?.[slots[i]]);
  });
  const centerW = 130, centerH = 40;
  page.drawRectangle({ x: cx + size / 2 - centerW / 2, y: cy + size / 2 - centerH / 2, width: centerW, height: centerH, color: rgb(1, 1, 1), borderColor: BOX, borderWidth: 1.5 });
  const centerText = content?.[centerLabel] || centerLabel;
  const tw = helvBold.widthOfTextAtSize(centerText, 12);
  page.drawText(centerText, { x: cx + size / 2 - tw / 2, y: cy + size / 2 - 4, size: 12, font: helvBold, color: NAVY });
}

// ---- tree: root + branching children, 1-3 levels (relationship trees) ----
export async function drawTreeLayout({ doc, helv, helvBold, title, subtitle, theme }, rootLabel, levels, content) {
  const page = await addThemedWorksheetPage(doc, helvBold, helv, title, subtitle, theme);
  const rootW = 160, rootH = 40, rootX = PAGE_W / 2 - rootW / 2, rootY = PAGE_H - 170;
  labeledBox(page, helvBold, helv, rootX, rootY, rootW, rootH, rootLabel, content?.[rootLabel]);

  const branch = (x, y, w, h, label, depth, remaining) => {
    if (remaining <= 0) return;
    const childCount = 2, childW = w * 0.85, childH = 60, gapY = 60;
    const totalChildW = childCount * childW + (childCount - 1) * 20;
    let cx = x + w / 2 - totalChildW / 2;
    const cy = y - gapY;
    for (let i = 0; i < childCount; i++) {
      const label2 = `${label} ${i === 0 ? 'A' : 'B'}`;
      page.drawLine({ start: { x: x + w / 2, y }, end: { x: cx + childW / 2, y: cy + childH }, thickness: 1, color: LINE });
      labeledBox(page, helvBold, helv, cx, cy, childW, childH, label2, content?.[label2]);
      branch(cx, cy, childW, childH, label2, depth + 1, remaining - 1);
      cx += childW + 20;
    }
  };
  branch(rootX, rootY, rootW, rootH, rootLabel, 1, levels);
}
