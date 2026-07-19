import { rgb } from 'pdf-lib';

// Foldable Shape Library (Aj, 2026-07-19): "You will find that a lot of them
// are repeatable... create a foldable shape library in forge." Correct: the
// physical fold/cut geometry an interactive notebook uses is drawn from a
// small, well-established, REPEATABLE set of shapes (the "Dinah Zike
// Foldables" system is the actual origin/standard almost every TPT INB
// seller builds on) -- so instead of asking an image model to hallucinate
// precise geometry (which it can't do reliably), these are exact PDF vector
// drawings: solid lines = cut, dashed lines = fold. Same pdf-lib primitives
// already used throughout Composer's generate/preview routes.
//
// Calibrated against real examples from Aj's uploaded Human Body INB bundle
// (Getting Nerdy, LLC): confirmed a repeated-flap pattern ("Template 1/2")
// matching Flap Book below, on a US Letter page. Layered Book is the other
// extremely common INB staple. More shapes (accordion/Z-fold, shutter fold,
// pocket book, labeled-diagram-with-glue-in like the Fingernail example) are
// a natural next batch -- this is v1, not the full taxonomy.

export const FOLDABLE_SHAPES = [
  {
    key: 'flap-book',
    name: 'Flap Book',
    description: 'N flaps cut from the top edge down to a fold line, each flap lifts independently to reveal content underneath. The most common INB foldable -- confirmed in your Body Systems templates.',
    minCount: 2,
    maxCount: 6,
    defaultCount: 4,
  },
  {
    key: 'layered-book',
    name: 'Layered Book',
    description: 'N separate cut-out strips of decreasing height, stacked and glued/stapled along the top edge so each layer\'s label peeks out below the one in front of it.',
    minCount: 2,
    maxCount: 6,
    defaultCount: 3,
  },
];

const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.55, 0.55, 0.55);

function drawDashedLine(page: any, start: { x: number; y: number }, end: { x: number; y: number }, opts: { thickness?: number; color?: any; dash?: number; gap?: number } = {}) {
  const { thickness = 1, color = BLACK, dash = 5, gap = 4 } = opts;
  const dx = end.x - start.x, dy = end.y - start.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return;
  const ux = dx / dist, uy = dy / dist;
  let pos = 0;
  while (pos < dist) {
    const segEnd = Math.min(pos + dash, dist);
    page.drawLine({
      start: { x: start.x + ux * pos, y: start.y + uy * pos },
      end: { x: start.x + ux * segEnd, y: start.y + uy * segEnd },
      thickness, color,
    });
    pos += dash + gap;
  }
}

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

// N flaps cut from the top edge down to a horizontal fold line; each flap
// hinges independently along that fold line. Label goes on the flap face
// (what's visible closed); content goes in the space revealed underneath
// when a flap is lifted.
export function drawFlapBook(page: any, opts: {
  x: number; y: number; width: number; height: number;
  count: number; labels: string[]; contents: string[];
  font: any; boldFont: any;
}) {
  const { x, y, width, height, count, labels, contents, font, boldFont } = opts;
  const flapAreaH = height * 0.42;
  const foldY = y + height - flapAreaH;
  const topY = y + height;
  const flapW = width / count;

  page.drawRectangle({ x, y, width, height, borderColor: BLACK, borderWidth: 1.5 });
  drawDashedLine(page, { x, y: foldY }, { x: x + width, y: foldY }, { thickness: 1.2 });

  for (let i = 1; i < count; i++) {
    const cx = x + i * flapW;
    page.drawLine({ start: { x: cx, y: topY }, end: { x: cx, y: foldY }, thickness: 1.2, color: BLACK });
  }

  for (let i = 0; i < count; i++) {
    const label = labels[i] || `Flap ${i + 1}`;
    const cx = x + i * flapW + flapW / 2;
    const labelLines = wrapText(label, boldFont, 10, flapW - 10);
    let ly = foldY + flapAreaH / 2 + (labelLines.length - 1) * 6;
    for (const line of labelLines) {
      const tw = boldFont.widthOfTextAtSize(line, 10);
      page.drawText(line, { x: cx - tw / 2, y: ly, size: 10, font: boldFont, color: BLACK });
      ly -= 12;
    }

    const content = contents[i] || '';
    const contentLines = wrapText(content, font, 8, flapW - 12);
    let cy = foldY - 14;
    for (const line of contentLines) {
      if (cy < y + 6) break;
      page.drawText(line, { x: x + i * flapW + 6, y: cy, size: 8, font, color: BLACK });
      cy -= 10;
    }
  }

  page.drawText('Cut on solid lines. Fold up on the dashed line.', { x, y: y - 14, size: 8, font, color: GRAY });
}

// N separate cut-out strips of decreasing height, meant to be cut apart,
// stacked (tallest on the bottom), and glued/stapled along the top edge.
// Drawn as separate labeled cards stacked down the page for cutting, not as
// a single pre-assembled graphic -- that's how these are actually produced
// and used.
export function drawLayeredBook(page: any, opts: {
  x: number; y: number; width: number; height: number;
  count: number; labels: string[]; contents: string[];
  font: any; boldFont: any;
}) {
  const { x, y, width, height, count, labels, contents, font, boldFont } = opts;
  const gap = 14;
  const cardH = (height - gap * (count - 1)) / count;
  const shrinkStep = cardH * 0.18; // each layer toward the front is a bit shorter, revealing a tab

  let cursorY = y + height;
  for (let i = 0; i < count; i++) {
    const layerH = cardH - shrinkStep * i;
    const topY = cursorY;
    const bottomY = cursorY - layerH;

    page.drawRectangle({ x, y: bottomY, width, height: layerH, borderColor: BLACK, borderWidth: 1.2 });
    drawDashedLine(page, { x, y: topY - 10 }, { x: x + width, y: topY - 10 }, { thickness: 1, dash: 4, gap: 3 });
    page.drawText(`Layer ${i + 1} of ${count} — glue/staple along this line`, { x: x + 4, y: topY - 8, size: 6.5, font, color: GRAY });

    const label = labels[i] || `Layer ${i + 1}`;
    page.drawText(label, { x: x + 8, y: topY - 24, size: 10, font: boldFont, color: BLACK });

    const contentLines = wrapText(contents[i] || '', font, 8, width - 16);
    let cy = topY - 38;
    for (const line of contentLines) {
      if (cy < bottomY + 6) break;
      page.drawText(line, { x: x + 8, y: cy, size: 8, font, color: BLACK });
      cy -= 10;
    }

    cursorY -= (cardH + gap);
  }

  page.drawText('Cut each layer out separately, stack (Layer N at the back), glue/staple at the dashed line.', { x, y: y - 14, size: 8, font, color: GRAY });
}
