import { NextRequest, NextResponse } from 'next/server';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import Anthropic from '@anthropic-ai/sdk';
import { getPdfPageCount, renderPdfPageToPng, cropPngRegion } from '@/lib/pdf-page-render';
import { getPageFonts } from '@/lib/pdf-layer-render';
import { extractPalette } from '@/lib/style-lab-vision';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

export const maxDuration = 90;

const admin: any = supabaseAdmin;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const RENDER_SCALE = 1.5;

// Separator (Aj, 2026-07-19): "when I add a series of pdf documents to it,
// it will separate Border, Section Header, Font, Spacing & Alignment, and
// Icon & Illustration, colour palettes and create libraries out of them."
// One PDF per call (the page splits oversized files client-side, same
// pattern as Style Lab's bulk import) -- page 1 only, same "deeper pages
// stay one click away" tradeoff already established for bulk-analyze.
// Deliberately doesn't create a forge_resources row: this is raw ingest
// material for auto-populating Parts Library, not something meant to be
// reviewed as its own resource afterward.

async function saveImagePart(userId: string, buffer: Buffer, title: string, category: string, notes: string) {
  const path = `${userId}/separator/${category}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const { error: upErr } = await admin.storage.from('design-assets').upload(path, buffer, { contentType: 'image/png', upsert: true });
  if (upErr) throw new Error(upErr.message);
  const { data: urlData } = admin.storage.from('design-assets').getPublicUrl(path);
  const { data, error: insErr } = await admin
    .from('library_parts')
    .insert({
      user_id: userId, kind: 'image',
      source_id: `separator:${category}:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title, category, notes, file_url: urlData.publicUrl,
    })
    .select().single();
  if (insErr) throw new Error(insErr.message);
  return data;
}

