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

// Encoding: each shape is described declaratively so OTHER code (the
// Interactive Notebook Generator, in particular) can pick a shape for a
// schema-defined structural component without hardcoding a name->key map by
// hand. `mechanic` groups shapes by physical interaction pattern (used for
// writing the right one-line instructions automatically); `matchKeywords`
// are terms likely to appear in an AI-written component name/purpose
// (from Schema Lab's analyze-structure/synthesize output) that this shape
// satisfies -- see lib/schema-shape-match.ts for the matcher that consumes
// this. `minCount`/`maxCount`/`defaultCount` bound how many labeled
// sections the shape supports; shapes with a fixed structure (puzzle piece,
// silhouette card) just set min=max.
export const FOLDABLE_SHAPES = [
  {
    key: 'flap-book',
    name: 'Flap Book',
    description: 'N flaps cut from the top edge down to a fold line, each flap lifts independently to reveal content underneath. The most common INB foldable -- confirmed in your Body Systems templates.',
    mechanic: 'fold-and-lift',
    minCount: 2,
    maxCount: 6,
    defaultCount: 4,
    matchKeywords: ['flap', 'lift-the-flap', 'fold', 'foldable template', 'flip'],
  },
  {
    key: 'layered-book',
    name: 'Layered Book',
    description: 'N separate cut-out strips of decreasing height, stacked and glued/stapled along the top edge so each layer\'s label peeks out below the one in front of it.',
    mechanic: 'assemble-and-glue',
    minCount: 2,
    maxCount: 6,
    defaultCount: 3,
    matchKeywords: ['layer', 'layered', 'stack', 'accordion', 'booklet'],
  },
  {
    key: 'radial-foldable',
    name: 'Multi-Flap Radial Foldable (Petal Fold)',
    description: 'A central polygon with N triangular petal-flaps radiating outward, each hinged along a polygon edge and folding inward to close over the center. Used for subtopics branching from one central concept.',
    mechanic: 'fold-and-lift',
    minCount: 3,
    maxCount: 6,
    defaultCount: 4,
    matchKeywords: ['radial', 'petal', 'flower', 'pentagon', 'hexagon', 'multi-flap', 'branching', 'central concept', 'found in', 'advantages'],
  },
  {
    key: 'two-panel-comparison',
    name: 'Two-Panel Comparison Foldable (Shutter Fold)',
    description: 'Two outer panels hinge inward from a central strip like double doors, closing to hide a middle comparison/answer area. Used for contrasting two related concepts side by side.',
    mechanic: 'fold-and-lift',
    minCount: 2,
    maxCount: 2,
    defaultCount: 2,
    matchKeywords: ['two-panel', 'comparison', 'compare', 'contrast', 'vs', 'shutter', 'side-by-side', 'venn'],
  },
  {
    key: 'puzzle-piece',
    name: 'Puzzle-Piece Interlocking Foldable',
    description: 'Two concepts printed on a single card divided by an interlocking jigsaw-style seam, visually reinforcing that the two ideas fit together (e.g. Prior Knowledge + Inference). Cut around the outer edge only.',
    mechanic: 'cut-and-mount',
    minCount: 2,
    maxCount: 2,
    defaultCount: 2,
    matchKeywords: ['puzzle', 'jigsaw', 'interlock', 'puzzle piece', 'interlocking piece', 'fit together', 'prior knowledge', 'inference'],
  },
  {
    key: 'silhouette-card',
    name: 'Shaped Vocabulary Card',
    description: 'A single term/definition card cut to a decorative outline (circle, banner ribbon, badge, or cloud) instead of a plain rectangle. Used for glossary terms, labeled diagrams, or callout facts.',
    mechanic: 'cut-and-mount',
    minCount: 1,
    maxCount: 1,
    defaultCount: 1,
    outlineOptions: ['circle', 'banner', 'badge', 'cloud'],
    matchKeywords: ['label', 'callout', 'vocabulary', 'term', 'badge', 'banner', 'cloud', 'cut-and-paste label', 'card'],
  },
  {
    key: 'storage-pocket',
    name: 'Storage Pocket / Envelope',
    description: 'A front panel with three fold-under flaps (left, right, bottom) that fold behind and glue to form an open-top pocket, glued onto a lapbook base to hold loose cards or small pieces. Confirmed against a real uploaded lapbook (Electricity Lapbook, Single Copy) -- lapbooks lean on this shape heavily for vocabulary card storage.',
    mechanic: 'assemble-and-glue',
    minCount: 1,
    maxCount: 1,
    defaultCount: 1,
    matchKeywords: ['pocket', 'envelope', 'pouch', 'storage'],
  },
  {
    key: 'accordion-booklet',
    name: 'Accordion Mini-Booklet',
    description: 'N equal panels in a single strip, cut out as one piece and folded in alternating mountain/valley creases (Z-fold) into a small flip-through booklet. Genuinely sequential, turn-the-page content -- distinct from Layered Book, which reveals stacked tabs rather than flipping pages.',
    mechanic: 'fold-and-lift',
    minCount: 3,
    maxCount: 6,
    defaultCount: 4,
    matchKeywords: ['accordion', 'flip book', 'mini-booklet', 'mini book', 'sequential', 'z-fold', 'zigzag', 'booklet'],
  },
  {
    key: 'card-grid',
    name: 'Task Card Grid',
    description: 'A print-and-cut-apart grid of self-contained numbered cards, each with a prompt and a question. No fold at all -- the first shape in this library built for a print-once, reuse-forever genre (Task Cards) rather than an assemble-once notebook/lapbook piece. Confirmed against 4 cross-seller task card products.',
    mechanic: 'print-and-cut',
    minCount: 4,
    maxCount: 8,
    defaultCount: 6,
    matchKeywords: ['task card', 'task cards', 'numbered card', 'self-contained prompt'],
  },
  {
    key: 'recording-sheet',
    name: 'Recording Sheet',
    description: 'A numbered grid of blank response lines matching a task card set 1-for-1, so students log answers here instead of writing on the (reusable/laminated) cards themselves.',
    mechanic: 'text-only',
    minCount: 4,
    maxCount: 8,
    defaultCount: 6,
    matchKeywords: ['recording sheet', 'response sheet', 'answer sheet', 'numbered blank', 'student response'],
  },
  {
    key: 'game-board-track',
    name: 'Game Board Track',
    description: 'N numbered spaces laid out as a continuous snake path across the page, the shared play surface for a print-and-play board game where players move a marker space by space. Confirmed against 7 cross-mechanic game shells (Zoom, Monster Mix-up, Bingo Showdown, Spin 4/2, Spin-N-Bump, Roll-N-Bump) that all share this same underlying board despite very different win conditions.',
    mechanic: 'print-and-cut',
    minCount: 12,
    maxCount: 30,
    defaultCount: 24,
    matchKeywords: ['game board', 'board game', 'play surface', 'numbered spaces', 'path', 'track'],
  },
  {
    key: 'spinner',
    name: 'Spinner',
    description: 'A circle divided into N equal labeled wedges around a center hole, assembled with a pencil and paperclip into the classic low-cost randomizer used instead of printed dice.',
    mechanic: 'assemble-and-glue',
    minCount: 4,
    maxCount: 8,
    defaultCount: 6,
    matchKeywords: ['spinner', 'randomization device', 'paperclip', 'spin the'],
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


function drawDashedPolyline(page: any, points: { x: number; y: number }[], opts: { thickness?: number; color?: any; dash?: number; gap?: number } = {}) {
  for (let i = 0; i < points.length - 1; i++) drawDashedLine(page, points[i], points[i + 1], opts);
}

function drawPolyline(page: any, points: { x: number; y: number }[], opts: { thickness?: number; color?: any } = {}) {
  const { thickness = 1.5, color = BLACK } = opts;
  for (let i = 0; i < points.length - 1; i++) {
    page.drawLine({ start: points[i], end: points[i + 1], thickness, color });
  }
}

// Fits `text` into up to `maxLines` wrapped lines at the largest size (from a
// shrinking candidate list) that still fits `maxWidth` -- used anywhere text
// has to live in a small, fixed shape (petal, puzzle half, badge) where a
// single hardcoded font size would overflow for longer generated content.
function fitText(text: string, font: any, sizes: number[], maxWidth: number, maxLines: number): { lines: string[]; size: number } {
  for (const size of sizes) {
    const lines = wrapText(text, font, size, maxWidth);
    if (lines.length <= maxLines) return { lines, size };
  }
  const size = sizes[sizes.length - 1];
  const lines = wrapText(text, font, size, maxWidth).slice(0, maxLines);
  if (lines.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/.{0,3}$/, '...');
  return { lines, size };
}

// Multi-Flap Radial Foldable ("petal fold"): a central N-gon with N triangular
// petals, one per edge, pointing outward. Each petal's inner edge (the N-gon's
// own edge) is the FOLD line (dashed) -- the petal folds inward to close over
// the center. The two outer edges of each petal are CUT lines (solid), giving
// the whole unfolded shape a star/flower silhouette. Matches the Electromagnets
// "Advantages of..." radial layout and the flower-shaped Electromagnets diagram
// page seen in Aj's uploaded Electricity & Magnetism notebook.
export function drawRadialFoldable(page: any, opts: {
  x: number; y: number; width: number; height: number;
  count: number; labels: string[]; contents: string[];
  font: any; boldFont: any;
}) {
  const { x, y, width, height, count, labels, contents, font, boldFont } = opts;
  const cx = x + width / 2;
  const cy = y + height / 2 + 8;
  const outerR = Math.min(width, height) / 2 - 12;
  const innerR = outerR * 0.36;
  const start = -Math.PI / 2;

  const vertex = (i: number) => {
    const a = start + (i % count) * ((2 * Math.PI) / count);
    return { x: cx + innerR * Math.cos(a), y: cy + innerR * Math.sin(a) };
  };

  for (let i = 0; i < count; i++) {
    const v0 = vertex(i);
    const v1 = vertex(i + 1);
    const midA = start + (i + 0.5) * ((2 * Math.PI) / count);
    const apex = { x: cx + outerR * Math.cos(midA), y: cy + outerR * Math.sin(midA) };

    drawPolyline(page, [v0, apex, v1], { thickness: 1.5 });
    drawDashedLine(page, v0, v1, { thickness: 1.2 });

    const labelR = innerR + (outerR - innerR) * 0.55;
    const lx = cx + labelR * Math.cos(midA);
    const ly = cy + labelR * Math.sin(midA);
    const label = labels[i] || `Petal ${i + 1}`;
    const { lines, size } = fitText(label, boldFont, [9, 8, 7], outerR * 0.75, 3);
    let ty = ly + ((lines.length - 1) * (size + 1)) / 2;
    for (const line of lines) {
      const tw = boldFont.widthOfTextAtSize(line, size);
      page.drawText(line, { x: lx - tw / 2, y: ty, size, font: boldFont, color: BLACK });
      ty -= size + 1;
    }
  }

  page.drawEllipse({ x: cx, y: cy, xScale: innerR, yScale: innerR, borderColor: GRAY, borderWidth: 0.75, borderDashArray: [3, 3] });
  page.drawText('center', { x: cx - 12, y: cy - 3, size: 6, font, color: GRAY });

  // Content lives underneath as a numbered legend (not inside the tiny petals)
  // -- the same "content revealed under the flap" idea, just readable on a
  // real printed page instead of crammed into a wedge a few mm wide.
  let ly2 = y - 14;
  page.drawText('Cut the outer star outline (solid). Fold each petal in on the dashed line to close over the center.', { x, y: ly2, size: 8, font, color: GRAY });
  ly2 -= 12;
  for (let i = 0; i < count; i++) {
    const content = contents[i] || '';
    if (!content) continue;
    const lines = wrapText(`${labels[i] || `Petal ${i + 1}`}: ${content}`, font, 7.5, width);
    for (const line of lines) {
      page.drawText(line, { x, y: ly2, size: 7.5, font, color: BLACK });
      ly2 -= 9;
    }
  }
}

// Two-Panel Comparison Foldable ("shutter fold"): ONE piece of paper, cut only
// around the outer rectangle. Two dashed vertical creases divide it into a
// left panel, a center strip, and a right panel. Both outer panels fold IN
// over the center strip, like double doors closing -- so the center strip is
// where the hidden "answer"/comparison content goes, and the two side panels
// carry the two concepts being compared.
export function drawTwoPanelComparison(page: any, opts: {
  x: number; y: number; width: number; height: number;
  count: number; labels: string[]; contents: string[];
  font: any; boldFont: any;
}) {
  const { x, y, width, height, labels, contents, font, boldFont } = opts;
  const leftW = width * 0.35;
  const rightW = width * 0.35;
  const centerW = width - leftW - rightW;
  const centerX = x + leftW;

  page.drawRectangle({ x, y, width, height, borderColor: BLACK, borderWidth: 1.5 });
  drawDashedLine(page, { x: centerX, y }, { x: centerX, y: y + height }, { thickness: 1.2 });
  drawDashedLine(page, { x: centerX + centerW, y }, { x: centerX + centerW, y: y + height }, { thickness: 1.2 });

  const sideLabel = (panelX: number, panelW: number, idx: number) => {
    const label = labels[idx] || (idx === 0 ? 'Concept A' : 'Concept B');
    const { lines, size } = fitText(label, boldFont, [11, 10, 9], panelW - 12, 2);
    let ty = y + height - 20;
    for (const line of lines) {
      const tw = boldFont.widthOfTextAtSize(line, size);
      page.drawText(line, { x: panelX + panelW / 2 - tw / 2, y: ty, size, font: boldFont, color: BLACK });
      ty -= size + 2;
    }
    const content = contents[idx] || '';
    const contentLines = wrapText(content, font, 8, panelW - 14);
    let cy = ty - 8;
    for (const line of contentLines) {
      if (cy < y + 10) break;
      page.drawText(line, { x: panelX + 7, y: cy, size: 8, font, color: BLACK });
      cy -= 10;
    }
  };
  sideLabel(x, leftW, 0);
  sideLabel(centerX + centerW, rightW, 1);

  const vsText = 'vs.';
  const vsW = boldFont.widthOfTextAtSize(vsText, 12);
  page.drawText(vsText, { x: centerX + centerW / 2 - vsW / 2, y: y + height - 18, size: 12, font: boldFont, color: GRAY });
  const hint = wrapText('What do they have in common? What is different? (write here)', font, 6.5, centerW - 10);
  let hy = y + height - 36;
  for (const line of hint) {
    const tw = font.widthOfTextAtSize(line, 6.5);
    page.drawText(line, { x: centerX + centerW / 2 - tw / 2, y: hy, size: 6.5, font, color: GRAY });
    hy -= 8;
  }

  page.drawText('Cut around the outer edge only. Fold both side panels inward along the dashed lines like double doors.', { x, y: y - 14, size: 8, font, color: GRAY });
}

// Puzzle-Piece Interlocking Foldable: one card, cut around its OUTER edge
// only (a plain rectangle), with a jigsaw-style knob/notch seam printed down
// the middle purely as a visual divider between two paired concepts (e.g.
// "Prior Knowledge" interlocking with "Inference") -- reinforces the idea
// that the two halves fit together without requiring two separate physical
// pieces to cut, align, and glue.
export function drawPuzzlePiece(page: any, opts: {
  x: number; y: number; width: number; height: number;
  count: number; labels: string[]; contents: string[];
  font: any; boldFont: any;
}) {
  const { x, y, width, height, labels, contents, font, boldFont } = opts;
  const midX = x + width / 2;
  const knobR = Math.min(width, height) * 0.09;
  const knobCY = y + height / 2;

  page.drawRectangle({ x, y, width, height, borderColor: BLACK, borderWidth: 1.5 });

  // Jigsaw seam: straight down to the knob, a semicircular bump (approximated
  // with 16 segments) protruding into the right half, straight the rest of
  // the way -- drawn dashed since it's a visual seam, not something you fold.
  const seam: { x: number; y: number }[] = [{ x: midX, y }];
  seam.push({ x: midX, y: knobCY - knobR });
  const segs = 16;
  for (let i = 0; i <= segs; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / segs; // sweeps from -90deg to +90deg
    seam.push({ x: midX + knobR * Math.cos(a), y: knobCY + knobR * Math.sin(a) });
  }
  seam.push({ x: midX, y: knobCY + knobR });
  seam.push({ x: midX, y: y + height });
  for (let i = 0; i < seam.length - 1; i++) {
    drawDashedLine(page, seam[i], seam[i + 1], { thickness: 1, dash: 4, gap: 3, color: GRAY });
  }

  const halfLabel = (panelX: number, panelW: number, idx: number) => {
    const label = labels[idx] || (idx === 0 ? 'Piece 1' : 'Piece 2');
    const { lines, size } = fitText(label, boldFont, [11, 10, 9], panelW - 16, 2);
    let ty = y + height - 20;
    for (const line of lines) {
      const tw = boldFont.widthOfTextAtSize(line, size);
      page.drawText(line, { x: panelX + panelW / 2 - tw / 2, y: ty, size, font: boldFont, color: BLACK });
      ty -= size + 2;
    }
    const contentLines = wrapText(contents[idx] || '', font, 8, panelW - 18);
    let cy = ty - 8;
    for (const line of contentLines) {
      if (cy < y + 8) break;
      page.drawText(line, { x: panelX + 8, y: cy, size: 8, font, color: BLACK });
      cy -= 10;
    }
  };
  halfLabel(x, width / 2, 0);
  halfLabel(midX, width / 2, 1);

  page.drawText('Cut around the outer rectangle only -- the center seam is printed, not cut.', { x, y: y - 14, size: 8, font, color: GRAY });
}

const OUTLINE_DRAWERS: Record<string, (page: any, cx: number, cy: number, w: number, h: number) => void> = {
  circle: (page, cx, cy, w, h) => {
    page.drawEllipse({ x: cx, y: cy, xScale: w / 2, yScale: h / 2, borderColor: BLACK, borderWidth: 1.5 });
  },
  badge: (page, cx, cy, w, h) => {
    const points = 8;
    const outerR = Math.min(w, h) / 2;
    const innerR = outerR * 0.86;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = -Math.PI / 2 + (Math.PI * i) / points;
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    pts.push(pts[0]);
    drawPolyline(page, pts, { thickness: 1.5 });
  },
  banner: (page, cx, cy, w, h) => {
    const notch = w * 0.08;
    const pts = [
      { x: cx - w / 2, y: cy + h / 2 }, { x: cx + w / 2, y: cy + h / 2 },
      { x: cx + w / 2 - notch, y: cy }, { x: cx + w / 2, y: cy - h / 2 },
      { x: cx - w / 2, y: cy - h / 2 }, { x: cx - w / 2 + notch, y: cy },
      { x: cx - w / 2, y: cy + h / 2 },
    ];
    drawPolyline(page, pts, { thickness: 1.5 });
  },
  cloud: (page, cx, cy, w, h) => {
    const lobes = 7;
    const baseR = Math.min(w, h) / 2.4;
    const pts: { x: number; y: number }[] = [];
    const segsPerLobe = 6;
    for (let i = 0; i <= lobes * segsPerLobe; i++) {
      const t = i / segsPerLobe;
      const a = (2 * Math.PI * i) / (lobes * segsPerLobe);
      const bump = 1 + 0.14 * Math.sin(t * Math.PI);
      pts.push({ x: cx + baseR * bump * Math.cos(a) * (w / h > 1 ? w / h : 1), y: cy + baseR * bump * Math.sin(a) });
    }
    drawPolyline(page, pts, { thickness: 1.5 });
  },
};

// Shaped Vocabulary Card: a single term/definition cut to a decorative
// outline instead of a plain rectangle. `outline` selects the silhouette;
// unlike the other shapes here this has no fold line at all (cut-and-mount
// only) -- it's the decorative-border motif (battery/wave/lightbulb-shaped
// dotted boxes) generalized to a small reusable set of outlines an image
// model doesn't need to hallucinate, since arbitrary object silhouettes
// (an actual battery, an actual light bulb) aren't a repeatable geometric
// family the way circle/badge/banner/cloud are.
export function drawSilhouetteCard(page: any, opts: {
  x: number; y: number; width: number; height: number;
  count: number; labels: string[]; contents: string[];
  font: any; boldFont: any; outline?: string;
}) {
  const { x, y, width, height, labels, contents, font, boldFont, outline = 'circle' } = opts;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const drawer = OUTLINE_DRAWERS[outline] || OUTLINE_DRAWERS.circle;
  drawer(page, cx, cy, width * 0.9, height * 0.9);

  const label = labels[0] || 'Term';
  const { lines: labelLines, size: labelSize } = fitText(label, boldFont, [13, 11, 10], width * 0.62, 2);
  let ty = cy + ((labelLines.length - 1) * (labelSize + 2)) / 2 + 6;
  for (const line of labelLines) {
    const tw = boldFont.widthOfTextAtSize(line, labelSize);
    page.drawText(line, { x: cx - tw / 2, y: ty, size: labelSize, font: boldFont, color: BLACK });
    ty -= labelSize + 2;
  }
  const { lines: contentLines, size: contentSize } = fitText(contents[0] || '', font, [9, 8, 7], width * 0.6, 4);
  let cy2 = ty - 6;
  for (const line of contentLines) {
    const tw = font.widthOfTextAtSize(line, contentSize);
    page.drawText(line, { x: cx - tw / 2, y: cy2, size: contentSize, font, color: BLACK });
    cy2 -= contentSize + 1;
  }

  page.drawText(`Cut around the ${outline} outline. No fold -- glue flat onto the notebook page.`, { x, y: y - 14, size: 8, font, color: GRAY });
}

// Storage Pocket / Envelope: a rectangle with three fold-under flaps (left,
// right, bottom) that fold behind the front panel and get glued to form an
// open-top pocket, glued onto the lapbook base to hold loose cards/pieces.
// Cut the outer silhouette (solid) once; fold the three flap lines (dashed)
// under; glue the folded edges to the panel behind them.
export function drawStoragePocket(page: any, opts: {
  x: number; y: number; width: number; height: number;
  count: number; labels: string[]; contents: string[];
  font: any; boldFont: any;
}) {
  const { x, y, width, height, labels, contents, font, boldFont } = opts;
  const flapDepth = Math.min(width, height) * 0.16;
  const label = labels[0] || 'Storage Pocket';
  const content = contents[0] || '';

  // Outline: front panel with side/bottom flap extensions (cut as one piece)
  const outline = [
    { x: x + flapDepth, y: y + height },
    { x: x + width - flapDepth, y: y + height },
    { x: x + width - flapDepth, y: y + flapDepth },
    { x: x + width, y: y + flapDepth },
    { x: x + width, y: y },
    { x: x, y: y },
    { x: x, y: y + flapDepth },
    { x: x + flapDepth, y: y + flapDepth },
    { x: x + flapDepth, y: y + height },
  ];
  drawPolyline(page, outline, { thickness: 1.5 });

  // Fold lines: separate the bottom flap and the two side flaps from the
  // front-facing panel.
  drawDashedLine(page, { x: x + flapDepth, y: y + flapDepth }, { x: x + width - flapDepth, y: y + flapDepth }, { thickness: 1.2 });
  drawDashedLine(page, { x: x + flapDepth, y: y + flapDepth }, { x: x + flapDepth, y: y + height }, { thickness: 1.2 });
  drawDashedLine(page, { x: x + width - flapDepth, y: y + flapDepth }, { x: x + width - flapDepth, y: y + height }, { thickness: 1.2 });

  const cx = x + width / 2;
  const { lines: labelLines, size: labelSize } = fitText(label, boldFont, [12, 11, 10], width - flapDepth * 2 - 16, 2);
  let ty = y + height - 24;
  for (const line of labelLines) {
    const tw = boldFont.widthOfTextAtSize(line, labelSize);
    page.drawText(line, { x: cx - tw / 2, y: ty, size: labelSize, font: boldFont, color: BLACK });
    ty -= labelSize + 2;
  }
  const { lines: contentLines, size: contentSize } = fitText(content, font, [9, 8, 7], width - flapDepth * 2 - 16, 4);
  ty -= 6;
  for (const line of contentLines) {
    const tw = font.widthOfTextAtSize(line, contentSize);
    page.drawText(line, { x: cx - tw / 2, y: ty, size: contentSize, font, color: BLACK });
    ty -= contentSize + 1;
  }

  page.drawText('Cut the outer outline. Fold the 3 flaps back behind the front panel and glue to form a pocket.', { x, y: y - 14, size: 8, font, color: GRAY });
}

// Accordion Mini-Booklet: N equal panels in a single strip, cut out as one
// piece, folded in alternating mountain/valley creases (Z-fold) into a
// small flip-through booklet. Distinct from Layered Book (which reveals
// stacked tabs) -- this is genuinely sequential, turn-the-page content.
export function drawAccordionBooklet(page: any, opts: {
  x: number; y: number; width: number; height: number;
  count: number; labels: string[]; contents: string[];
  font: any; boldFont: any;
}) {
  const { x, y, width, height, count, labels, contents, font, boldFont } = opts;
  const panelW = width / count;
  const stripH = height * 0.7;
  const topY = y + height;

  page.drawRectangle({ x, y: topY - stripH, width, height: stripH, borderColor: BLACK, borderWidth: 1.5 });
  for (let i = 1; i < count; i++) {
    const cx = x + i * panelW;
    // Alternate mountain/valley fold styling isn't visually distinguishable
    // in 2D line art, so both are drawn dashed with a fold-direction note.
    drawDashedLine(page, { x: cx, y: topY }, { x: cx, y: topY - stripH }, { thickness: 1.2 });
    page.drawText(i % 2 === 1 ? 'valley' : 'mountain', { x: cx - 14, y: topY - stripH - 10, size: 6, font, color: GRAY });
  }

  for (let i = 0; i < count; i++) {
    const label = labels[i] || `Page ${i + 1}`;
    const panelX = x + i * panelW;
    const { lines, size } = fitText(label, boldFont, [9, 8, 7], panelW - 10, 2);
    let ty = topY - 16;
    for (const line of lines) {
      const tw = boldFont.widthOfTextAtSize(line, size);
      page.drawText(line, { x: panelX + panelW / 2 - tw / 2, y: ty, size, font: boldFont, color: BLACK });
      ty -= size + 1;
    }
    const contentLines = wrapText(contents[i] || '', font, 7.5, panelW - 10);
    let cy = ty - 6;
    for (const line of contentLines) {
      if (cy < topY - stripH + 6) break;
      const tw = font.widthOfTextAtSize(line, 7.5);
      page.drawText(line, { x: panelX + panelW / 2 - tw / 2, y: cy, size: 7.5, font, color: BLACK });
      cy -= 9;
    }
  }

  page.drawText('Cut out the whole strip. Fold each crease in the alternating direction shown (mountain/valley) to form a small flip-through booklet.', { x, y: y - 14, size: 8, font, color: GRAY });
}

// Task Card Grid (Aj, 2026-07-20): the first shape in this library that
// isn't a foldable at all -- no cut/fold lines, just a print-and-cut-apart
// grid of self-contained numbered cards. Built off real analysis of 4
// cross-seller task card products (French Frenzy, Getting Nerdy LLC, and
// two others) -- every one of them uses this exact grid-of-numbered-cards
// mechanic regardless of subject. Cut lines are dashed here (scissors,
// not a fold) rather than the solid "cut" convention used elsewhere in
// this file, since nothing about this shape is ever folded.
export function drawTaskCardGrid(page: any, opts: {
  x: number; y: number; width: number; height: number;
  count: number; labels: string[]; contents: string[];
  font: any; boldFont: any;
}) {
  const { x, y, width, height, count, labels, contents, font, boldFont } = opts;
  const cols = count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const cellW = width / cols;
  const cellH = height / rows;

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = x + col * cellW;
    const cy = y + height - (row + 1) * cellH;

    drawDashedLine(page, { x: cx, y: cy }, { x: cx + cellW, y: cy }, { thickness: 1, dash: 5, gap: 3, color: GRAY });
    drawDashedLine(page, { x: cx, y: cy }, { x: cx, y: cy + cellH }, { thickness: 1, dash: 5, gap: 3, color: GRAY });
    page.drawRectangle({ x: cx, y: cy, width: cellW, height: cellH, borderColor: GRAY, borderWidth: 0.75 });

    const num = String(i + 1);
    const badgeR = 9;
    page.drawEllipse({ x: cx + 14, y: cy + cellH - 14, xScale: badgeR, yScale: badgeR, borderColor: BLACK, borderWidth: 1 });
    const numW = boldFont.widthOfTextAtSize(num, 9);
    page.drawText(num, { x: cx + 14 - numW / 2, y: cy + cellH - 18, size: 9, font: boldFont, color: BLACK });

    const padX = 10;
    const innerW = cellW - padX * 2;
    const promptText = labels[i] || `Card ${i + 1}`;
    const { lines: promptLines, size: promptSize } = fitText(promptText, font, [9, 8, 7], innerW, 5);
    let ty = cy + cellH - 34;
    for (const line of promptLines) {
      page.drawText(line, { x: cx + padX, y: ty, size: promptSize, font, color: BLACK });
      ty -= promptSize + 2;
    }
    const questionText = contents[i] || '';
    const { lines: qLines, size: qSize } = fitText(questionText, boldFont, [8, 7], innerW, 3);
    ty -= 4;
    for (const line of qLines) {
      if (ty < cy + 6) break;
      page.drawText(line, { x: cx + padX, y: ty, size: qSize, font: boldFont, color: BLACK });
      ty -= qSize + 2;
    }
  }

  page.drawText('Print, laminate if reusing, and cut apart along the dashed lines.', { x, y: y - 14, size: 8, font, color: GRAY });
}

// Recording Sheet: a numbered grid of blank response lines matching a task
// card set 1-for-1 -- students work through the cards independently (in
// any order, e.g. at a center) and log answers here instead of writing on
// the cards themselves, so the same reusable/laminated card set works
// across many students and years.
export function drawRecordingSheet(page: any, opts: {
  x: number; y: number; width: number; height: number;
  count: number; labels: string[]; contents: string[];
  font: any; boldFont: any;
}) {
  const { x, y, width, height, count, labels, font, boldFont } = opts;
  page.drawText('Name: _______________________', { x, y: y + height - 10, size: 10, font, color: BLACK });
  const cols = 2;
  const rows = Math.ceil(count / cols);
  const colW = width / cols;
  const rowH = Math.min(36, (height - 30) / rows);

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = x + col * colW;
    const cy = y + height - 40 - row * rowH;

    const num = `${i + 1}.`;
    page.drawText(num, { x: cx, y: cy, size: 10, font: boldFont, color: BLACK });
    const label = labels[i] || '';
    if (label) {
      const lw = font.widthOfTextAtSize(label, 7);
      page.drawText(label, { x: cx + 18, y: cy + 9, size: 7, font, color: GRAY });
      void lw;
    }
    page.drawLine({ start: { x: cx + 18, y: cy - 2 }, end: { x: cx + colW - 12, y: cy - 2 }, thickness: 0.75, color: BLACK });
  }

  page.drawText('Answer each numbered task card in the matching space above. This sheet is reusable across students -- the cards never get written on.', { x, y: y - 14, size: 8, font, color: GRAY });
}

