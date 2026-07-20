import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, uploadWorksheetPdf, loadBundleTheme, drawThemeBorder, PAGE_W, PAGE_H, INK, NAVY, GRAY } from '@/lib/worksheet-pdf';
import { PALETTE, generateSourceImage, pixelate } from '@/lib/pixel-art';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

// Mystery Math Pictures (Aj, 2026-07-20): the exact same AI-generate +
// pixelate pipeline as Color by Number (lib/pixel-art.js), except every
// cell shows a math problem instead of a plain number -- solve it, get
// the key number, color accordingly. Grid is intentionally coarser than
// Color by Number's presets (a math expression like "9-3" needs a lot
// more room than a single digit), and the palette is capped at 6 colors
// so every answer stays a single digit 1-6 -- keeps problems simple and
// the color key short.
export const maxDuration = 60;

const admin: any = supabaseAdmin;

// Coarser than color-by-number's grids -- cells need to fit "12-4" or
// "3x2" legibly, not just one digit.
const GRID_PRESETS: Record<string, { cols: number; rows: number }> = {
  simple: { cols: 9, rows: 12 },
  detailed: { cols: 12, rows: 16 },
};

// Only the first 6 palette entries are used, so every target answer is
// 1-6 -- addition/subtraction/multiplication facts for those stay
// genuinely simple (no risk of a "17-8" style problem crowding a cell).
const MATH_PALETTE = PALETTE.slice(0, 6);

type Op = '+' | '-' | 'x';
const OP_LABEL: Record<Op, string> = { '+': 'addition', '-': 'subtraction', 'x': 'multiplication' };

function pickFact(target: number, ops: Op[]): string {
  const op = ops[Math.floor(Math.random() * ops.length)];
  if (op === '+') {
    // a + b = target, both >= 1 where possible
    const a = target > 1 ? 1 + Math.floor(Math.random() * (target - 1)) : 0;
    const b = target - a;
    return `${a}+${b}`;
  }
  if (op === '-') {
    // a - b = target -- pick a random positive b, derive a
    const b = 1 + Math.floor(Math.random() * 6);
    const a = target + b;
    return `${a}-${b}`;
  }
  // multiplication: find a factor pair of target (1..6 always has at
  // least 1 x target); prefer a non-trivial pair when one exists.
  const pairs: [number, number][] = [];
  for (let a = 1; a <= target; a++) if (target % a === 0) pairs.push([a, target / a]);
  const nonTrivial = pairs.filter(([a, b]) => a !== 1 && b !== 1);
  const [a, b] = (nonTrivial.length ? nonTrivial : pairs)[Math.floor(Math.random() * (nonTrivial.length ? nonTrivial.length : pairs.length))];
  return `${a}x${b}`;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, prompt, sourceImageUrl, complexity = 'simple', operations, title, bundleId } = (await request.json()) || {};
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    if (!prompt && !sourceImageUrl) return NextResponse.json({ error: 'Provide either a prompt (to generate a picture) or a sourceImageUrl (to pixelate an existing one).' }, { status: 400 });

    const ops: Op[] = Array.isArray(operations) && operations.length ? operations.filter((o: string): o is Op => ['+', '-', 'x'].includes(o)) : ['+', '-'];
    const { cols, rows } = GRID_PRESETS[complexity] || GRID_PRESETS.simple;

    const sourceBuffer = sourceImageUrl
      ? Buffer.from(await (await fetch(sourceImageUrl)).arrayBuffer())
      : await generateSourceImage(prompt);

    // Reuse the shared pixelation pass, then remap any palette index > 6
    // down into the 6-color math palette (nearest-by-index fallback) so
    // every cell's target is guaranteed answerable by the chosen ops.
    const rawGrid = await pixelate(sourceBuffer, cols, rows);
    const grid = rawGrid.map((row) => row.map((v) => (v === 0 ? 0 : ((v - 1) % MATH_PALETTE.length) + 1)));

    // One fact per (cell, generated fresh) -- not one fact per palette
    // number -- so the same target number shows a different problem in
    // different cells, matching how a real worksheet varies practice
    // across the page instead of repeating one equation dozens of times.
    const factGrid: string[][] = grid.map((row) => row.map((v) => (v === 0 ? '' : pickFact(v, ops))));

    const usedNumbers = Array.from(new Set(grid.flat().filter((n) => n !== 0))).sort((a, b) => a - b);
    const legend = usedNumbers.map((n) => MATH_PALETTE.find((p) => p.n === n)!);

    const theme = await loadBundleTheme(admin, userId, bundleId);
    const { doc, helv, helvBold } = await newWorksheetDoc();
    const docTitle = title?.trim() || (prompt ? `Mystery Math Picture: ${prompt}` : 'Mystery Math Picture');

    const drawLegend = (page: any, y: number) => {
      page.drawText(`Solve each problem (${ops.map((o) => OP_LABEL[o]).join('/')}) to find its number, then color by the key:`, { x: 54, y, size: 9, font: helv, color: GRAY });
      let lx = 54, ly = y - 18;
      for (const item of legend) {
        page.drawRectangle({ x: lx, y: ly - 9, width: 12, height: 12, borderColor: rgb(0.2, 0.2, 0.2), borderWidth: 0.75, color: rgb(item.rgb[0] / 255, item.rgb[1] / 255, item.rgb[2] / 255) });
        page.drawText(`${item.n} = ${item.name}`, { x: lx + 16, y: ly - 7, size: 9, font: helvBold, color: INK });
        lx += 90;
        if (lx > PAGE_W - 90) { lx = 54; ly -= 18; }
      }
      return ly - 22;
    };

    const drawGrid = (page: any, gridTop: number, showColor: boolean) => {
      const availW = PAGE_W - 80, availH = gridTop - 50;
      const cell = Math.min(availW / cols, availH / rows);
      const left = (PAGE_W - cols * cell) / 2, top = gridTop;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const v = grid[r][c];
          const x = left + c * cell, y = top - (r + 1) * cell;
          if (showColor && v !== 0) {
            const item = MATH_PALETTE.find((p) => p.n === v)!;
            page.drawRectangle({ x, y, width: cell, height: cell, color: rgb(item.rgb[0] / 255, item.rgb[1] / 255, item.rgb[2] / 255) });
          }
          page.drawRectangle({ x, y, width: cell, height: cell, borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 0.4 });
          if (!showColor && v !== 0 && cell >= 22) {
            const s = factGrid[r][c];
            const fs = Math.min(7.5, cell * 0.24);
            const tw = helv.widthOfTextAtSize(s, fs);
            page.drawText(s, { x: x + (cell - tw) / 2, y: y + cell * 0.42, size: fs, font: helv, color: INK });
          }
        }
      }
    };

    const page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, 'Solve each math problem to find the color-key number for that space, then color it in. When you are finished, see what it reveals!', theme);
    const gridTop = drawLegend(page, PAGE_H - 118);
    drawGrid(page, gridTop, false);

    const keyPage = doc.addPage([PAGE_W, PAGE_H]);
    await drawThemeBorder(doc, keyPage, theme);
    keyPage.drawText(`${docTitle} -- Colored Picture`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    drawGrid(keyPage, PAGE_H - 90, true);

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'mystery-math-pictures', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
