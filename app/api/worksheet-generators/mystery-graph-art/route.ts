import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, uploadWorksheetPdf, PAGE_W, PAGE_H, INK, NAVY, GRAY, asciiSafeFilename} from '@/lib/worksheet-pdf';
import { SHAPES, collectPoints } from '@/lib/dot-shapes';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

// Mystery Graph Art (Aj, 2026-07-20): plot ordered pairs on a coordinate
// grid, connecting them in sequence, to reveal a picture -- the classic
// STW "Mystery Graph Pictures" format. Real hand-authored coordinate
// shapes (not AI-generated, not a stock image) -- each one is a genuine
// ordered list of (x, y) points in a normalized -10..10 space that
// connects into a recognizable picture (lib/dot-shapes.js, shared with
// the Dot-to-Dots generator). 'quadrant1' mode (all positive
// coordinates, 0-20) is for younger grades; 'all4' mode (full plane,
// -10..10) also teaches negative-coordinate plotting.
export const maxDuration = 30;

const admin: any = supabaseAdmin;

export async function POST(request: NextRequest) {
  try {
    const { userId, shape, mode = 'all4', title, bundleId } = (await request.json()) || {};
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const keys = Object.keys(SHAPES);
    const shapeKey = SHAPES[shape] ? shape : keys[Math.floor(Math.random() * keys.length)];
    const picture = SHAPES[shapeKey];
    const quadrant1 = mode === 'quadrant1';

    const theme = await loadBundleTheme(admin, userId, bundleId);
    const { doc, helv, helvBold } = await newWorksheetDoc();
    const docTitle = title?.trim() || `Mystery Graph Picture`;

    // Grid geometry: -10..10 (or 0..20 for quadrant1) mapped onto a
    // square plotting area centered on the page.
    const gridMin = quadrant1 ? 0 : -10, gridMax = quadrant1 ? 20 : 10;
    const range = gridMax - gridMin;
    const size = 380, left = (PAGE_W - size) / 2, bottom = 90;
    const toXY = (x: number, y: number) => {
      const nx = quadrant1 ? x : x + 10;
      const ny = quadrant1 ? y : y + 10;
      return { px: left + (nx / range) * size, py: bottom + (ny / range) * size };
    };

    const drawAxes = (page: any) => {
      // Grid lines every 1 unit, labeled every 5.
      for (let i = 0; i <= range; i++) {
        const { px } = toXY(gridMin + i, 0);
        const thick = quadrant1 ? i === 0 : gridMin + i === 0;
        page.drawLine({ start: { x: px, y: bottom }, end: { x: px, y: bottom + size }, thickness: thick ? 1.5 : 0.3, color: thick ? rgb(0.2, 0.2, 0.2) : rgb(0.85, 0.85, 0.85) });
        if (i % 5 === 0) {
          const label = String(gridMin + i);
          const tw = helv.widthOfTextAtSize(label, 7);
          page.drawText(label, { x: px - tw / 2, y: bottom - 12, size: 7, font: helv, color: GRAY });
        }
      }
      for (let i = 0; i <= range; i++) {
        const { py } = toXY(0, gridMin + i);
        const thick = quadrant1 ? i === 0 : gridMin + i === 0;
        page.drawLine({ start: { x: left, y: py }, end: { x: left + size, y: py }, thickness: thick ? 1.5 : 0.3, color: thick ? rgb(0.2, 0.2, 0.2) : rgb(0.85, 0.85, 0.85) });
        if (i % 5 === 0) {
          const label = String(gridMin + i);
          const tw = helv.widthOfTextAtSize(label, 7);
          page.drawText(label, { x: left - tw - 4, y: py - 3, size: 7, font: helv, color: GRAY });
        }
      }
      page.drawRectangle({ x: left, y: bottom, width: size, height: size, borderColor: rgb(0.2, 0.2, 0.2), borderWidth: 1 });
    };

    // ---- Page 1: the ordered coordinate list + blank grid ----
    const page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, 'Plot each point below in order, connecting each one to the next with a straight line. When each stroke ends, lift your pencil and start the next one at its first point.', theme);
    drawAxes(page);

    // List points, grouped by stroke ("Part 1", "Part 2", ...), in a
    // column to the right of the grid (or below, if it would run off).
    let lx = left + size + 20, ly = bottom + size - 10;
    if (lx > PAGE_W - 70) lx = 54; // fallback for narrow layouts, unused at current size but safe
    page.drawText('Points to plot:', { x: lx, y: ly, size: 10, font: helvBold, color: NAVY });
    ly -= 16;
    picture.strokes.forEach((stroke, si) => {
      if (ly < 60) return; // long pictures: list is a helpful reference, not exhaustive if it overflows
      page.drawText(`Part ${si + 1}:`, { x: lx, y: ly, size: 9, font: helvBold, color: INK });
      ly -= 13;
      for (const [x, y] of stroke) {
        if (ly < 55) break;
        page.drawText(`(${x}, ${y})`, { x: lx + 4, y: ly, size: 9, font: helv, color: INK });
        ly -= 12;
      }
      ly -= 6;
    });

    // ---- Page 2: answer key -- the completed picture drawn on the same grid ----
    const keyPage = doc.addPage([PAGE_W, PAGE_H]);
    await drawThemeBorder(doc, keyPage, theme);
    keyPage.drawText(`${docTitle} -- Answer Key: ${picture.label}`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    drawAxes(keyPage);
    for (const stroke of picture.strokes) {
      for (let i = 0; i < stroke.length - 1; i++) {
        const a = toXY(stroke[i][0], stroke[i][1]);
        const b = toXY(stroke[i + 1][0], stroke[i + 1][1]);
        keyPage.drawLine({ start: { x: a.px, y: a.py }, end: { x: b.px, y: b.py }, thickness: 2, color: rgb(0.11, 0.21, 0.34) });
      }
    }
    for (const [x, y] of collectPoints(picture.strokes)) {
      const { px, py } = toXY(x, y);
      keyPage.drawCircle({ x: px, y: py, size: 2.5, color: rgb(0.7, 0.15, 0.15) });
    }

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'mystery-graph-art', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${asciiSafeFilename(docTitle)}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl), 'X-Shape-Used': shapeKey },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
