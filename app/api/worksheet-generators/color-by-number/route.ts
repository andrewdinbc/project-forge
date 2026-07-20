import { NextRequest, NextResponse } from 'next/server';
import { newWorksheetDoc, addThemedWorksheetPage, uploadWorksheetPdf, loadBundleTheme, drawThemeBorder, PAGE_W, PAGE_H, INK, NAVY, GRAY } from '@/lib/worksheet-pdf';
import { rgb } from 'pdf-lib';
import { createCanvas, loadImage } from '@napi-rs/canvas';
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
// Requires GEMINI_API_KEY in this project's Vercel environment variables
// (same requirement as app/api/design-assets/generate/route.ts, which
// this reuses the provider pattern from) -- honestly surfaced as an error
// rather than silently failing if it's not set.
export const maxDuration = 60;

const admin: any = supabaseAdmin;

// A fixed, kid-nameable palette. Cells that quantize very close to white
// are treated as background and left blank/uncolored (no number printed),
// matching how real color-by-number sheets leave the page's white space
// alone rather than assigning it a color key.
const PALETTE: { n: number; name: string; rgb: [number, number, number] }[] = [
  { n: 1, name: 'Red', rgb: [211, 47, 47] },
  { n: 2, name: 'Orange', rgb: [245, 130, 32] },
  { n: 3, name: 'Yellow', rgb: [255, 213, 0] },
  { n: 4, name: 'Green', rgb: [56, 142, 60] },
  { n: 5, name: 'Blue', rgb: [30, 100, 200] },
  { n: 6, name: 'Purple', rgb: [123, 31, 162] },
  { n: 7, name: 'Pink', rgb: [233, 30, 99] },
  { n: 8, name: 'Brown', rgb: [93, 64, 55] },
  { n: 9, name: 'Black', rgb: [33, 33, 33] },
];

const GRID_PRESETS: Record<string, { cols: number; rows: number }> = {
  simple: { cols: 14, rows: 18 },
  detailed: { cols: 22, rows: 28 },
};

const STYLE_SUFFIX =
  ', simple bold flat-color cartoon illustration, thick clean black outlines, solid flat color fill with no gradients, no shading, no texture, no background scenery, plain white background, single centered subject, children\'s sticker-book style, high contrast distinct color regions';

async function generateSourceImage(prompt: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in this project\'s environment variables -- required to generate the source picture. Add it in Vercel project settings, or pass sourceImageUrl to pixelate an existing image instead.');

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
    {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${prompt}${STYLE_SUFFIX}` }] }] }),
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData || p.inline_data);
  const inline = imagePart?.inlineData || imagePart?.inline_data;
  if (!inline?.data) throw new Error('Gemini did not return an image -- try a simpler/more concrete subject (e.g. "a red apple" rather than an abstract concept).');
  return Buffer.from(inline.data, 'base64');
}

function nearestPaletteIndex(r: number, g: number, b: number): number {
  // Background/near-white check first -- these cells stay blank rather
  // than being forced into the nearest palette color, which would fill
  // the whole page background with e.g. "9 = Yellow".
  if (r > 235 && g > 235 && b > 235) return 0;
  let best = 1, bestDist = Infinity;
  for (const p of PALETTE) {
    const [pr, pg, pb] = p.rgb;
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < bestDist) { bestDist = dist; best = p.n; }
  }
  return best;
}

// Downsamples the source image to exactly cols x rows pixels (canvas's
// own image smoothing does the area-averaging, so each resulting pixel
// represents a reasonable average color for that grid cell -- not a raw
// nearest-neighbor sample) and quantizes every pixel to the nearest
// palette entry (or 0 for background).
async function pixelate(imageBuffer: Buffer, cols: number, rows: number): Promise<number[][]> {
  const img = await loadImage(imageBuffer);
  const canvas = createCanvas(cols, rows);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cols, rows);
  ctx.drawImage(img, 0, 0, cols, rows);
  const { data } = ctx.getImageData(0, 0, cols, rows);
  const grid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      const i = (r * cols + c) * 4;
      row.push(nearestPaletteIndex(data[i], data[i + 1], data[i + 2]));
    }
    grid.push(row);
  }
  return grid;
}

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
