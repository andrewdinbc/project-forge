import { createCanvas, loadImage } from '@napi-rs/canvas';

// lib/pixel-art.js (Aj, 2026-07-20): extracted out of the original
// color-by-number route so Mystery Math Pictures can reuse the exact
// same AI-image-generation + pixelation pipeline instead of forking a
// second copy that could drift out of sync -- same principle as the
// buildTaskAIRequest single-source-of-truth pattern already used
// elsewhere in this ecosystem (morpheus-scheduler/run-tasks).

// A fixed, kid-nameable palette. Cells that quantize very close to white
// are treated as background and left blank/uncolored.
export const PALETTE = [
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

export const GRID_PRESETS = {
  simple: { cols: 14, rows: 18 },
  detailed: { cols: 22, rows: 28 },
};

const STYLE_SUFFIX =
  ', simple bold flat-color cartoon illustration, thick clean black outlines, solid flat color fill with no gradients, no shading, no texture, no background scenery, plain white background, single centered subject, children\'s sticker-book style, high contrast distinct color regions';

export async function generateSourceImage(prompt) {
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
  const imagePart = parts.find((p) => p.inlineData || p.inline_data);
  const inline = imagePart?.inlineData || imagePart?.inline_data;
  if (!inline?.data) throw new Error('Gemini did not return an image -- try a simpler/more concrete subject (e.g. "a red apple" rather than an abstract concept).');
  return Buffer.from(inline.data, 'base64');
}

export function nearestPaletteIndex(r, g, b) {
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
// own image smoothing does the area-averaging) and quantizes every pixel
// to the nearest palette entry (or 0 for background).
export async function pixelate(imageBuffer, cols, rows) {
  const img = await loadImage(imageBuffer);
  const canvas = createCanvas(cols, rows);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cols, rows);
  ctx.drawImage(img, 0, 0, cols, rows);
  const { data } = ctx.getImageData(0, 0, cols, rows);
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const i = (r * cols + c) * 4;
      row.push(nearestPaletteIndex(data[i], data[i + 1], data[i + 2]));
    }
    grid.push(row);
  }
  return grid;
}