function toPixelBox(b: any, W: number, H: number) {
  if (!b || typeof b.x !== 'number') return null;
  const x = Math.max(0, Math.min(W - 1, Math.round(b.x * W)));
  const y = Math.max(0, Math.min(H - 1, Math.round(b.y * H)));
  const w = Math.max(1, Math.min(W - x, Math.round(b.w * W)));
  const h = Math.max(1, Math.min(H - y, Math.round(b.h * H)));
  return { x, y, w, h };
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const userId = form.get('userId') as string;
    const file = form.get('file') as unknown as File;
    if (!userId || !file) return NextResponse.json({ error: 'userId and file are required' }, { status: 400 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const baseTitle = (file.name || 'Upload').replace(/\.pdf$/i, '');

    const pageCount = await getPdfPageCount(bytes);
    const pagePng = await renderPdfPageToPng(bytes, 1, RENDER_SCALE);
    const img = await loadImage(pagePng);
    const W = img.width, H = img.height;

    // Palette + fonts are deterministic pixel/PDF-structure reads -- no AI
    // call needed, same functions Style Lab's Visual Components already uses.
    const canvas = createCanvas(W, H);
    canvas.getContext('2d').drawImage(img, 0, 0);
    const palette = extractPalette(canvas);
    const fonts = await getPageFonts(bytes, 1);

    // One vision call locates border / section header / icon regions.
    const prompt = `Identify these on this single teaching-resource page image, if present:
1. "border" -- a decorative frame/border running along the page edges. Usually near-zero margin from the page edge.
2. "section_header" -- a title/heading banner element, distinct from a decorative border.
3. "icons" -- up to 5 small standalone decorative motifs, icons, or illustrations (NOT the border, NOT body text, NOT the whole main illustration if it dominates the page -- only small supporting elements).

Give each as a bounding box, FRACTIONS of the image (0..1), x/y = top-left corner. Omit anything not present.
Return ONLY JSON, no markdown fences: {"border": {"x":0,"y":0,"w":0,"h":0} | null, "section_header": {...} | null, "icons": [{"x":0,"y":0,"w":0,"h":0,"name":"..."}]}`;

    const visionRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-5', max_tokens: 700,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: pagePng.toString('base64') } },
          { type: 'text', text: prompt },
        ],
      }],
    });
    const raw = (visionRes.content.find((b: any) => b.type === 'text') as any)?.text || '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch { parsed = {}; }

    const borderBox = toPixelBox(parsed.border, W, H);
    const headerBox = toPixelBox(parsed.section_header, W, H);
    const iconBoxes = Array.isArray(parsed.icons) ? parsed.icons.slice(0, 5).map((b: any) => toPixelBox(b, W, H)).filter(Boolean) : [];

    const saved: any = { border: null, section_header: null, icon_illustration: [] as any[], color_palette: null, font_reference: [] as any[], spacing_alignment: null };
    const errors: string[] = [];
    const noteFrom = `Auto-extracted by Separator from "${file.name}"`;

    if (borderBox) {
      try {
        const crop = await cropPngRegion(pagePng, borderBox.x, borderBox.y, borderBox.w, borderBox.h);
        saved.border = await saveImagePart(userId, crop, `${baseTitle} border`, 'border', noteFrom);
      } catch (e) { errors.push(`border: ${errorMessage(e)}`); }
    }
    if (headerBox) {
      try {
        const crop = await cropPngRegion(pagePng, headerBox.x, headerBox.y, headerBox.w, headerBox.h);
        saved.section_header = await saveImagePart(userId, crop, `${baseTitle} section header`, 'section_header', noteFrom);
      } catch (e) { errors.push(`section header: ${errorMessage(e)}`); }
    }
    for (let i = 0; i < iconBoxes.length; i++) {
      try {
        const b = iconBoxes[i];
        const crop = await cropPngRegion(pagePng, b.x, b.y, b.w, b.h);
        saved.icon_illustration.push(await saveImagePart(userId, crop, `${baseTitle} icon ${i + 1}`, 'icon_illustration', noteFrom));
      } catch (e) { errors.push(`icon ${i + 1}: ${errorMessage(e)}`); }
    }

    if (palette.length) {
      try {
        const sw = createCanvas(60 * palette.length, 70);
        const sctx = sw.getContext('2d');
        palette.forEach((c: any, i: number) => { sctx.fillStyle = c.hex; sctx.fillRect(60 * i, 0, 60, 70); });
        let buf: Buffer;
        try { buf = await sw.encode('png'); } catch { buf = sw.toBuffer('image/png'); }
        saved.color_palette = await saveImagePart(userId, buf, `${baseTitle} palette`, 'color_palette', `${noteFrom}. Colors: ${palette.map((c: any) => c.hex).join(', ')}`);
      } catch (e) { errors.push(`palette: ${errorMessage(e)}`); }
    }

    for (const f of fonts) {
      try {
        const { data: inserted, error } = await admin
          .from('library_parts')
          .insert({ user_id: userId, kind: 'component', source_id: `separator-font:${f}:${Date.now()}`, title: f, category: 'font_reference', notes: noteFrom })
          .select().single();
        if (error) throw new Error(error.message);
        saved.font_reference.push(inserted);
      } catch (e) { errors.push(`font "${f}": ${errorMessage(e)}`); }
    }

    // Spacing & Alignment: an APPROXIMATE starting preset only, inferred
    // from the section header + icon boxes (border deliberately excluded --
    // it hugs the page edge by definition, which would corrupt a margin
    // estimate). Falls back to a standard 54pt preset if nothing usable was
    // detected. This never claims to be the real body-text margins (this
    // pass doesn't detect body text regions) -- refine it by hand in the
    // Spacing & Alignment Editor.
    try {
      const marginBoxes = [headerBox, ...iconBoxes].filter(Boolean) as { x: number; y: number; w: number; h: number }[];
      let preset;
      if (marginBoxes.length) {
        const minX = Math.min(...marginBoxes.map((b) => b.x));
        const minY = Math.min(...marginBoxes.map((b) => b.y));
        const maxX = Math.max(...marginBoxes.map((b) => b.x + b.w));
        const maxY = Math.max(...marginBoxes.map((b) => b.y + b.h));
        preset = {
          marginTop: Math.max(0, Math.round(minY / RENDER_SCALE)),
          marginBottom: Math.max(0, Math.round((H - maxY) / RENDER_SCALE)),
          marginLeft: Math.max(0, Math.round(minX / RENDER_SCALE)),
          marginRight: Math.max(0, Math.round((W - maxX) / RENDER_SCALE)),
          alignment: 'left', lineSpacing: 1.15,
        };
      } else {
        preset = { marginTop: 54, marginBottom: 54, marginLeft: 54, marginRight: 54, alignment: 'left', lineSpacing: 1.15 };
      }
      const { data: inserted, error } = await admin
        .from('library_parts')
        .insert({ user_id: userId, kind: 'component', source_id: `separator-spacing:${Date.now()}`, title: `${baseTitle} layout (approx.)`, category: 'spacing_alignment', notes: JSON.stringify(preset) })
        .select().single();
      if (error) throw new Error(error.message);
      saved.spacing_alignment = inserted;
    } catch (e) { errors.push(`spacing & alignment: ${errorMessage(e)}`); }

    return NextResponse.json({ ok: true, title: baseTitle, pageCount, saved, errors });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
