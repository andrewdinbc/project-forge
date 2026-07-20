import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { renderPageAsImage } from 'unpdf';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';
import { FOLDABLE_SHAPES, drawFlapBook, drawLayeredBook, drawRadialFoldable, drawTwoPanelComparison, drawPuzzlePiece, drawSilhouetteCard } from '@/lib/foldable-shapes';

const admin: any = supabaseAdmin;
const PAGE_W = 792; // US Letter landscape, matches the real templates this was calibrated against
const PAGE_H = 612;
const MARGIN = 40;

// Foldable Shape Library (Aj, 2026-07-19). POST { userId, shapeType, labels,
// contents?, title?, saveToLibrary? } -> a real vector PDF with correct
// cut/fold geometry (see lib/foldable-shapes.ts), rasterized to a PNG for
// Parts Library (image kind, so it's usable everywhere else in the app the
// same way any other saved asset is), with the actual PDF also returned as
// a data URL so it can be downloaded/printed at full vector quality.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { userId, shapeType, labels, contents, title, outline, saveToLibrary = true } = (await request.json()) || {};
    if (!userId || !shapeType || !Array.isArray(labels) || labels.length === 0) {
      return NextResponse.json({ error: 'userId, shapeType, and at least one label are required' }, { status: 400 });
    }
    const shape = FOLDABLE_SHAPES.find((s) => s.key === shapeType);
    if (!shape) {
      return NextResponse.json({ error: `Unknown shapeType. Available: ${FOLDABLE_SHAPES.map((s) => s.key).join(', ')}` }, { status: 400 });
    }
    const count = Math.max(shape.minCount, Math.min(shape.maxCount, labels.length));

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const drawOpts: any = {
      x: MARGIN, y: MARGIN, width: PAGE_W - MARGIN * 2, height: PAGE_H - MARGIN * 2 - 20,
      count, labels: labels.slice(0, count), contents: (contents || []).slice(0, count),
      font, boldFont,
    };
    if (shapeType === 'silhouette-card') drawOpts.outline = outline || 'circle';

    const DRAWERS: Record<string, (page: any, opts: any) => void> = {
      'flap-book': drawFlapBook,
      'layered-book': drawLayeredBook,
      'radial-foldable': drawRadialFoldable,
      'two-panel-comparison': drawTwoPanelComparison,
      'puzzle-piece': drawPuzzlePiece,
      'silhouette-card': drawSilhouetteCard,
    };
    DRAWERS[shapeType](page, drawOpts);

    const pdfBytes = await pdfDoc.save();
    const pdfDataUrl = `data:application/pdf;base64,${Buffer.from(pdfBytes).toString('base64')}`;

    // Rasterize page 1 to PNG for Parts Library / everywhere-else-in-the-app use.
    // `as any`: @napi-rs/canvas's exports don't structurally match the `canvas`
    // package's TS types unpdf expects, even though they're API-compatible at
    // runtime (this exact pattern is already used unchecked in lib/pdf-layer-render.js,
    // which is a .js file and skips type-checking -- this route is .ts and doesn't).
    const png = await renderPageAsImage(new Uint8Array(pdfBytes), 1, { canvas: (() => import('@napi-rs/canvas')) as any, scale: 1.5 });

    let part = null;
    if (saveToLibrary) {
      const path = `${userId}/foldable-shapes/${Date.now()}.png`;
      const { error: upErr } = await admin.storage.from('design-assets').upload(path, png, { contentType: 'image/png', upsert: true });
      if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);
      const { data: urlData } = admin.storage.from('design-assets').getPublicUrl(path);

      const { data: inserted, error: insErr } = await admin
        .from('library_parts')
        .insert({
          user_id: userId,
          kind: 'image',
          source_id: `foldable-shape:${shapeType}:${Date.now()}`,
          title: title || `${shape.name} (${count})`,
          category: 'foldable_shape',
          notes: `${shape.name}, ${count} sections: ${labels.slice(0, count).join(', ')}`,
          file_url: urlData.publicUrl,
        })
        .select()
        .single();
      if (insErr) throw new Error(insErr.message);
      part = inserted;
    }

    return NextResponse.json({ ok: true, shapeName: shape.name, count, pdfDataUrl, part });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
