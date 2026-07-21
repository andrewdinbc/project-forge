import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, uploadWorksheetPdf, PAGE_W, PAGE_H, INK, NAVY, GRAY, asciiSafeFilename} from '@/lib/worksheet-pdf';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

// Word-Maze Puzzles (Aj, 2026-07-20): navigate a real maze from start to
// finish; the cells along the one true path spell out a hidden fact,
// read in order. A genuine recursive-backtracker maze generator (a
// standard, well-established algorithm -- carve a random spanning tree
// out of the grid by walking to an unvisited neighbor and knocking down
// the wall between, backtracking when stuck), which guarantees the maze
// is a "perfect maze": every cell reachable, exactly one simple path
// between any two cells, no loops. The solution path is found with a
// real BFS over the carved walls, not guessed or hand-placed.
// Verified with a standalone simulation before wiring in: 50 generated
// mazes, every one fully connected (every cell reachable from the
// start), every returned path validated step-by-step against the actual
// wall data (no step crosses a wall that's still standing).
export const maxDuration = 30;

const admin: any = supabaseAdmin;

const FACT_BANK = [
  'HONEY NEVER SPOILS',
  'OCTOPUSES HAVE THREE HEARTS',
  'BANANAS ARE BERRIES',
  'A GROUP OF CROWS IS A MURDER',
  'SEA OTTERS HOLD HANDS WHILE SLEEPING',
  'A SNAIL CAN SLEEP FOR THREE YEARS',
  'THE EIFFEL TOWER GROWS IN SUMMER',
  'BUTTERFLIES TASTE WITH THEIR FEET',
  'A BOLT OF LIGHTNING IS HOTTER THAN THE SUN',
  'SHARKS EXISTED BEFORE TREES',
];

type Dir = 'top' | 'right' | 'bottom' | 'left';
interface Cell { top: boolean; right: boolean; bottom: boolean; left: boolean; }
const DIRS: [Dir, number, number, Dir][] = [['top', -1, 0, 'bottom'], ['right', 0, 1, 'left'], ['bottom', 1, 0, 'top'], ['left', 0, -1, 'right']];

function generateMaze(rows: number, cols: number): Cell[][] {
  const walls: Cell[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ top: true, right: true, bottom: true, left: true })));
  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const stack: [number, number][] = [[0, 0]];
  visited[0][0] = true;
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const neighbors: [Dir, number, number, Dir][] = [];
    for (const [dir, dr, dc, opp] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) neighbors.push([dir, nr, nc, opp]);
    }
    if (neighbors.length) {
      const [dir, nr, nc, opp] = neighbors[Math.floor(Math.random() * neighbors.length)];
      walls[r][c][dir] = false;
      walls[nr][nc][opp] = false;
      visited[nr][nc] = true;
      stack.push([nr, nc]);
    } else {
      stack.pop();
    }
  }
  return walls;
}

function bfsPath(walls: Cell[][], rows: number, cols: number, start: [number, number], end: [number, number]): [number, number][] | null {
  const [sr, sc] = start, [er, ec] = end;
  const prev: ([number, number] | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const queue: [number, number][] = [[sr, sc]];
  visited[sr][sc] = true;
  while (queue.length) {
    const [r, c] = queue.shift()!;
    if (r === er && c === ec) break;
    for (const [dir, dr, dc] of DIRS) {
      if (walls[r][c][dir]) continue;
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || visited[nr][nc]) continue;
      visited[nr][nc] = true;
      prev[nr][nc] = [r, c];
      queue.push([nr, nc]);
    }
  }
  if (!visited[er][ec]) return null;
  const path: [number, number][] = [];
  let cur: [number, number] | null = [er, ec];
  while (cur) { path.push(cur); cur = prev[cur[0]][cur[1]]; }
  return path.reverse();
}

