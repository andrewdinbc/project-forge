import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

// Saves a Style Lab visual view to the Parts Library. Two modes:
//  - Server compositing (default): reads the cached analyzed image + the boxes
//    of the components you've hidden, whites them out (and optionally crops to
//    one component's box), then uploads. Done server-side so it never depends
//    on cross-origin canvas export. This is the coarse box removal; exact-shape
//    (SAM) masks slot in here later once REPLICATE_API_TOKEN is set.
//  - dataUrl: uploads a client-rendered PNG as-is (used for palette swatches,
//    which are drawn entirely client-side and are safe to export).
// POST { userId, resourceId, title, category?, dataUrl?, hiddenBoxes?, crop? }
export const maxDuration = 45;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) || {};
    const { userId, resourceId, title, category, dataUrl, hiddenBoxes, crop } = body;
    if (!userId || !resourceId || !title) {
      return NextResponse.json({ error: 'userId, resourceId, and title are required' }, { status: 400 });
    }

    const { data: resource, error } = await admin
      .from('forge_resources')
      .select('visual_analysis')
      .eq('id', resourceId)
      .eq('user_id', userId)
      .single();
    if (error || !resource) return NextResponse.json({ error: 'Resource not found' }, { status: 404 });

    let outBuffer: Buffer;

    if (dataUrl) {
      const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
      if (!m) return NextResponse.json({ error: 'dataUrl must be a base64 PNG' }, { status: 400 });
      outBuffer = Buffer.from(m[1], 'base64');
      if (outBuffer.length > 8 * 1024 * 1024) return NextResponse.json({ error: 'Image too large' }, { status: 413 });
    } else {
      const analysis = resource.visual_analysis;
      if (!analysis || !analysis.imageUrl) {
        return NextResponse.json({ error: 'No analyzed image yet — run analysis first' }, { status: 400 });
      }
      const imgRes = await fetch(analysis.imageUrl);
      if (!imgRes.ok) return NextResponse.json({ error: `Could not load the analyzed image (${imgRes.status})` }, { status: 422 });
      const img = await loadImage(Buffer.from(await imgRes.arrayBuffer()));
      const W = img.width, H = img.height;
      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      // White-out every hidden component's box.
      ctx.fillStyle = '#ffffff';
      for (const b of hiddenBoxes || []) {
        ctx.fillRect(Math.round(b.x * W), Math.round(b.y * H), Math.round(b.w * W), Math.round(b.h * H));
      }
      let finalCanvas = canvas;
      // Optional crop to a single component's box.
      if (crop && crop.w > 0 && crop.h > 0) {
        const cx = Math.round(crop.x * W), cy = Math.round(crop.y * H);
        const cw = Math.max(1, Math.round(crop.w * W)), ch = Math.max(1, Math.round(crop.h * H));
        const cc = createCanvas(cw, ch);
        cc.getContext('2d').drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
        finalCanvas = cc;
      }
      outBuffer = await finalCanvas.encode('png');
    }

    const path = `${userId}/style-lab-parts/${resourceId}/${Date.now()}.png`;
    const { error: upErr } = await admin.storage.from('design-assets').upload(path, outBuffer, { contentType: 'image/png', upsert: true });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);
    const { data: urlData } = admin.storage.from('design-assets').getPublicUrl(path);

    const { data: inserted, error: insErr } = await admin
      .from('library_parts')
      .insert({
        user_id: userId,
        kind: 'image',
        source_id: `stylelab-visual:${resourceId}:${Date.now()}`,
        source_product_id: null,
        title: String(title).slice(0, 200),
        category: category || 'style_lab_component',
        notes: 'Saved from Style Lab visual layers.',
        file_url: urlData.publicUrl,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    return NextResponse.json({ ok: true, url: urlData.publicUrl, part: inserted });
  } catch (e) {
    const message = errorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
