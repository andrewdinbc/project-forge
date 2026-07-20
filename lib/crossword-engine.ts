// lib/crossword-engine.ts (Aj, 2026-07-20): the real word-intersection
// placement algorithm, extracted out of the original word Crossword
// Puzzle generator so Math Crossword Puzzles can call the EXACT same
// engine with digit strings instead of letter strings, rather than a
// second hand-forked copy -- same single-source-of-truth principle as
// lib/pixel-art.js and lib/dot-shapes.js elsewhere in this catalog. The
// algorithm doesn't care what alphabet it's working with (A-Z or 0-9);
// it only ever compares characters for equality.

export type Dir = 'across' | 'down';
export interface WordClue { word: string; clue: string; }
export interface Placed extends WordClue { row: number; col: number; dir: Dir; number?: number; }

const GRID_SIZE = 30; // generous working space; cropped to actual content before rendering

function makeGrid(): (string | null)[][] {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
}

// Validates AND scores a candidate placement in one pass. Returns null if
// illegal, otherwise the number of characters that land on an existing
// matching character (the intersection count used to rank candidates).
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
      if (existing !== word[i]) return null; // conflicting character -- illegal
      intersections++;
    } else {
      // Fresh cell: its perpendicular neighbors must both be empty, or
      // this word would run silently adjacent to another word's
      // characters (accidentally forming an unintended sequence one
      // row/col over).
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

// `sanitize` strips/normalizes each entry's word before placement --
// letters-only+uppercase for a word crossword, digits-only for a math
// crossword. Entries reduced to under 2 characters after sanitizing are
// dropped (can't meaningfully cross anything).
export function generateCrossword(entries: WordClue[], sanitize: (w: string) => string = (w) => w.replace(/[^a-zA-Z]/g, '').toUpperCase()) {
  const grid = makeGrid();
  const cleaned = entries
    .map((e) => ({ word: sanitize(e.word), clue: e.clue }))
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

  // Number cells: a cell starts a number if it begins an across and/or
  // down word -- standard crossword numbering, shared between across/
  // down if a cell starts both.
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

// Crops the working grid to the actual used bounding box and returns a
// tight 2D grid plus row/col-shifted placements -- shared rendering prep
// for both crossword generators.
export function cropToContent(placed: Placed[]) {
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  for (const p of placed) {
    const endR = p.dir === 'down' ? p.row + p.word.length - 1 : p.row;
    const endC = p.dir === 'across' ? p.col + p.word.length - 1 : p.col;
    minR = Math.min(minR, p.row); maxR = Math.max(maxR, endR);
    minC = Math.min(minC, p.col); maxC = Math.max(maxC, endC);
  }
  const rows = maxR - minR + 1, cols = maxC - minC + 1;
  const grid: (string | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const p of placed) {
    for (let i = 0; i < p.word.length; i++) {
      const r = (p.dir === 'down' ? p.row + i : p.row) - minR;
      const c = (p.dir === 'across' ? p.col + i : p.col) - minC;
      grid[r][c] = p.word[i];
    }
  }
  const shifted = placed.map((p) => ({ ...p, row: p.row - minR, col: p.col - minC }));
  return { grid, shifted, rows, cols };
}
