import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { runLamaInpaint, buildMaskBuffer } from '@/lib/style-lab-inpaint';

const admin: any = supabaseAdmin;

// AI "generative fill" for removed Style Lab components (Aj, 2026-07-19):
// "recolor everything around it to look as though it wasn't there in the
// first place." The live preview's edge-color-average fill (VisualComponents
// draw()) is free and instant but only convincing on flat/near-flat
// backgrounds; a title banner sitting on a pattern or gradient still reads as
// an obvious patch under that scheme. This route hands the real problem to
// an actual inpainting model instead of approximating it.
//
// Replicate call + mask building now live in lib/style-lab-inpaint.js,
// shared with the AI Instruction Removal tool (instruct-erase) so the two
// don't drift into two slightly-different implementations of the same thing.
//
// POST { userId, resourceId, page, hiddenBoxes }
//   hiddenBoxes -- array of {x,y,w,h} in the same 0..1 fractional-of-image
//                  coordinates VisualComponents already uses for boxes.
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
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

    const maskBuf = await buildMaskBuffer(hiddenBoxes, W, H);
    const maskPath = `${userId}/style-lab-masks/${resourceId}/${Date.now()}.png`;
    const { error: maskUpErr } = await admin.storage.from('design-assets').upload(maskPath, maskBuf, { contentType: 'image/png', upsert: true });
    if (maskUpErr) throw new Error(`Mask upload failed: ${maskUpErr.message}`);
    const { data: maskUrlData } = admin.storage.from('design-assets').getPublicUrl(maskPath);

    const resultUrl = await runLamaInpaint(analysis.imageUrl, maskUrlData.publicUrl);

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
