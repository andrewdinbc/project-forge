import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, uploadWorksheetPdf, PAGE_W, PAGE_H, INK, NAVY, GRAY } from '@/lib/worksheet-pdf';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

// Crossword Puzzle (Aj, 2026-07-20). The catalog comment for this entry
// has said since it was written: "the one tool in the whole catalog
// that's a genuinely different scale of problem (real word-intersection
// layout, not just a word list laid into a grid/list) -- flagged rather
// than half-built." This is that real version: words are actually
// interlocked at shared letters via a genuine placement algorithm, not
// laid out in a list or a word-search-style grid scatter.
//
// Algorithm (a standard, well-established approach for crossword
// construction -- greedy placement with intersection scoring, not a
// novel or approximate shortcut):
// 1. Sort words longest-first (longer words are more constraining, so
//    placing them early gives later/shorter words more chances to cross).
// 2. Place the first (longest) word across, dead center of a generous
//    working grid.
// 3. For every remaining word, find every possible placement where it
//    shares a letter with an already-placed word at a valid crossing
//    point (opposite orientation, matching letter), validate each
//    candidate for real crossword legality (see canPlace below), and
//    take the candidate with the most simultaneous intersections (keeps
//    the puzzle compact and well-connected rather than sprawling).
// 4. Any word that genuinely can't be placed (no valid crossing found)
//    is reported back, not silently dropped or forced in incorrectly --
//    same honesty convention as Word Search's "some words may be left
//    out" notice.
export const maxDuration = 30;

const admin: any = supabaseAdmin;

type Dir = 'across' | 'down';
interface WordClue { word: string; clue: string; }
interface Placed extends WordClue { row: number; col: number; dir: Dir; number?: number; }

const GRID_SIZE = 30; // generous working space; cropped to actual content before rendering

function makeGrid(): (string | null)[][] {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
}

// Validates AND scores a candidate placement in one pass. Returns null if
// illegal, otherwise the number of letters that land on an existing
// matching letter (the intersection count used to rank candidates).
function checkPlacement(grid: (string | null)[][], word: string, row: number, col: number, dir: Dir): number | null {
  const len = word.length;
  if (dir === 'across') {
    if (col < 1 || col + len > GRID_SIZE - 1 || row < 1 || row > GRID_SIZE - 2) return null;
    if (grid[row][col - 1] !== null) return null; // must not butt directly against another word
    if (grid[row][col + len] !== null) return null;
  } else {
    if (row < 1 || row + len > GRID_SIZE - 1 || col < 1 || col > GRID_SIZE - 2) return null;
    if (grid[row - 1][col] !== null) return null;
    if (grid[row + len][col] !== null) return null;
  }
  let intersections = 0;
  for (let i = 0; i < len; i++) {
    const r = dir === 'across' ? row : row + i;
    const c = dir === 'across' ? col + i : col;
    const existing = grid[r][c];
    if (existing !== null) {
      if (existing !== word[i]) return null; // conflicting letter -- illegal
      intersections++;
    } else {
      // Fresh cell: its perpendicular neighbors must both be empty, or
      // this word would run silently adjacent to another word's letters
      // (accidentally spelling something unintended one row/col over).
      if (dir === 'across') {
        if (grid[r - 1][c] !== null || grid[r + 1][c] !== null) return null;
      } else {
        if (grid[r][c - 1] !== null || grid[r][c + 1] !== null) return null;
      }
    }
  }
  return intersections;
}

function placeOnGrid(grid: (string | null)[][], word: string, row: number, col: number, dir: Dir) {
  for (let i = 0; i < word.length; i++) {
    if (dir === 'across') grid[row][col + i] = word[i];
    else grid[row + i][col] = word[i];
  }
}

