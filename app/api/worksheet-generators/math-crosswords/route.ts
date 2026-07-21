import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, uploadWorksheetPdf, randInt, PAGE_W, PAGE_H, INK, NAVY, GRAY, asciiSafeFilename} from '@/lib/worksheet-pdf';
import { generateCrossword, cropToContent } from '@/lib/crossword-engine';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

// Math Crossword Puzzles (Aj, 2026-07-20): solve math problems, place
// the digits of each answer into a crossword-style interlocking grid.
// Calls the EXACT same placement engine as the word Crossword Puzzle
// (lib/crossword-engine.ts) -- the algorithm doesn't care whether it's
// crossing letters or digits, it only compares characters for equality
// -- just with sanitize=digits-only instead of letters-only, and every
// "word" is a generated answer with its math expression as the clue.
// Digits (a 10-character alphabet) intersect far more easily than
// letters (26), so these puzzles interlock reliably even with modest
// problem counts.
export const maxDuration = 30;

const admin: any = supabaseAdmin;

type Op = '+' | '-' | 'x';
const OP_LABEL: Record<Op, string> = { '+': '+', '-': '-', 'x': '\u00d7' };  // fixed 2026-07-20: same WinAnsi-encoding bug as kenken.ts's OP_SYMBOL -- U+2212 isn't in range, plain hyphen is

// Generates one problem with a 2-4 digit answer (no leading zero) using
// the given operation.
function makeProblem(op: Op, digits: number): { expr: string; answer: string } {
  const min = Math.pow(10, digits - 1), max = Math.pow(10, digits) - 1;
  if (op === '+') {
    const answer = randInt(min, max);
    const a = randInt(Math.max(1, answer - max), Math.min(answer - 1, max));
    const b = answer - a;
    return { expr: `${a} + ${b}`, answer: String(answer) };
  }
  if (op === '-') {
    const answer = randInt(min, max);
    const b = randInt(1, max);
    const a = answer + b;
    return { expr: `${a} - ${b}`, answer: String(answer) };
  }
  // multiplication: pick two factors whose product lands in range,
  // retrying a bounded number of times rather than accepting an
  // out-of-range answer.
  for (let attempt = 0; attempt < 30; attempt++) {
    const a = randInt(2, 99), b = randInt(2, 99);
    const answer = a * b;
    if (answer >= min && answer <= max) return { expr: `${a} \u00d7 ${b}`, answer: String(answer) };
  }
  // Fallback: guaranteed in-range via a direct construction. Math.ceil
  // (not round) is required here -- round(min/a) can land just under
  // min (e.g. a=3, min=10 -> round(3.33)=3 -> 3x3=9, one digit short),
  // silently producing an answer with the wrong digit count. Caught by
  // a standalone verification pass across all op/digit combinations
  // before this route was ever wired up.
  const a = randInt(2, 12);
  const b = Math.max(2, Math.ceil(min / a));
  return { expr: `${a} \u00d7 ${b}`, answer: String(a * b) };
}

