import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addWorksheetPage, uploadWorksheetPdf, randInt, PAGE_W, PAGE_H, INK, NAVY, LINE } from '@/lib/worksheet-pdf';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

function makeSquare(size: number, maxVal: number) {
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => randInt(1, maxVal)));
  const rowSums = grid.map((row) => row.reduce((a, b) => a + b, 0));
  const colSums = Array.from({ length: size }, (_, c) => grid.reduce((sum, row) => sum + row[c], 0));
  const blanks = grid.map(() => randInt(0, size - 1)); // one blanked cell per row
  return { grid, rowSums, colSums, blanks };
}

export async function POST(request: NextRequest) {
  try {
    const { userId, size = 3, maxVal = 9, count = 4, title } = (await request.json()) || {};
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const n = Math.max(3, Math.min(6, parseInt(size, 10) || 3));
    const puzzleCount = Math.max(1, Math.min(6, parseInt(count, 10) || 4));

    const { doc, helv, helvBold } = await newWorksheetDoc();
    const docTitle = title?.trim() || 'Addition Squares';
    const puzzles = Array.from({ length: puzzleCount }, () => makeSquare(n, maxVal));

    const drawSquare = (page: any, grid: number[][], rowSums: number[], colSums: number[], blanks: number[], x0: number, y0: number, cell: number, showAnswers: boolean) => {
      for (let r = 0; r <= n; r++) for (let c = 0; c <= n; c++) {
        const x = x0 + c * cell, y = y0 - r * cell;
        page.drawRectangle({ x, y: y - cell, width: cell, height: cell, borderColor: rgb(0.3, 0.3, 0.3), borderWidth: 1 });
      }
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const isBlank = blanks[r] === c;
          const val = isBlank && !showAnswers ? '' : String(grid[r][c]);
          const x = x0 + c * cell, y = y0 - r * cell - cell;
          if (val) {
            const size2 = 12;
            const tw = helv.widthOfTextAtSize(val, size2);
            page.drawText(val, { x: x + (cell - tw) / 2, y: y + cell / 2 - 5, size: size2, font: isBlank ? helvBold : helv, color: isBlank ? NAVY : INK });
          }
        }
        const sx = x0 + n * cell, sy = y0 - r * cell - cell;
        page.drawText(`= ${rowSums[r]}`, { x: sx + 6, y: sy + cell / 2 - 5, size: 11, font: helvBold, color: NAVY });
      }
      for (let c = 0; c < n; c++) {
        const cx = x0 + c * cell, cy = y0 - n * cell;
        const tw = helvBold.widthOfTextAtSize(String(colSums[c]), 11);
        page.drawText(String(colSums[c]), { x: cx + (cell - tw) / 2, y: cy - 16, size: 11, font: helvBold, color: NAVY });
      }
      page.drawText('=', { x: x0 - 16, y: y0 - n * cell - 16, size: 10, font: helv, color: NAVY });
    };

    let page = addWorksheetPage(doc, helvBold, helv, docTitle, 'Fill in the missing number in each row using the sum on the right.');
    const cell = 42;
    let y = PAGE_H - 170;
    puzzles.forEach((p, i) => {
      if (y - (n + 1) * cell < 60) { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - 60; }
      page.drawText(`Puzzle ${i + 1}`, { x: 54, y: y + 14, size: 11, font: helvBold, color: NAVY });
      drawSquare(page, p.grid, p.rowSums, p.colSums, p.blanks, 54, y, cell, false);
      y -= (n + 1) * cell + 50;
    });

    const keyPage = doc.addPage([PAGE_W, PAGE_H]);
    keyPage.drawText(`${docTitle} -- Answer Key`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    let ky = PAGE_H - 100;
    puzzles.forEach((p, i) => {
      if (ky - (n + 1) * cell < 60) return; // answer key stays compact -- values are all visible on one dense page
      keyPage.drawText(`Puzzle ${i + 1}`, { x: 54, y: ky + 14, size: 11, font: helvBold, color: NAVY });
      drawSquare(keyPage, p.grid, p.rowSums, p.colSums, p.blanks, 54, ky, 30, true);
      ky -= (n + 1) * 30 + 40;
    });

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'addition-squares', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
