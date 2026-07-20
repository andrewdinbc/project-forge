import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';
import { getPageCount, renderPageWithLayers, getPageFonts } from '@/lib/pdf-layer-render';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const admin: any = supabaseAdmin;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Pixlr-style visual analysis of a Style Lab resource page -- extracted out
// of app/api/style-lab/analyze-components/route.ts (Aj, 2026-07-19) so the
// new bulk-analyze route can call the exact same logic instead of a second,
// slightly-different copy. Identifies visual components grouped into
// background/midground/foreground, a pixel-based color palette, and the
// page's real declared font names. Cached on the resource so repeat calls
// for the same page are free.

// Coarse color-quantized palette straight from pixels (exact, free).
export function extractPalette(canvas: any) {
  const ctx = canvas.getContext('2d');
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const step = Math.max(1, Math.floor((width * height) / 40000));
  const buckets: Record<string, { count: number; r: number; g: number; b: number }> = {};
  let counted = 0;
  for (let i = 0; i < data.length; i += 4 * step) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    if (r > 240 && g > 240 && b > 240) continue;
    if (r < 25 && g < 25 && b < 25) continue;
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    if (!buckets[key]) buckets[key] = { count: 0, r: 0, g: 0, b: 0 };
    const bk = buckets[key];
    bk.count++; bk.r += r; bk.g += g; bk.b += b;
    counted++;
  }
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return Object.values(buckets)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((bk) => ({
      hex: `#${toHex(bk.r / bk.count)}${toHex(bk.g / bk.count)}${toHex(bk.b / bk.count)}`,
      proportion: counted ? Math.round((bk.count / counted) * 100) / 100 : 0,
    }));
}

export async function analyzeResourcePage(userId: string, resourceId: string, page = 1, refresh = false) {
  const { data: resource, error } = await admin
    .from('forge_resources')
    .select('file_url, title, source_type, visual_analysis')
    .eq('id', resourceId)
    .eq('user_id', userId)
    .single();
  if (error || !resource) throw new Error('Resource not found');
  if (!resource.file_url) throw new Error('This resource has no PDF file');

  const cached = resource.visual_analysis;
  if (cached && !refresh && cached.page === page) {
    return { cached: true, analysis: cached, title: resource.title };
  }

  const pdfRes = await fetch(resource.file_url);
  if (!pdfRes.ok) throw new Error(`Could not download the PDF (${pdfRes.status})`);
  const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());

  const pageCount = await getPageCount(pdfBytes);
  const png = await renderPageWithLayers(pdfBytes, page, { text: true, images: true }, 1.5);
  const img = await loadImage(png);
  const canvas = createCanvas(img.width, img.height);
  canvas.getContext('2d').drawImage(img, 0, 0);
  const palette = extractPalette(canvas);
  const fonts = await getPageFonts(pdfBytes, page);

  const prompt = `You are analyzing a single teaching-resource page image (a worksheet/printable). Identify the DISTINCT visual components a teacher might want to isolate, reuse, or remove — e.g. a decorative border frame, a central illustration, a cluster of flowers, leaf sprays, number labels, a title banner, small motifs (a bee, a star).

Rules:
- Group repeated/adjacent small motifs into ONE component when they read as a set (e.g. "number labels", "corner leaf sprays").
- Assign each a level: "background" (borders, backdrops, framing), "midground" (supporting decoration), or "foreground" (the main subject/illustration, focal text).
- Give a short human name and a category from: border, decoration, illustration, character, number_label, title, motif, other.
- Give a bounding box as FRACTIONS of the image, {x,y,w,h} each 0..1, x/y = top-left.
- Return AT MOST 15 components, most prominent first.

Respond with ONLY valid JSON, no prose, no markdown:
{"components":[{"name":"...","level":"background|midground|foreground","category":"...","box":{"x":0,"y":0,"w":0,"h":0}}]}`;

  let components: any[] = [];
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: png.toString('base64') } },
          { type: 'text', text: prompt },
        ],
      }],
    });
    const textBlock = resp.content.find((b: any) => b.type === 'text') as any;
    const raw = (textBlock?.text || '').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    components = (parsed.components || []).map((c: any, i: number) => ({
      id: `c${i}`,
      name: String(c.name || `Component ${i + 1}`),
      level: ['background', 'midground', 'foreground'].includes(c.level) ? c.level : 'midground',
      category: String(c.category || 'other'),
      box: {
        x: Math.max(0, Math.min(1, Number(c.box?.x) || 0)),
        y: Math.max(0, Math.min(1, Number(c.box?.y) || 0)),
        w: Math.max(0, Math.min(1, Number(c.box?.w) || 0)),
        h: Math.max(0, Math.min(1, Number(c.box?.h) || 0)),
      },
    }));
  } catch {
    components = []; // vision/JSON hiccup -- still return the render + palette + fonts so the UI works
  }

  const path = `${userId}/style-lab-analysis/${resourceId}/p${page}-${Date.now()}.png`;
  const { error: upErr } = await admin.storage.from('design-assets').upload(path, png, { contentType: 'image/png', upsert: true });
  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);
  const { data: urlData } = admin.storage.from('design-assets').getPublicUrl(path);

  const analysis = {
    version: 1,
    page,
    pageCount,
    imageUrl: urlData.publicUrl,
    width: img.width,
    height: img.height,
    components,
    palette,
    fonts,
    analyzedAt: new Date().toISOString(),
  };

  await admin.from('forge_resources').update({ visual_analysis: analysis }).eq('id', resourceId).eq('user_id', userId);

  return { cached: false, analysis, title: resource.title };
}
