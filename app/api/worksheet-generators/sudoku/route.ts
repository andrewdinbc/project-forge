import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addWorksheetPage, uploadWorksheetPdf, shuffle, PAGE_W, PAGE_H, INK, NAVY } from '@/lib/worksheet-pdf';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

const SIZE_BOXES: Record<number, [number, number]> = { 4: [2, 2], 6: [2, 3], 9: [3, 3] };

function makeSudoku(size: number, boxRows: number, boxCols: number, difficulty: string) {
  const grid: number[][] = Array.from({ length: size }, () => Array(size).fill(0));

  const valid = (r: number, c: number, v: number) => {
    for (let i = 0; i < size; i++) { if (grid[r][i] === v) return false; if (grid[i][c] === v) return false; }
    const br = Math.floor(r / boxRows) * boxRows, bc = Math.floor(c / boxCols) * boxCols;
    for (let i = br; i < br + boxRows; i++) for (let j = bc; j < bc + boxCols; j++) if (grid[i][j] === v) return false;
    return true;
  };
  const fill = (pos: number): boolean => {
    if (pos === size * size) return true;
    const r = Math.floor(pos / size), c = pos % size;
    const nums = shuffle(Array.from({ length: size }, (_, i) => i + 1));
    for (const v of nums) {
      if (valid(r, c, v)) {
        grid[r][c] = v;
        if (fill(pos + 1)) return true;
        grid[r][c] = 0;
      }
    }
    return false;
  };
  fill(0);
  const solved = grid.map((row) => row.slice());

  const fractionToRemove = difficulty === 'easy' ? 0.35 : difficulty === 'hard' ? 0.6 : 0.48;
  const cells = shuffle(Array.from({ length: size * size }, (_, i) => i));
  const removeCount = Math.floor(size * size * fractionToRemove);
  for (let i = 0; i < removeCount; i++) {
    const r = Math.floor(cells[i] / size), c = cells[i] % size;
    grid[r][c] = 0;
  }
  return { puzzle: grid, solved };
}

export async function POST(request: NextRequest) {
  try {
    const { userId, size = 9, difficulty = 'medium', title } = (await request.json()) || {};
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const n = SIZE_BOXES[size] ? size : 9;
    const [boxRows, boxCols] = SIZE_BOXES[n];
    const { puzzle, solved } = makeSudoku(n, boxRows, boxCols, difficulty);

    const { doc, helv, helvBold } = await newWorksheetDoc();
    const docTitle = title?.trim() || `${n}x${n} Sudoku`;

    const drawGrid = (page: any, grid: number[][]) => {
      const cell = Math.min(45, (PAGE_W - 108) / n);
      const top = PAGE_H - 160, left = (PAGE_W - n * cell) / 2;
      for (let r = 0; r <= n; r++) {
        const thick = r % boxRows === 0;
        page.drawLine({ start: { x: left, y: top - r * cell }, end: { x: left + n * cell, y: top - r * cell }, thickness: thick ? 2 : 0.5, color: rgb(0.2, 0.2, 0.2) });
      }
      for (let c = 0; c <= n; c++) {
        const thick = c % boxCols === 0;
        page.drawLine({ start: { x: left + c * cell, y: top }, end: { x: left + c * cell, y: top - n * cell }, thickness: thick ? 2 : 0.5, color: rgb(0.2, 0.2, 0.2) });
      }
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const v = grid[r][c];
          if (!v) continue;
          const s = String(v);
          const size2 = cell * 0.5;
          const tw = helvBold.widthOfTextAtSize(s, size2);
          page.drawText(s, { x: left + c * cell + (cell - tw) / 2, y: top - (r + 1) * cell + cell * 0.28, size: size2, font: helvBold, color: INK });
        }
      }
    };

    const page = addWorksheetPage(doc, helvBold, helv, docTitle, `Fill in every row, column, and ${boxRows}x${boxCols} box with 1-${n}, no repeats.`);
    drawGrid(page, puzzle);

    const keyPage = doc.addPage([PAGE_W, PAGE_H]);
    keyPage.drawText(`${docTitle} -- Answer Key`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    drawGrid(keyPage, solved);

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'sudoku', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
