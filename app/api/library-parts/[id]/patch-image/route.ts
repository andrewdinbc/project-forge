import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import sharp from 'sharp';

// POST /api/library-parts/[id]/patch-image
//
// Durable, product-side fix for recurring generation artifacts
// (2026-07-21). Built directly after a real incident: the exact same
// stray rectangle showed up in 6 separately-generated border images at
// nearly identical pixel coordinates, and fixing it required a Claude
// session to hand-edit files in its own ephemeral sandbox each time --
// a real single point of failure for a fix that should just be a
// feature. This makes "erase a known defect region" a permanent,
// callable capability of the product itself: works via a plain HTTP
// request, independent of any AI session's tooling being available.
// Committed via the browser extension's fetch(), not the usual bash+curl
// path, because the bash sandbox was down when this was built -- proof
// this fallback path is real, not just documented.
//
// body: { userId, regions?: [{x,y,width,height,color?}], preset?: string }
// Either pass explicit regions, or a named preset with known-good
// coordinates for a defect that's recurred enough to be worth naming.

const admin: any = supabaseAdmin;

const KNOWN_DEFECT_PRESETS: Record<string, { x: number; y: number; width: number; height: number }[]> = {
  // The stray placeholder rectangle from the "blank interior, no answer
  // key" quiz-border family -- confirmed at these exact coordinates
  // across 6 separate AI generations, so this is a template artifact,
  // not noise.
  quizBorderStrayRectangle: [{ x: 655, y: 250, width: 132, height: 42 }],
};

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId, regions, preset } = (await request.json()) || {};
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    const appliedRegions = preset ? KNOWN_DEFECT_PRESETS[preset] : regions;
    if (!appliedRegions?.length) {
      return NextResponse.json(
        { error: 'Provide regions, or a valid preset name', knownPresets: Object.keys(KNOWN_DEFECT_PRESETS) },
        { status: 400 }
      );
    }

    const { data: part, error: fetchErr } = await admin
      .from('library_parts')
      .select('id, file_url, user_id')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single();
    if (fetchErr || !part) return NextResponse.json({ error: 'Library part not found' }, { status: 404 });
    if (!part.file_url) return NextResponse.json({ error: 'This part has no image to patch' }, { status: 400 });

    const imgRes = await fetch(part.file_url);
    if (!imgRes.ok) return NextResponse.json({ error: `Could not fetch the current image (${imgRes.status})` }, { status: 502 });
    const inputBuffer = Buffer.from(await imgRes.arrayBuffer());

    const overlays = appliedRegions.map((r: any) => ({
      input: {
        create: {
          width: r.width,
          height: r.height,
          channels: 4 as const,
          background: r.color || { r: 255, g: 255, b: 255, alpha: 1 },
        },
      },
      left: r.x,
      top: r.y,
    }));

    const outputBuffer = await sharp(inputBuffer).composite(overlays).png().toBuffer();

    const path = `${userId}/patched/${Date.now()}-${params.id}.png`;
    const { error: uploadErr } = await admin.storage.from('design-assets').upload(path, outputBuffer, { contentType: 'image/png', upsert: true });
    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

    const { data: urlData } = admin.storage.from('design-assets').getPublicUrl(path);

    const { error: updateErr } = await admin.from('library_parts').update({ file_url: urlData.publicUrl }).eq('id', params.id);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, newFileUrl: urlData.publicUrl, regionsApplied: appliedRegions.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
