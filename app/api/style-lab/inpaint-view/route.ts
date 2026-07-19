import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const admin: any = supabaseAdmin;

// AI "generative fill" for removed Style Lab components (Aj, 2026-07-19):
// "recolor everything around it to look as though it wasn't there in the
// first place." The live preview's edge-color-average fill (VisualComponents
// draw()) is free and instant but only convincing on flat/near-flat
// backgrounds; a title banner sitting on a pattern or gradient still reads as
// an obvious patch under that scheme. This route hands the real problem to
// an actual inpainting model instead of approximating it.
//
// Model: zylim0702/remove-object (LaMa -- Large Mask Inpainting). Chosen over
// a general instruction-following editor (FLUX Kontext, used elsewhere for
// Generate Matching Set) because this is a mask-based fill task with no
// content to describe -- LaMa takes image + mask and reconstructs the masked
// region from surrounding structure, no prompt needed, ~3s, ~$0.0006/run.
//
// POST { userId, resourceId, page, hiddenBoxes }
//   hiddenBoxes -- array of {x,y,w,h} in the same 0..1 fractional-of-image
//                  coordinates VisualComponents already uses for boxes.
// Builds a black/white mask from those boxes, sends the cached analyzed page
// image + mask to Replicate, uploads the result, and saves it straight to
// Parts Library (category 'style_lab_smart_erase') -- mirrors the
// generate-matching-set pattern of doing the save server-side in one call.
export const maxDuration = 120;

const REPLICATE_MODEL = 'zylim0702/remove-object';

async function runReplicate(imageUrl: string, maskUrl: string) {
  const token = process.env.REPLICATE_API_TOKEN;
  const res = await fetch(`https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait=55' },
    body: JSON.stringify({ input: { image: imageUrl, mask: maskUrl } }),
  });
  let prediction: any = await res.json();
  if (!res.ok) throw new Error(prediction?.detail || prediction?.error || `Replicate request failed (${res.status})`);

  const deadline = Date.now() + 90_000;
  while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled') {
    if (Date.now() > deadline) throw new Error('Timed out waiting on Replicate');
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(prediction.urls.get, { headers: { Authorization: `Bearer ${token}` } });
    prediction = await poll.json();
  }
  if (prediction.status !== 'succeeded') throw new Error(prediction?.error || `Inpainting ${prediction.status}`);
  const out = prediction.output;
  const url = Array.isArray(out) ? out[0] : out;
  if (!url) throw new Error('No image returned from Replicate');
  return url as string;
}

export async function POST(request: NextRequest) {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN is not set on this Vercel project yet. Add one from replicate.com/account/api-tokens, then this will work with no other changes.' },
        { status: 400 }
      );
    }

    const { userId, resourceId, page = 1, hiddenBoxes } = (await request.json()) || {};
    if (!userId || !resourceId || !Array.isArray(hiddenBoxes) || hiddenBoxes.length === 0) {
      return NextResponse.json({ error: 'userId, resourceId, and at least one hiddenBox are required' }, { status: 400 });
    }

    const { data: resource, error } = await admin
      .from('forge_resources')
      .select('visual_analysis, title')
      .eq('id', resourceId)
      .eq('user_id', userId)
      .single();
    if (error || !resource) return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    const analysis = resource.visual_analysis;
    if (!analysis?.imageUrl || analysis.page !== page) {
      return NextResponse.json({ error: 'No analyzed image cached for this page yet — open Visual layers on this page first' }, { status: 400 });
    }

    const W = analysis.width, H = analysis.height;

    // Build the mask: white = fill this in, black = leave alone (LaMa convention).
    const maskCanvas = createCanvas(W, H);
    const mctx = maskCanvas.getContext('2d');
    mctx.fillStyle = '#000000';
    mctx.fillRect(0, 0, W, H);
    mctx.fillStyle = '#ffffff';
    for (const b of hiddenBoxes) {
      mctx.fillRect(Math.round(b.x * W), Math.round(b.y * H), Math.round(b.w * W), Math.round(b.h * H));
    }
    const maskBuf = await maskCanvas.encode('png');

    const maskPath = `${userId}/style-lab-masks/${resourceId}/${Date.now()}.png`;
    const { error: maskUpErr } = await admin.storage.from('design-assets').upload(maskPath, maskBuf, { contentType: 'image/png', upsert: true });
    if (maskUpErr) throw new Error(`Mask upload failed: ${maskUpErr.message}`);
    const { data: maskUrlData } = admin.storage.from('design-assets').getPublicUrl(maskPath);

    const resultUrl = await runReplicate(analysis.imageUrl, maskUrlData.publicUrl);

    // Re-host the Replicate result in our own storage so it doesn't depend on
    // Replicate's (temporary) output URL staying alive.
    const resultRes = await fetch(resultUrl);
    const resultBuf = Buffer.from(await resultRes.arrayBuffer());
    const outPath = `${userId}/style-lab-parts/${resourceId}/inpainted-${Date.now()}.png`;
    const { error: outUpErr } = await admin.storage.from('design-assets').upload(outPath, resultBuf, { contentType: 'image/png', upsert: true });
    if (outUpErr) throw new Error(`Result upload failed: ${outUpErr.message}`);
    const { data: outUrlData } = admin.storage.from('design-assets').getPublicUrl(outPath);

    const { data: inserted, error: insErr } = await admin
      .from('library_parts')
      .insert({
        user_id: userId,
        kind: 'image',
        source_id: `stylelab-inpaint:${resourceId}:${Date.now()}`,
        title: `${resource.title || 'Resource'} — seamless removal (page ${page})`,
        category: 'style_lab_smart_erase',
        file_url: outUrlData.publicUrl,
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    return NextResponse.json({ ok: true, imageUrl: outUrlData.publicUrl, part: inserted });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
