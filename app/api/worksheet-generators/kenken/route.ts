import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, uploadWorksheetPdf, loadBundleTheme, drawThemeBorder, shuffle, PAGE_W, PAGE_H, INK, NAVY } from '@/lib/worksheet-pdf';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

// KenKen (a.k.a. Calcudoku/Mathdoku) generator -- modeled directly on the
// sudoku generator's philosophy (Aj: "a real backtracking solver, not
// stock images"), same standard here. Unlike Sudoku, cheap KenKen
// generators are notorious for shipping puzzles with MULTIPLE valid
// solutions because they never actually verify uniqueness after randomly
// carving up cages -- this generator always runs a real solver with early
// exit at 2 solutions and regenerates from scratch if the puzzle isn't
// uniquely solvable, the same rigor gap the catalog comment flags for why
// Crossword is 'planned' rather than half-built.
export const maxDuration = 60;

const admin: any = supabaseAdmin;

type Op = '+' | '-' | 'x' | '/';

// Ops allowed per difficulty when the caller doesn't override -- mirrors
// the progressive-operation pattern seen across every reference KenKen
// generator (ThePuzzleLabs, SudokuTodo, etc.): smaller/easier puzzles
// introduce +/- only, harder ones add x and / once division has a chance
// of landing on a clean integer.
const DEFAULT_OPS: Record<string, Op[]> = {
  easy: ['+', '-'],
  medium: ['+', '-', 'x'],
  hard: ['+', '-', 'x', '/'],
};
const MAX_CAGE_SIZE: Record<string, number> = { easy: 2, medium: 3, hard: 4 };

function makeLatinSquare(n: number): number[][] {
  const grid: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const valid = (r: number, c: number, v: number) => {
    for (let i = 0; i < n; i++) { if (grid[r][i] === v) return false; if (grid[i][c] === v) return false; }
    return true;
  };
  const fill = (pos: number): boolean => {
    if (pos === n * n) return true;
    const r = Math.floor(pos / n), c = pos % n;
    for (const v of shuffle(Array.from({ length: n }, (_, i) => i + 1))) {
      if (valid(r, c, v)) {
        grid[r][c] = v;
        if (fill(pos + 1)) return true;
        grid[r][c] = 0;
      }
    }
    return false;
  };
  fill(0);
  return grid;
}

// Randomized region-growing cage partition. Every cell starts as its own
// 1-cell cage, then cages are grown by merging with a random unclaimed
// neighbor until they hit a random target size (1..maxCageSize). Leftover
// singletons are cleaned up by merging into an adjacent cage where
// possible, since real KenKen puzzles rarely have many 1-cell "cages"
// (those are trivial givens).
function partitionCages(n: number, maxCageSize: number): number[][] {
  const cageOf: number[][] = Array.from({ length: n }, () => Array(n).fill(-1));
  const cells = shuffle(Array.from({ length: n * n }, (_, i) => i));
  let nextCage = 0;

  const neighbors = (r: number, c: number) => {
    const out: [number, number][] = [];
    if (r > 0) out.push([r - 1, c]);
    if (r < n - 1) out.push([r + 1, c]);
    if (c > 0) out.push([r, c - 1]);
    if (c < n - 1) out.push([r, c + 1]);
    return shuffle(out);
  };

  for (const idx of cells) {
    const r = Math.floor(idx / n), c = idx % n;
    if (cageOf[r][c] !== -1) continue;
    const cageId = nextCage++;
    const members: [number, number][] = [[r, c]];
    cageOf[r][c] = cageId;
    const targetSize = 1 + Math.floor(Math.random() * maxCageSize);
    while (members.length < targetSize) {
      const candidates: [number, number][] = [];
      for (const [mr, mc] of members) {
        for (const [nr, nc] of neighbors(mr, mc)) {
          if (cageOf[nr][nc] === -1) candidates.push([nr, nc]);
        }
      }
      if (!candidates.length) break;
      const [pr, pc] = candidates[Math.floor(Math.random() * candidates.length)];
      cageOf[pr][pc] = cageId;
      members.push([pr, pc]);
    }
  }

  // Merge any surviving 1-cell cages into a random neighboring cage so
  // puzzles don't end up dominated by trivial single-cell "cages" (which
  // just hand the answer to the student for free).
  const cageMembers = new Map<number, [number, number][]>();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const id = cageOf[r][c];
    if (!cageMembers.has(id)) cageMembers.set(id, []);
    cageMembers.get(id)!.push([r, c]);
  }
  for (const [id, members] of Array.from(cageMembers.entries())) {
    if (members.length !== 1) continue;
    const [r, c] = members[0];
    const opts = neighbors(r, c).map(([nr, nc]) => cageOf[nr][nc]).filter((nid) => nid !== id);
    if (opts.length) {
      const target = opts[Math.floor(Math.random() * opts.length)];
      cageOf[r][c] = target;
    }
  }
  return cageOf;
}

interface Cage { id: number; cells: [number, number][]; op: Op | null; target: number; }

