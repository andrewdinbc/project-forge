import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, addWorksheetPage, uploadWorksheetPdf, randInt, PAGE_W, PAGE_H, INK, NAVY, LINE } from '@/lib/worksheet-pdf';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// [dRow, dCol] for every direction. Basic = first 2 (across, down).
// Intermediate adds forward diagonals. Advanced adds every reverse too.
const DIRS: Record<string, number[][]> = {
  basic: [[0, 1], [1, 0]],
  intermediate: [[0, 1], [1, 0], [1, 1], [1, -1]],
  advanced: [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]],
};

function placeWords(words: string[], size: number, directions: number[][]) {
  const grid: (string | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const placed: { word: string; cells: [number, number][] }[] = [];
  const notPlaced: string[] = [];

  const sorted = [...words].sort((a, b) => b.length - a.length);
  for (const word of sorted) {
    let ok = false;
    for (let attempt = 0; attempt < 200 && !ok; attempt++) {
      const [dr, dc] = directions[randInt(0, directions.length - 1)];
      const maxRow = dr === 0 ? size - 1 : dr > 0 ? size - word.length : word.length - 1;
      const minRow = dr < 0 ? word.length - 1 : 0;
      const maxCol = dc === 0 ? size - 1 : dc > 0 ? size - word.length : word.length - 1;
      const minCol = dc < 0 ? word.length - 1 : 0;
      if (maxRow < minRow || maxCol < minCol) continue;
      const row = randInt(minRow, maxRow), col = randInt(minCol, maxCol);
      const cells: [number, number][] = [];
      let conflict = false;
      for (let i = 0; i < word.length; i++) {
        const r = row + dr * i, c = col + dc * i;
        const existing = grid[r][c];
        if (existing && existing !== word[i]) { conflict = true; break; }
        cells.push([r, c]);
      }
      if (conflict) continue;
      cells.forEach(([r, c], i) => { grid[r][c] = word[i]; });
      placed.push({ word, cells });
      ok = true;
    }
    if (!ok) notPlaced.push(word);
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!grid[r][c]) grid[r][c] = LETTERS[randInt(0, 25)];
    }
  }
  return { grid, placed, notPlaced };
}

export async function POST(request: NextRequest) {
  try {
    const { userId, words, difficulty = 'basic', title, bundleId } = (await request.json()) || {};
    if (!userId || !words) return NextResponse.json({ error: 'userId and words are required' }, { status: 400 });
    const list = String(words).split('\n').map((w: string) => w.trim().toUpperCase().replace(/[^A-Z]/g, '')).filter(Boolean);
    if (!list.length) return NextResponse.json({ error: 'Enter at least one word' }, { status: 400 });

    const directions = DIRS[difficulty] || DIRS.basic;
    const longest = Math.max(...list.map((w: string) => w.length));
    const size = Math.max(12, Math.min(20, longest + 3, longest + list.length > 20 ? 20 : longest + Math.ceil(Math.sqrt(list.length)) + 3));
    const { grid, placed, notPlaced } = placeWords(list, size, directions);

    const { doc, helv, helvBold } = await newWorksheetDoc();
    const theme = await loadBundleTheme(admin, userId, bundleId);
    const docTitle = title?.trim() || 'Word Search';
    const cell = Math.min(30, (PAGE_W - 108) / size);
    const gridTop = PAGE_H - 150;

    const drawGrid = (page: any, highlight: boolean) => {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const x = 54 + c * cell, y = gridTop - (r + 1) * cell;
          if (highlight && placed.some((p) => p.cells.some(([pr, pc]) => pr === r && pc === c))) {
            page.drawRectangle({ x, y, width: cell, height: cell, color: rgb(1, 0.92, 0.6) });
          }
          const letter = grid[r][c] as string;
          const size2 = Math.min(12, cell * 0.5);
          const tw = helv.widthOfTextAtSize(letter, size2);
          page.drawText(letter, { x: x + (cell - tw) / 2, y: y + cell / 2 - size2 / 2 + 1, size: size2, font: helv, color: INK });
        }
      }
    };

    const page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, `Find these ${list.length} words.`, theme);
    drawGrid(page, false);
    let wy = gridTop - size * cell - 30;
    if (wy < 60) { /* word list overflow -- rare with size cap 20 */ }
    page.drawText('Find:', { x: 54, y: wy, size: 11, font: helvBold, color: NAVY });
    wy -= 16;
    const wordLine = list.join('    ');
    page.drawText(wordLine.length > 110 ? list.slice(0, Math.ceil(list.length / 2)).join('    ') : wordLine, { x: 54, y: wy, size: 10, font: helv, color: INK });
    if (wordLine.length > 110) { wy -= 14; page.drawText(list.slice(Math.ceil(list.length / 2)).join('    '), { x: 54, y: wy, size: 10, font: helv, color: INK }); }
    if (notPlaced.length) {
      wy -= 20;
      page.drawText(`(Couldn't fit: ${notPlaced.join(', ')} -- try a larger grid or fewer/shorter words)`, { x: 54, y: wy, size: 9, font: helv, color: rgb(0.65, 0.2, 0.2) });
    }

    const keyPage = doc.addPage([PAGE_W, PAGE_H]); await drawThemeBorder(doc, keyPage, theme);
    keyPage.drawText(`${docTitle} -- Answer Key`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    drawGrid(keyPage, true);

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'word-search', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
