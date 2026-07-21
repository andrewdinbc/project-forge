import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, uploadWorksheetPdf, PAGE_W, PAGE_H, INK, NAVY, GRAY, asciiSafeFilename} from '@/lib/worksheet-pdf';
import { generateCrossword, cropToContent, Placed, WordClue } from '@/lib/crossword-engine';
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
// The placement algorithm itself now lives in lib/crossword-engine.ts
// (extracted 2026-07-20) so Math Crossword Puzzles can call the exact
// same engine with digit strings instead of letter strings.
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
//    candidate for real crossword legality, and take the candidate with
//    the most simultaneous intersections (keeps the puzzle compact and
//    well-connected rather than sprawling).
// 4. Any word that genuinely can't be placed (no valid crossing found)
//    is reported back, not silently dropped or forced in incorrectly --
//    same honesty convention as Word Search's "some words may be left
//    out" notice.
export const maxDuration = 30;

const admin: any = supabaseAdmin;

export async function POST(request: NextRequest) {
  try {
    const { userId, entries, title, bundleId } = (await request.json()) || {};
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const parsed: WordClue[] = Array.isArray(entries) ? entries : [];
    if (parsed.length < 3) return NextResponse.json({ error: 'Provide at least 3 word/clue pairs.' }, { status: 400 });

    const { placed, unplaced } = generateCrossword(parsed);
    if (placed.length < 2) return NextResponse.json({ error: 'Could not interlock these words at all -- try words that share more common letters.' }, { status: 400 });

    const { grid, shifted, rows, cols } = cropToContent(placed);

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
        'Content-Disposition': `attachment; filename="${asciiSafeFilename(docTitle)}.pdf"`,
        'X-File-Url': encodeURIComponent(fileUrl),
        'X-Unplaced-Count': String(unplaced.length),
        'X-Unplaced-Words': encodeURIComponent(unplaced.map((u) => u.word).join(',')),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
