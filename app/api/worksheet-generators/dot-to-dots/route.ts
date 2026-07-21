import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, uploadWorksheetPdf, PAGE_W, PAGE_H, INK, NAVY, asciiSafeFilename} from '@/lib/worksheet-pdf';
import { SHAPES } from '@/lib/dot-shapes';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

// Dot-to-Dots (Aj, 2026-07-20): connect numbered dots in order to reveal
// a picture -- no coordinate grid, no axis reading, just sequential
// counting (1, 2, 3...), the classic early-literacy version of this
// format. Reuses the exact same hand-authored shapes as Mystery Graph
// Art (lib/dot-shapes.js) but renders them completely differently: plain
// numbered dots on a blank page, not points plotted against a labeled
// Cartesian grid -- the two generators serve different skills (counting
// sequence vs. coordinate reading) from one shared picture library.
export const maxDuration = 30;

const admin: any = supabaseAdmin;

export async function POST(request: NextRequest) {
  try {
    const { userId, shape, title, bundleId } = (await request.json()) || {};
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const keys = Object.keys(SHAPES);
    const shapeKey = (SHAPES as any)[shape] ? shape : keys[Math.floor(Math.random() * keys.length)];
    const picture: any = (SHAPES as any)[shapeKey];

    // Flatten every stroke's points into ONE continuous numbered sequence
    // -- a real dot-to-dot has a single "lift the pencil" moment between
    // strokes (marked visually with a small gap in the numbering label,
    // e.g. "12 (start again)"), not a fresh restart at 1 for every part.
    const sequence: { x: number; y: number; strokeStart: boolean }[] = [];
    picture.strokes.forEach((stroke: [number, number][], si: number) => {
      stroke.forEach(([x, y], i) => {
        sequence.push({ x, y, strokeStart: i === 0 && si > 0 });
      });
    });

    const theme = await loadBundleTheme(admin, userId, bundleId);
    const { doc, helv, helvBold } = await newWorksheetDoc();
    const docTitle = title?.trim() || 'Dot-to-Dot';

    // Map normalized -10..10 coordinates onto a large plotting area with
    // generous margin -- no grid lines, no axis labels, just dots.
    const size = 420, left = (PAGE_W - size) / 2, bottom = 110;
    const toXY = (x: number, y: number) => ({ px: left + ((x + 10) / 20) * size, py: bottom + ((y + 16) / 26) * size });
    // (using a slightly taller normalized range, 26 tall / -16..10, since
    // the kite's tail dips well below -10 -- keeps every shape's full
    // extent safely on the page without per-shape bounding-box math)

    const drawDots = (page: any, connected: boolean) => {
      for (let i = 0; i < sequence.length; i++) {
        const { px, py } = toXY(sequence[i].x, sequence[i].y);
        if (connected && i > 0 && !sequence[i].strokeStart) {
          const prev = toXY(sequence[i - 1].x, sequence[i - 1].y);
          page.drawLine({ start: { x: prev.px, y: prev.py }, end: { x: px, y: py }, thickness: 2, color: rgb(0.11, 0.21, 0.34) });
        }
      }
      for (let i = 0; i < sequence.length; i++) {
        const { px, py } = toXY(sequence[i].x, sequence[i].y);
        page.drawCircle({ x: px, y: py, size: 2.2, color: rgb(0.1, 0.1, 0.1) });
        const label = String(i + 1);
        const fs = 8;
        page.drawText(label, { x: px + 5, y: py + 3, size: fs, font: helv, color: INK });
      }
    };

    const page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, 'Connect the dots in order, starting at 1. If the numbers jump (like after a wing or a sail finishes), lift your pencil and start the new part at its next number.', theme);
    drawDots(page, false);

    const keyPage = doc.addPage([PAGE_W, PAGE_H]);
    await drawThemeBorder(doc, keyPage, theme);
    keyPage.drawText(`${docTitle} -- Answer Key: ${picture.label}`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    drawDots(keyPage, true);

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'dot-to-dots', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${asciiSafeFilename(docTitle)}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl), 'X-Shape-Used': shapeKey },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