// Game Board Track: N numbered spaces arranged in a boustrophedon ("snake")
// path -- alternating left-to-right / right-to-left rows -- so the printed
// board reads as one continuous path players move a marker along, same as
// a real board game track, without needing a single giant spiral (which
// doesn't tile cleanly onto a rectangular page).
export function drawGameBoardTrack(page: any, opts: {
  x: number; y: number; width: number; height: number;
  count: number; labels: string[]; contents: string[];
  font: any; boldFont: any;
}) {
  const { x, y, width, height, count, labels, boldFont, font } = opts;
  const cols = 6;
  const rows = Math.ceil(count / cols);
  const cellW = width / cols;
  const cellH = height / rows;

  const positions: { x: number; y: number; col: number; row: number }[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const posInRow = i % cols;
    const col = row % 2 === 0 ? posInRow : cols - 1 - posInRow; // snake direction
    positions.push({ x: x + col * cellW, y: y + height - (row + 1) * cellH, col, row });
  }

  for (let i = 0; i < count; i++) {
    const p = positions[i];
    page.drawRectangle({ x: p.x, y: p.y, width: cellW, height: cellH, borderColor: BLACK, borderWidth: 1.2 });
    const num = String(i + 1);
    page.drawText(num, { x: p.x + 4, y: p.y + cellH - 12, size: 9, font: boldFont, color: BLACK });
    const label = labels[i] || '';
    if (label) {
      const { lines, size } = fitText(label, font, [7, 6], cellW - 8, 3);
      let ty = p.y + cellH / 2;
      for (const line of lines) {
        const tw = font.widthOfTextAtSize(line, size);
        page.drawText(line, { x: p.x + cellW / 2 - tw / 2, y: ty, size, font, color: BLACK });
        ty -= size + 1;
      }
    }
  }

  // Path arrows between consecutive spaces (skip the wrap between rows'
  // last/first cell, which the snake layout already makes visually obvious)
  for (let i = 0; i < count - 1; i++) {
    const a = positions[i], b = positions[i + 1];
    if (a.row !== b.row) continue;
    const dir = b.col > a.col ? 1 : -1;
    const ay = a.y + cellH / 2;
    page.drawLine({ start: { x: a.x + (dir > 0 ? cellW - 4 : 4), y: ay }, end: { x: a.x + (dir > 0 ? cellW + 4 : -4), y: ay }, thickness: 1.5, color: GRAY });
  }

  page.drawText('Players move a marker from space 1 to the final space, following the numbered path shown.', { x, y: y - 14, size: 8, font, color: GRAY });
}

