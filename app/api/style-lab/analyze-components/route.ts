import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';
import { renderPageWithLayers } from '@/lib/pdf-layer-render';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const admin: any = supabaseAdmin;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 120;

// Pixlr-style visual analysis of a Style Lab resource page: identify the real
// visual components (skull, flowers, border, number labels, ...) grouped into
// background/foreground levels, and pull the color palette. Cached on the
// resource so it only runs (and costs) once per page. (Aj, 2026-07-19)
// POST { userId, resourceId, page?, refresh? }

// Coarse color-quantized palette straight from pixels (exact, free). Ignores
// near-white paper and pure-black line ink so the swatches are the actual
// colors used, and returns them sorted by coverage.
function extractPalette(canvas: any) {
  const ctx = canvas.getContext('2d');
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const step = Math.max(1, Math.floor((width * height) / 40000)); // sample ~40k px
  const buckets: Record<string, { count: number; r: number; g: number; b: number }> = {};
  let counted = 0;
  for (let i = 0; i < data.length; i += 4 * step) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    if (r > 240 && g > 240 && b > 240) continue; // paper
    if (r < 25 && g < 25 && b < 25) continue; // line ink
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`; // 32-level buckets
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

export async function POST(request: NextRequest) {
  try {
    const { userId, resourceId, page = 1, refresh = false } = (await request.json()) || {};
    if (!userId || !resourceId) {
      return NextResponse.json({ error: 'userId and resourceId are required' }, { status: 400 });
    }

    const { data: resource, error } = await admin
      .from('forge_resources')
      .select('file_url, title, source_type, visual_analysis')
      .eq('id', resourceId)
      .eq('user_id', userId)
      .single();
    if (error || !resource) return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    if (!resource.file_url) return NextResponse.json({ error: 'This resource has no PDF file' }, { status: 400 });

    const cached = resource.visual_analysis;
    if (cached && !refresh && cached.page === page) {
      return NextResponse.json({ ok: true, cached: true, analysis: cached });
    }

    const pdfRes = await fetch(resource.file_url);
    if (!pdfRes.ok) return NextResponse.json({ error: `Could not download the PDF (${pdfRes.status})` }, { status: 422 });
    const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());

    const png = await renderPageWithLayers(pdfBytes, page, { text: true, images: true }, 1.5);
    const img = await loadImage(png);
    const canvas = createCanvas(img.width, img.height);
    canvas.getContext('2d').drawImage(img, 0, 0);
    const palette = extractPalette(canvas);

    // Vision: identify reusable visual components with normalized boxes.
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
    } catch (e) {
      // If vision/JSON fails, still return the render + palette so the UI works.
      components = [];
    }

    // Upload the analyzed render so box coords line up with the displayed image.
    const path = `${userId}/style-lab-analysis/${resourceId}/p${page}-${Date.now()}.png`;
    const { error: upErr } = await admin.storage.from('design-assets').upload(path, png, { contentType: 'image/png', upsert: true });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);
    const { data: urlData } = admin.storage.from('design-assets').getPublicUrl(path);

    const analysis = {
      version: 1,
      page,
      imageUrl: urlData.publicUrl,
      width: img.width,
      height: img.height,
      components,
      palette,
      analyzedAt: new Date().toISOString(),
    };

    await admin.from('forge_resources').update({ visual_analysis: analysis }).eq('id', resourceId).eq('user_id', userId);

    return NextResponse.json({ ok: true, cached: false, analysis });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