function findCandidates(grid: (string | null)[][], word: string, placed: Placed[]): { row: number; col: number; dir: Dir; score: number }[] {
  const candidates: { row: number; col: number; dir: Dir; score: number }[] = [];
  for (const p of placed) {
    for (let j = 0; j < p.word.length; j++) {
      for (let i = 0; i < word.length; i++) {
        if (word[i] !== p.word[j]) continue;
        const dir: Dir = p.dir === 'across' ? 'down' : 'across';
        const row = p.dir === 'across' ? p.row - i : p.row + j;
        const col = p.dir === 'across' ? p.col + j : p.col - i;
        const score = checkPlacement(grid, word, row, col, dir);
        if (score !== null) candidates.push({ row, col, dir, score });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function generateCrossword(entries: WordClue[]) {
  const grid = makeGrid();
  const cleaned = entries
    .map((e) => ({ word: e.word.replace(/[^a-zA-Z]/g, '').toUpperCase(), clue: e.clue }))
    .filter((e) => e.word.length >= 2);
  const sorted = [...cleaned].sort((a, b) => b.word.length - a.word.length);
  if (!sorted.length) return { placed: [] as Placed[], unplaced: [] as WordClue[] };

  const placed: Placed[] = [];
  const first = sorted[0];
  const startRow = Math.floor(GRID_SIZE / 2), startCol = Math.floor(GRID_SIZE / 2) - Math.floor(first.word.length / 2);
  placeOnGrid(grid, first.word, startRow, startCol, 'across');
  placed.push({ ...first, row: startRow, col: startCol, dir: 'across' });

  const unplaced: WordClue[] = [];
  for (const entry of sorted.slice(1)) {
    const candidates = findCandidates(grid, entry.word, placed);
    if (candidates.length) {
      const best = candidates[0];
      placeOnGrid(grid, entry.word, best.row, best.col, best.dir);
      placed.push({ ...entry, row: best.row, col: best.col, dir: best.dir });
    } else {
      unplaced.push(entry);
    }
  }

  // Number cells: a cell starts a number if it begins an across word
  // (nothing immediately left, but something immediately right within
  // this placement) and/or a down word (nothing immediately above, but
  // something immediately below) -- standard crossword numbering, shared
  // between across/down if a cell starts both.
  const cellStarts = new Set<string>();
  for (const p of placed) cellStarts.add(`${p.row},${p.col}`);
  const sortedStarts = Array.from(cellStarts)
    .map((k) => k.split(',').map(Number) as [number, number])
    .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  const numberOf = new Map<string, number>();
  sortedStarts.forEach(([r, c], i) => numberOf.set(`${r},${c}`, i + 1));
  for (const p of placed) p.number = numberOf.get(`${p.row},${p.col}`);

  return { placed, unplaced };
}

export async function POST(request: NextRequest) {
  try {
    const { userId, entries, title, bundleId } = (await request.json()) || {};
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const parsed: WordClue[] = Array.isArray(entries) ? entries : [];
    if (parsed.length < 3) return NextResponse.json({ error: 'Provide at least 3 word/clue pairs.' }, { status: 400 });

    const { placed, unplaced } = generateCrossword(parsed);
    if (placed.length < 2) return NextResponse.json({ error: 'Could not interlock these words at all -- try words that share more common letters.' }, { status: 400 });

    // Crop to the actual used bounding box, +1 cell margin on each side.
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (const p of placed) {
      const endR = p.dir === 'down' ? p.row + p.word.length - 1 : p.row;
      const endC = p.dir === 'across' ? p.col + p.word.length - 1 : p.col;
      minR = Math.min(minR, p.row); maxR = Math.max(maxR, endR);
      minC = Math.min(minC, p.col); maxC = Math.max(maxC, endC);
    }
    const rows = maxR - minR + 1, cols = maxC - minC + 1;
    const grid = Array.from({ length: rows }, () => Array(cols).fill(null as string | null));
    for (const p of placed) {
      for (let i = 0; i < p.word.length; i++) {
        const r = (p.dir === 'down' ? p.row + i : p.row) - minR;
        const c = (p.dir === 'across' ? p.col + i : p.col) - minC;
        grid[r][c] = p.word[i];
      }
    }
    const shifted = placed.map((p) => ({ ...p, row: p.row - minR, col: p.col - minC }));

    const theme = await loadBundleTheme(admin, userId, bundleId);
    const { doc, helv, helvBold } = await newWorksheetDoc();
    const docTitle = title?.trim() || 'Crossword Puzzle';

    const drawGrid = (page: any, gridTop: number, showLetters: boolean) => {
      const cell = Math.min(32, (PAGE_W - 108) / cols, (gridTop - 260) / rows);
      const left = (PAGE_W - cols * cell) / 2, top = gridTop;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = left + c * cell, y = top - (r + 1) * cell;
          if (grid[r][c] === null) continue;
          page.drawRectangle({ x, y, width: cell, height: cell, borderColor: rgb(0.15, 0.15, 0.15), borderWidth: 1 });
          const num = shifted.find((p) => p.row === r && p.col === c)?.number;
          if (num) page.drawText(String(num), { x: x + 2, y: y + cell - 9, size: 6.5, font: helv, color: GRAY });
          if (showLetters) {
            const ch = grid[r][c]!;
            const fs = cell * 0.55;
            const tw = helvBold.widthOfTextAtSize(ch, fs);
            page.drawText(ch, { x: x + (cell - tw) / 2, y: y + cell * 0.22, size: fs, font: helvBold, color: INK });
          }
        }
      }
      return top - rows * cell;
    };

    const across = shifted.filter((p) => p.dir === 'across').sort((a, b) => (a.number || 0) - (b.number || 0));
    const down = shifted.filter((p) => p.dir === 'down').sort((a, b) => (a.number || 0) - (b.number || 0));

    const drawClues = (page: any, startY: number) => {
      let y = startY - 20;
      const colW = (PAGE_W - 108) / 2;
      const drawList = (label: string, list: Placed[], x: number) => {
        let ly = y;
        page.drawText(label, { x, y: ly, size: 11, font: helvBold, color: NAVY });
        ly -= 16;
        for (const p of list) {
          const line = `${p.number}. ${p.clue}`;
          page.drawText(line, { x, y: ly, size: 9, font: helv, color: INK, maxWidth: colW - 10, lineHeight: 11 });
          ly -= 14 * Math.max(1, Math.ceil(line.length / 42));
        }
      };
      drawList('ACROSS', across, 54);
      drawList('DOWN', down, 54 + colW);
    };

    const page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, 'Fill in the grid using the Across and Down clues below.', theme);
    const gridBottom = drawGrid(page, PAGE_H - 130, false);
    drawClues(page, Math.min(gridBottom, PAGE_H - 130 - rows * 4));

    const keyPage = doc.addPage([PAGE_W, PAGE_H]);
    await drawThemeBorder(doc, keyPage, theme);
    keyPage.drawText(`${docTitle} -- Answer Key`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    drawGrid(keyPage, PAGE_H - 90, true);

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'crossword', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`,
        'X-File-Url': encodeURIComponent(fileUrl),
        'X-Unplaced-Count': String(unplaced.length),
        'X-Unplaced-Words': encodeURIComponent(unplaced.map((u) => u.word).join(',')),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