// Spinner: a circle divided into N equal labeled wedges, with a small
// center hole marked for the classic pencil-tip-through-a-paperclip
// spinner mechanism -- the standard low-cost randomizer these game shells
// use instead of printed dice.
export function drawSpinner(page: any, opts: {
  x: number; y: number; width: number; height: number;
  count: number; labels: string[]; contents: string[];
  font: any; boldFont: any;
}) {
  const { x, y, width, height, count, labels, font, boldFont } = opts;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const r = Math.min(width, height) / 2 - 10;
  const start = -Math.PI / 2;

  page.drawEllipse({ x: cx, y: cy, xScale: r, yScale: r, borderColor: BLACK, borderWidth: 1.5 });
  for (let i = 0; i < count; i++) {
    const a = start + i * ((2 * Math.PI) / count);
    page.drawLine({ start: { x: cx, y: cy }, end: { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }, thickness: 1, color: BLACK });

    const midA = a + Math.PI / count;
    const labelR = r * 0.6;
    const lx = cx + labelR * Math.cos(midA);
    const ly = cy + labelR * Math.sin(midA);
    const label = labels[i] || String(i + 1);
    const { lines, size } = fitText(label, boldFont, [9, 8, 7], r * 0.7, 2);
    let ty = ly + ((lines.length - 1) * (size + 1)) / 2;
    for (const line of lines) {
      const tw = boldFont.widthOfTextAtSize(line, size);
      page.drawText(line, { x: lx - tw / 2, y: ty, size, font: boldFont, color: BLACK });
      ty -= size + 1;
    }
  }
  page.drawEllipse({ x: cx, y: cy, xScale: 2.5, yScale: 2.5, borderColor: BLACK, color: BLACK });

  page.drawText('Cut out the spinner. Push a pencil tip through a paperclip and hold it at the center dot; flick the paperclip to spin.', { x, y: y - 14, size: 8, font, color: GRAY });
}