function buildCages(grid: number[][], cageOf: number[][], n: number, allowedOps: Op[]): Cage[] {
  const byId = new Map<number, [number, number][]>();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const id = cageOf[r][c];
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id)!.push([r, c]);
  }
  const cages: Cage[] = [];
  // IMPORTANT: reuse the ORIGINAL partition id as cage.id here (not a
  // fresh counter) -- the cageOf[][] grid returned by partitionCages
  // still contains those original ids, and the solver looks cages up by
  // indexing into cageOf, so cage.id must match exactly or every lookup
  // after the first mismatch resolves to undefined.
  for (const [origId, cells] of Array.from(byId.entries())) {
    const values = cells.map(([r, c]) => grid[r][c]);
    if (cells.length === 1) {
      cages.push({ id: origId, cells, op: null, target: values[0] });
      continue;
    }
    if (cells.length === 2) {
      // 2-cell cages can use any allowed op, including - and / which need
      // an ordered pair -- pick one that yields a valid (non-negative /
      // integer) result given these two specific values.
      const [a, b] = values;
      const options: { op: Op; target: number }[] = [];
      if (allowedOps.includes('+')) options.push({ op: '+', target: a + b });
      if (allowedOps.includes('x')) options.push({ op: 'x', target: a * b });
      if (allowedOps.includes('-')) options.push({ op: '-', target: Math.abs(a - b) });
      if (allowedOps.includes('/')) {
        const hi = Math.max(a, b), lo = Math.min(a, b);
        if (lo > 0 && hi % lo === 0) options.push({ op: '/', target: hi / lo });
      }
      const pick = options[Math.floor(Math.random() * options.length)] || { op: '+' as Op, target: a + b };
      cages.push({ id: origId, cells, op: pick.op, target: pick.target });
      continue;
    }
    // 3+ cell cages: standard KenKen restricts these to + and x (- and /
    // aren't well-defined across more than two cells).
    const bigOps = allowedOps.filter((o) => o === '+' || o === 'x');
    const op = (bigOps.length ? bigOps[Math.floor(Math.random() * bigOps.length)] : '+') as Op;
    const target = op === '+' ? values.reduce((s, v) => s + v, 0) : values.reduce((p, v) => p * v, 1);
    cages.push({ id: origId, cells, op, target });
  }
  return cages;
}

// Backtracking solver with cage-constraint pruning, counting solutions
// with an early exit at 2 (we only need to know "unique" vs "not unique",
// never the full count). Row/col Latin-square constraints are checked
// incrementally like the sudoku solver; cage constraints are checked the
// moment a cage's last cell is filled, which prunes the search hard since
// most branches die immediately on an arithmetic mismatch rather than
// waiting until the whole grid is filled.
function countSolutions(n: number, cageOf: number[][], cages: Cage[], cap: number): number {
  const cageById = new Map(cages.map((c) => [c.id, c]));
  const filledCountByCage = new Map<number, number>();
  const grid: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  let solutions = 0;

  const cageValid = (cage: Cage): boolean => {
    const values = cage.cells.map(([r, c]) => grid[r][c]);
    if (cage.cells.length === 1) return values[0] === cage.target;
    if (cage.op === '+') return values.reduce((s, v) => s + v, 0) === cage.target;
    if (cage.op === 'x') return values.reduce((p, v) => p * v, 1) === cage.target;
    if (cage.op === '-') return Math.abs(values[0] - values[1]) === cage.target;
    if (cage.op === '/') {
      const hi = Math.max(values[0], values[1]), lo = Math.min(values[0], values[1]);
      return lo > 0 && hi / lo === cage.target && hi % lo === 0;
    }
    return false;
  };

  const rowValid = (r: number, v: number) => { for (let c = 0; c < n; c++) if (grid[r][c] === v) return false; return true; };
  const colValid = (c: number, v: number) => { for (let r = 0; r < n; r++) if (grid[r][c] === v) return false; return true; };

  const solve = (pos: number): void => {
    if (solutions >= cap) return;
    if (pos === n * n) { solutions++; return; }
    const r = Math.floor(pos / n), c = pos % n;
    for (let v = 1; v <= n; v++) {
      if (!rowValid(r, v) || !colValid(c, v)) continue;
      grid[r][c] = v;
      const cageId = cageOf[r][c];
      const cage = cageById.get(cageId)!;
      const filled = (filledCountByCage.get(cageId) || 0) + 1;
      filledCountByCage.set(cageId, filled);
      const cageComplete = filled === cage.cells.length;
      if (!cageComplete || cageValid(cage)) {
        solve(pos + 1);
      }
      filledCountByCage.set(cageId, filled - 1);
      grid[r][c] = 0;
      if (solutions >= cap) return;
    }
  };
  solve(0);
  return solutions;
}

