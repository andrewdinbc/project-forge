import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, uploadWorksheetPdf, loadBundleTheme, drawThemeBorder, PAGE_W, PAGE_H, INK, NAVY, GRAY } from '@/lib/worksheet-pdf';
import { PALETTE, GRID_PRESETS, generateSourceImage, pixelate } from '@/lib/pixel-art';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

// Color-by-Number generator (Aj, 2026-07-19 evening), modeled on Super
// Teacher Worksheets' color-by-number library
// (superteacherworksheets.com/color-by-number.html). Their version is NOT
// a live generator -- it's a large hand-authored library of fixed mystery
// pictures (grid of cells, each cell holding a small key-number 1-9ish,
// a legend maps each number to a color, coloring the grid by the key
// reveals a picture). This IS a generator: instead of a fixed library, it
// AI-generates a fresh flat-color illustration from Aj's own prompt, then
// pixelates it down to a numbered grid programmatically -- same end
// format STW ships, but a different picture every time from any subject/
// theme a teacher asks for, and (like every other generator in this
// catalog) able to carry a bundle's border theme.
//
// The image-generation + pixelation pipeline (2026-07-20: extracted to
// lib/pixel-art.js) is shared with the Mystery Math Pictures generator,
// which is the exact same pipeline with math facts standing in for the
// plain number key -- same single-source-of-truth principle used
// elsewhere in this ecosystem (buildTaskAIRequest in run-tasks).
//
// Requires GEMINI_API_KEY in this project's Vercel environment variables
// (same requirement as app/api/design-assets/generate/route.ts, which
// this reuses the provider pattern from) -- honestly surfaced as an error
// rather than silently failing if it's not set.
export const maxDuration = 60;

const admin: any = supabaseAdmin;

export async function POST(request: NextRequest) {
  try {
    const { userId, prompt, sourceImageUrl, complexity = 'simple', title, bundleId } = (await request.json()) || {};
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    if (!prompt && !sourceImageUrl) return NextResponse.json({ error: 'Provide either a prompt (to generate a picture) or a sourceImageUrl (to pixelate an existing one).' }, { status: 400 });

    const { cols, rows } = GRID_PRESETS[complexity] || GRID_PRESETS.simple;

    const sourceBuffer = sourceImageUrl
      ? Buffer.from(await (await fetch(sourceImageUrl)).arrayBuffer())
      : await generateSourceImage(prompt);

    const grid = await pixelate(sourceBuffer, cols, rows);
    const usedNumbers = Array.from(new Set(grid.flat().filter((n) => n !== 0))).sort((a, b) => a - b);
    const legend = usedNumbers.map((n) => PALETTE.find((p) => p.n === n)!);

    const theme = await loadBundleTheme(admin, userId, bundleId);
    const { doc, helv, helvBold } = await newWorksheetDoc();
    const docTitle = title?.trim() || (prompt ? `Color by Number: ${prompt}` : 'Color by Number');

    const drawLegend = (page: any, y: number) => {
      page.drawText('Color by numbers according to the key:', { x: 54, y, size: 10, font: helv, color: GRAY });
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
            const item = PALETTE.find((p) => p.n === v)!;
            page.drawRectangle({ x, y, width: cell, height: cell, color: rgb(item.rgb[0] / 255, item.rgb[1] / 255, item.rgb[2] / 255) });
          }
          page.drawRectangle({ x, y, width: cell, height: cell, borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 0.4 });
          if (!showColor && v !== 0 && cell >= 8) {
            const s = String(v);
            const fs = Math.min(7, cell * 0.55);
            const tw = helv.widthOfTextAtSize(s, fs);
            page.drawText(s, { x: x + (cell - tw) / 2, y: y + cell * 0.3, size: fs, font: helv, color: INK });
          }
        }
      }
    };

    const page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, 'Color by numbers according to the key. When you are finished, see what it reveals!', theme);
    const gridTop = drawLegend(page, PAGE_H - 118);
    drawGrid(page, gridTop, false);

    const keyPage = doc.addPage([PAGE_W, PAGE_H]);
    await drawThemeBorder(doc, keyPage, theme);
    keyPage.drawText(`${docTitle} -- Colored Picture`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    drawGrid(keyPage, PAGE_H - 90, true);

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'color-by-number', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