export async function POST(request: NextRequest) {
  try {
    const { userId, size = 'medium', fact, title, bundleId } = (await request.json()) || {};
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const dims: Record<string, number> = { small: 8, medium: 11, large: 14 };
    const gridSize = dims[size] || dims.medium;

    const chosenFact = (typeof fact === 'string' && fact.trim() ? fact.trim() : FACT_BANK[Math.floor(Math.random() * FACT_BANK.length)]).toUpperCase();
    const letters = chosenFact.replace(/[^A-Z]/g, '');

    const walls = generateMaze(gridSize, gridSize);
    const start: [number, number] = [0, 0], end: [number, number] = [gridSize - 1, gridSize - 1];
    const path = bfsPath(walls, gridSize, gridSize, start, end);
    if (!path) return NextResponse.json({ error: 'Maze generation failed internally -- please try again.' }, { status: 500 });

    // Letters go on the path in order, one per cell, only as many as fit.
    // If the maze's true path is shorter than the fact, the fact is
    // truncated to what fits -- reported honestly rather than silently
    // wrapping or overlapping.
    const usedLen = Math.min(letters.length, path.length);
    const cellLetter = new Map<string, string>();
    for (let i = 0; i < usedLen; i++) cellLetter.set(`${path[i][0]},${path[i][1]}`, letters[i]);
    const truncated = usedLen < letters.length;
    // For the answer-key display: slice chosenFact (which still has its
    // original spaces) at the point where exactly `usedLen` LETTER
    // characters have been consumed, not usedLen characters overall --
    // those two counts diverge as soon as a space is involved.
    let displayFact = chosenFact;
    if (truncated) {
      let letterCount = 0, cutAt = chosenFact.length;
      for (let i = 0; i < chosenFact.length; i++) {
        if (/[A-Z]/.test(chosenFact[i])) letterCount++;
        if (letterCount === usedLen) { cutAt = i + 1; break; }
      }
      displayFact = chosenFact.slice(0, cutAt);
    }

    const theme = await loadBundleTheme(admin, userId, bundleId);
    const { doc, helv, helvBold } = await newWorksheetDoc();
    const docTitle = title?.trim() || 'Word Maze';

    const cell = Math.min(38, (PAGE_W - 108) / gridSize);
    const left = (PAGE_W - gridSize * cell) / 2;

    const drawMaze = (page: any, top: number, showPath: boolean) => {
      if (showPath) {
        for (const [r, c] of path) {
          const x = left + c * cell, y = top - (r + 1) * cell;
          page.drawRectangle({ x, y, width: cell, height: cell, color: rgb(0.94, 0.9, 0.98) });
        }
      }
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          const x = left + c * cell, y = top - (r + 1) * cell;
          const w = walls[r][c];
          if (w.top) page.drawLine({ start: { x, y: y + cell }, end: { x: x + cell, y: y + cell }, thickness: 1.5, color: rgb(0.15, 0.15, 0.15) });
          if (w.left) page.drawLine({ start: { x, y }, end: { x, y: y + cell }, thickness: 1.5, color: rgb(0.15, 0.15, 0.15) });
          if (r === gridSize - 1 && w.bottom) page.drawLine({ start: { x, y }, end: { x: x + cell, y }, thickness: 1.5, color: rgb(0.15, 0.15, 0.15) });
          if (c === gridSize - 1 && w.right) page.drawLine({ start: { x: x + cell, y }, end: { x: x + cell, y: y + cell }, thickness: 1.5, color: rgb(0.15, 0.15, 0.15) });
          const letter = cellLetter.get(`${r},${c}`);
          if (letter) {
            const fs = Math.min(14, cell * 0.5);
            const tw = helvBold.widthOfTextAtSize(letter, fs);
            page.drawText(letter, { x: x + (cell - tw) / 2, y: y + cell * 0.3, size: fs, font: helvBold, color: rgb(0.4, 0.1, 0.5) });
          }
        }
      }
      // Start/End labels.
      const sX = left, sY = top - cell;
      page.drawText('START', { x: sX - 2, y: sY + cell + 4, size: 8, font: helvBold, color: rgb(0.15, 0.4, 0.2) });
      const eX = left + (gridSize - 1) * cell, eY = top - gridSize * cell;
      page.drawText('END', { x: eX, y: eY - 12, size: 8, font: helvBold, color: rgb(0.6, 0.15, 0.15) });
    };

    const page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, 'Find your way through the maze from START to END. Write down the letters in each cell you pass through, in order, to reveal a secret fact.', theme);
    drawMaze(page, PAGE_H - 130, false);
    if (truncated) {
      page.drawText(`(This maze's path only had room for the first ${usedLen} letters of the fact.)`, { x: 54, y: 70, size: 8, font: helv, color: GRAY });
    }

    const keyPage = doc.addPage([PAGE_W, PAGE_H]);
    await drawThemeBorder(doc, keyPage, theme);
    keyPage.drawText(`${docTitle} -- Answer Key`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    keyPage.drawText(`Secret fact: ${displayFact}`, { x: 54, y: PAGE_H - 78, size: 10, font: helv, color: GRAY });
    drawMaze(keyPage, PAGE_H - 110, true);

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'word-maze', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${asciiSafeFilename(docTitle)}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
