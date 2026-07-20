import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, loadBundleTheme, drawThemeBorder, uploadWorksheetPdf, PAGE_W, PAGE_H, INK, NAVY, GRAY } from '@/lib/worksheet-pdf';
import { HIDDEN_OBJECT_ICONS } from '@/lib/hidden-object-icons';
import { rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

// Hidden Picture Puzzles (Aj, 2026-07-20): find items hidden within an
// illustrated scene. Built from hand-authored vector shapes with exactly
// tracked coordinates -- NOT an AI-generated image. That distinction
// matters here specifically: an AI image generator can't tell you where
// in the output it actually put anything, so there'd be no reliable way
// to draw an accurate answer key circling each hidden object, or even to
// guarantee the requested objects appear at all. Every hidden object's
// exact position is known at generation time because this code placed
// it there, the same "real, not fake" standard as Mystery Graph Art's
// hand-authored coordinate shapes.
//
// Approach: scatter a field of small repeated decorative marks (leaves/
// swirls/dots in a themed color palette) as visual clutter, then place
// each hidden object -- drawn with the same line weight and colors
// sampled from that same palette -- at a random non-overlapping spot
// within the clutter, so it blends in by color and style rather than
// being an obviously different black icon dropped on a white page.
export const maxDuration = 30;

const admin: any = supabaseAdmin;

const PALETTES: Record<string, [number, number, number][]> = {
  autumn: [[0.72, 0.36, 0.12], [0.85, 0.55, 0.15], [0.6, 0.28, 0.08], [0.8, 0.65, 0.2], [0.5, 0.2, 0.1]],
  ocean: [[0.1, 0.4, 0.6], [0.15, 0.55, 0.65], [0.05, 0.3, 0.5], [0.3, 0.65, 0.7], [0.1, 0.45, 0.55]],
  forest: [[0.2, 0.45, 0.2], [0.3, 0.55, 0.25], [0.15, 0.35, 0.15], [0.4, 0.6, 0.3], [0.25, 0.5, 0.3]],
};

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// Draws one icon's strokes at (cx, cy), rotated by rotDeg and scaled,
// in the given color. Same point-transform math for every stroke point:
// rotate around origin, scale, then translate to the target center.
function drawIcon(page: any, iconKey: string, cx: number, cy: number, scale: number, rotDeg: number, color: any, thickness: number) {
  const icon = (HIDDEN_OBJECT_ICONS as any)[iconKey];
  const rad = (rotDeg * Math.PI) / 180;
  const transform = ([x, y]: [number, number]) => {
    const rx = x * Math.cos(rad) - y * Math.sin(rad);
    const ry = x * Math.sin(rad) + y * Math.cos(rad);
    return { x: cx + rx * scale, y: cy + ry * scale };
  };
  for (const stroke of icon.strokes) {
    for (let i = 0; i < stroke.length - 1; i++) {
      const a = transform(stroke[i]), b = transform(stroke[i + 1]);
      page.drawLine({ start: a, end: b, thickness, color });
    }
  }
}

// Cheap camouflage clutter: lots of small randomly-placed/rotated
// curved "leaf" marks and dots in the theme palette, filling the
// drawable area so hidden objects have visual texture to blend into.
function drawClutter(page: any, left: number, bottom: number, w: number, h: number, palette: [number, number, number][], count: number) {
  for (let i = 0; i < count; i++) {
    const cx = left + Math.random() * w, cy = bottom + Math.random() * h;
    const color = rgb(...pick(palette));
    const size = 6 + Math.random() * 10;
    const rot = Math.random() * Math.PI * 2;
    // A "leaf": two curved strokes forming a pointed oval, approximated
    // with short line segments (pdf-lib has no native bezier-stroke
    // convenience on drawLine, so a small polyline stands in).
    const pts: { x: number; y: number }[] = [];
    const steps = 8;
    for (let s = 0; s <= steps; s++) {
      const t = (s / steps) * Math.PI;
      const lx = Math.cos(t) * size, ly = Math.sin(t) * size * 0.4;
      const rx = lx * Math.cos(rot) - ly * Math.sin(rot), ry = lx * Math.sin(rot) + ly * Math.cos(rot);
      pts.push({ x: cx + rx, y: cy + ry });
    }
    for (let s = 0; s < pts.length - 1; s++) {
      page.drawLine({ start: pts[s], end: pts[s + 1], thickness: 1, color });
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, theme: sceneTheme, objectCount, title, bundleId } = (await request.json()) || {};
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    const paletteKeys = Object.keys(PALETTES);
    const sceneKey = PALETTES[sceneTheme] ? sceneTheme : pick(paletteKeys);
    const palette = PALETTES[sceneKey];
    const n = Math.max(4, Math.min(9, parseInt(objectCount, 10) || 6));

    const iconKeys = Object.keys(HIDDEN_OBJECT_ICONS);
    const chosenIcons = [...iconKeys].sort(() => Math.random() - 0.5).slice(0, n);

    // Placement area, in page coordinates -- leaves room for the header
    // and a legend strip at the bottom.
    const left = 60, bottom = 90, areaW = PAGE_W - 120, areaH = 480;

    // Place each object at a random non-overlapping spot (bounding-circle
    // check -- conservative but simple and always correct: if bounding
    // circles don't overlap, the actual line art definitely doesn't
    // either). Retries a bounded number of times before giving up on
    // that one object.
    const placements: { icon: string; cx: number; cy: number; scale: number; rot: number; color: [number, number, number] }[] = [];
    for (const icon of chosenIcons) {
      let placed = false;
      for (let attempt = 0; attempt < 40 && !placed; attempt++) {
        const scale = 3.5 + Math.random() * 2.5;
        const cx = left + 30 + Math.random() * (areaW - 60);
        const cy = bottom + 30 + Math.random() * (areaH - 60);
        const radius = scale * 5.5;
        const overlaps = placements.some((p) => {
          const d = Math.hypot(p.cx - cx, p.cy - cy);
          return d < radius + p.scale * 5.5 + 8;
        });
        if (!overlaps) {
          placements.push({ icon, cx, cy, scale, rot: Math.random() * 360, color: pick(palette) });
          placed = true;
        }
      }
      // If we truly can't fit it after 40 tries, it's honestly skipped
      // rather than forced into an overlapping spot that would make the
      // puzzle unsolvable or the answer key wrong.
    }

    const theme = await loadBundleTheme(admin, userId, bundleId);
    const { doc, helv, helvBold } = await newWorksheetDoc();
    const docTitle = title?.trim() || `Hidden Picture: ${sceneKey[0].toUpperCase()}${sceneKey.slice(1)}`;

    const drawScene = (page: any, showAnswers: boolean) => {
      drawClutter(page, left, bottom, areaW, areaH, palette, 220);
      page.drawRectangle({ x: left, y: bottom, width: areaW, height: areaH, borderColor: rgb(0.3, 0.3, 0.3), borderWidth: 1.5 });
      for (const p of placements) {
        drawIcon(page, p.icon, p.cx, p.cy, p.scale, p.rot, rgb(...p.color), 1.4);
        if (showAnswers) {
          const r = p.scale * 6;
          page.drawEllipse({ x: p.cx, y: p.cy, xScale: r, yScale: r, borderColor: rgb(0.8, 0, 0), borderWidth: 1.5 });
        }
      }
    };

    const page = await addThemedWorksheetPage(doc, helvBold, helv, docTitle, `Can you find all ${placements.length} hidden objects in the scene below? They're camouflaged by color, but look carefully!`, theme);
    drawScene(page, false);
    let lx = left, ly = bottom - 30;
    page.drawText('Find these:', { x: lx, y: ly, size: 10, font: helvBold, color: NAVY });
    lx += 62;
    for (const p of placements) {
      const label = (HIDDEN_OBJECT_ICONS as any)[p.icon].label;
      const tw = helv.widthOfTextAtSize(label, 9);
      if (lx + tw > PAGE_W - 54) { lx = left; ly -= 14; }
      page.drawText(label, { x: lx, y: ly, size: 9, font: helv, color: INK });
      lx += tw + 20;
    }

    const keyPage = doc.addPage([PAGE_W, PAGE_H]);
    await drawThemeBorder(doc, keyPage, theme);
    keyPage.drawText(`${docTitle} -- Answer Key`, { x: 54, y: PAGE_H - 56, size: 16, font: helvBold, color: NAVY });
    drawScene(keyPage, true);

    const bytes = await doc.save();
    const fileUrl = await uploadWorksheetPdf(admin, userId, bytes, 'hidden-pictures', `${docTitle}.pdf`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docTitle.replace(/\s+/g, '-')}.pdf"`, 'X-File-Url': encodeURIComponent(fileUrl), 'X-Objects-Placed': String(placements.length) },
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