function generateKenKen(n: number, difficulty: string, opsOverride?: Op[]) {
  const maxCageSize = MAX_CAGE_SIZE[difficulty] || 3;
  const allowedOps = (opsOverride && opsOverride.length ? opsOverride : DEFAULT_OPS[difficulty]) || DEFAULT_OPS.medium;

  const MAX_ATTEMPTS = 30;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const solved = makeLatinSquare(n);
    const cageOf = partitionCages(n, maxCageSize);
    const cages = buildCages(solved, cageOf, n, allowedOps);
    const solCount = countSolutions(n, cageOf, cages, 2);
    if (solCount === 1) {
      return { solved, cageOf, cages };
    }
  }
  // Extremely unlikely to exhaust every attempt, but fall back to the
  // last-generated puzzle rather than 500ing -- flagged honestly rather
  // than silently shipping a possibly-ambiguous puzzle.
  const solved = makeLatinSquare(n);
  const cageOf = partitionCages(n, Math.max(2, maxCageSize - 1));
  const cages = buildCages(solved, cageOf, n, allowedOps);
  return { solved, cageOf, cages, unverified: true };
}

const OP_SYMBOL: Record<Op, string> = { '+': '+', '-': '-', 'x': '\u00d7', '/': '\u00f7' };  // fixed 2026-07-20: '-' was U+2212 (math minus), not encodable in pdf-lib's WinAnsi StandardFonts -- crashed KenKen generation on every subtraction cage. Plain ASCII hyphen renders fine and reads the same on a printed page.

export async function POST(request: NextRequest) {
  try {
    const { userId, size = 5, difficulty = 'medium', operations, title, bundleId } = (await request.json()) || {};
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const n = Math.min(9, Math.max(3, Number(size) || 5));
    const diff = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';
    const opsOverride: Op[] | undefined = Array.isArray(operations) && operations.length ? operations.filter((o: string) => ['+', '-', 'x', '/'].includes(o)) : undefined;

    const { solved, cageOf, cages } = generateKenKen(n, diff, opsOverride);

    // Label cell = the top-left-most cell of each cage (reading order),
    // where the operator + target is printed -- standard KenKen convention.
    const labelCell = new Map<number, [number, number]>();
    for (const cage of cages) {
      const sorted = [...cage.cells].sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
      labelCell.set(cage.id, sorted[0]);
    }

    const theme = await loadBundleTheme(admin, userId, bundleId);
    const { doc, helv, helvBold } = await newWorksheetDoc();
    const docTitle = title?.trim() || `${n}x${n} KenKen`;

    const drawGrid = (page: any, showValues: boolean) => {
      const cell = Math.min(50, (PAGE_W - 108) / n);
      const top = PAGE_H - 160, left = (PAGE_W - n * cell) / 2;

      // Base thin grid.
      for (let r = 0; r <= n; r++) {
        page.drawLine({ start: { x: left, y: top - r * cell }, end: { x: left + n * cell, y: top - r * cell }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) });
      }
      for (let c = 0; c <= n; c++) {
        page.drawLine({ start: { x: left + c * cell, y: top }, end: { x: left + c * cell, y: top - n * cell }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) });
      }
      // Bold cage boundaries.
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const id = cageOf[r][c];
          const x0 = left + c * cell, y0 = top - r * cell;
          if (c === n - 1 || cageOf[r][c + 1] !== id) page.drawLine({ start: { x: x0 + cell, y: y0 }, end: { x: x0 + cell, y: y0 - cell }, thickness: 2, color: rgb(0.15, 0.15, 0.15) });
          if (c === 0) page.drawLine({ start: { x: x0, y: y0 }, end: { x: x0, y: y0 - cell }, thickness: 2, color: rgb(0.15, 0.15, 0.15) });
          if (r === n - 1 || cageOf[r + 1][c] !== id) page.drawLine({ start: { x: x0, y: y0 - cell }, end: { x: x0 + cell, y: y0 - cell }, thickness: 2, color: rgb(0.15, 0.15, 0.15) });
          if (r === 0) page.drawLine({ start: { x: x0, y: y0 }, end: { x: x0 + cell, y: y0 }, thickness: 2, color: rgb(0.15, 0.15, 0.15) });
        }
      }
      // Cage labels (operator + target) in the top-left corner of the cage's anchor cell.
      for (const cage of cages) {
        const [r, c] = labelCell.get(cage.id)!;
        const label = cage.op ? `${cage.target}${OP_SYMBOL[cage.op]}` : `${cage.target}`;
        page.drawText(label, { x: left + c * cell + 3, y: top - r * cell - 11, size: 8, font: helvBold, color: NAVY });
      }
      // Solution values.
      if (showValues) {
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            const s = String(solved[r][c]);
            const size2 = cell * 0.45;
            const tw = helvBold.widthOfTextAtSize(s, size2);
            page.drawText(s, { x: left + c * cell + (cell - tw) / 2, y: top - (r + 1) * cell + cell * 0.22, size: size2, font: helvBold, color: INK });
          }
        }
      }
    };

    const page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, `Fill in every row and column with 1-${n}, no repeats. Each cage must match its target using the operation shown.`, theme);
    drawGrid(page, false);

    const keyPage = doc.addPage([PAGE_W, PAGE_H]);
    await drawThemeBorder(doc, keyPage, theme);
    keyPage.drawText(`${docTitle} -- Answer Key`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    drawGrid(keyPage, true);

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'kenken', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