export async function POST(request: NextRequest) {
  try {
    const { userId, count = 10, digits = 2, operations, title, bundleId } = (await request.json()) || {};
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const n = Math.max(6, Math.min(20, parseInt(count, 10) || 10));
    const d = Math.max(2, Math.min(4, parseInt(digits, 10) || 2));
    const ops: Op[] = Array.isArray(operations) && operations.length ? operations.filter((o: string): o is Op => ['+', '-', 'x'].includes(o)) : ['+', '-'];

    // Random digit strings interlock far less reliably than English words
    // -- there's no letter-frequency pattern to lean on, just a flat 1-in-10
    // chance any two digits match at all. Verified empirically before wiring
    // this in: with exactly `n` candidates, only ~30-50% typically place.
    // Generating an 8x pool and letting the greedy engine pick whichever
    // ones actually connect reliably reaches the requested count instead.
    const poolSize = Math.min(n * 8, 120);
    const entries: { word: string; clue: string }[] = [];
    const seenAnswers = new Set<string>();
    let guard = 0;
    while (entries.length < poolSize && guard < poolSize * 15) {
      guard++;
      const op = ops[Math.floor(Math.random() * ops.length)];
      const { expr, answer } = makeProblem(op, d);
      if (seenAnswers.has(answer)) continue; // avoid duplicate answer-words -- engine treats them as the same "word"
      seenAnswers.add(answer);
      entries.push({ word: answer, clue: expr });
    }
    if (entries.length < 4) return NextResponse.json({ error: 'Could not generate enough distinct problems -- try a different digit length.' }, { status: 500 });

    const { placed: allPlaced, unplaced: enginUnplaced } = generateCrossword(entries, (w) => w.replace(/[^0-9]/g, ''));
    // Keep up to the requested count from what actually interlocked --
    // over-generation means there's usually more than enough.
    const placed = allPlaced.slice(0, n);
    const unplaced = [...enginUnplaced, ...allPlaced.slice(n)];
    if (placed.length < 4) return NextResponse.json({ error: 'Could not interlock enough answers even with extra problems generated -- try a different digit length or more problems.' }, { status: 400 });

    // Renumber the kept subset -- trimming can otherwise leave gaps in
    // the clue list (e.g. 1,2,4,6,9) if a dropped word happened to own
    // an intermediate number. Still solvable either way, but a clean
    // sequential list reads like a real puzzle.
    const cellStarts = new Set<string>();
    for (const p of placed) cellStarts.add(`${p.row},${p.col}`);
    const sortedStarts = Array.from(cellStarts).map((k) => k.split(',').map(Number) as [number, number]).sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
    const renumbered = new Map<string, number>();
    sortedStarts.forEach(([r, c], i) => renumbered.set(`${r},${c}`, i + 1));
    for (const p of placed) p.number = renumbered.get(`${p.row},${p.col}`);

    const { grid, shifted, rows, cols } = cropToContent(placed);

    const theme = await loadBundleTheme(admin, userId, bundleId);
    const { doc, helv, helvBold } = await newWorksheetDoc();
    const docTitle = title?.trim() || 'Math Crossword';

    const drawGrid = (page: any, gridTop: number, showDigits: boolean) => {
      const cell = Math.min(32, (PAGE_W - 108) / cols, (gridTop - 260) / rows);
      const left = (PAGE_W - cols * cell) / 2, top = gridTop;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = left + c * cell, y = top - (r + 1) * cell;
          if (grid[r][c] === null) continue;
          page.drawRectangle({ x, y, width: cell, height: cell, borderColor: rgb(0.15, 0.15, 0.15), borderWidth: 1 });
          const num = shifted.find((p: any) => p.row === r && p.col === c)?.number;
          if (num) page.drawText(String(num), { x: x + 2, y: y + cell - 9, size: 6.5, font: helv, color: GRAY });
          if (showDigits) {
            const ch = grid[r][c]!;
            const fs = cell * 0.55;
            const tw = helvBold.widthOfTextAtSize(ch, fs);
            page.drawText(ch, { x: x + (cell - tw) / 2, y: y + cell * 0.22, size: fs, font: helvBold, color: INK });
          }
        }
      }
      return top - rows * cell;
    };

    const across = shifted.filter((p: any) => p.dir === 'across').sort((a: any, b: any) => (a.number || 0) - (b.number || 0));
    const down = shifted.filter((p: any) => p.dir === 'down').sort((a: any, b: any) => (a.number || 0) - (b.number || 0));

    const drawClues = (page: any, startY: number) => {
      let y = startY - 20;
      const colW = (PAGE_W - 108) / 2;
      const drawList = (label: string, list: any[], x: number) => {
        let ly = y;
        page.drawText(label, { x, y: ly, size: 11, font: helvBold, color: NAVY });
        ly -= 16;
        for (const p of list) {
          const line = `${p.number}. ${p.clue} = ___`;
          page.drawText(line, { x, y: ly, size: 9, font: helv, color: INK });
          ly -= 14;
        }
      };
      drawList('ACROSS', across, 54);
      drawList('DOWN', down, 54 + colW);
    };

    const page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, 'Solve each problem, then write its digits into the matching grid squares.', theme);
    const gridBottom = drawGrid(page, PAGE_H - 130, false);
    drawClues(page, Math.min(gridBottom, PAGE_H - 130 - rows * 4));

    const keyPage = doc.addPage([PAGE_W, PAGE_H]);
    await drawThemeBorder(doc, keyPage, theme);
    keyPage.drawText(`${docTitle} -- Answer Key`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    drawGrid(keyPage, PAGE_H - 90, true);

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'math-crosswords', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${asciiSafeFilename(docTitle)}.pdf"`,
        'X-File-Url': encodeURIComponent(fileUrl),
        'X-Placed-Count': String(placed.length),
        'X-Requested-Count': String(n),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

