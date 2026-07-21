import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import sharp from 'sharp';

// POST /api/library-parts/[id]/patch-image
//
// Durable, product-side fix for recurring generation artifacts
// (2026-07-21). Built after a real incident: the exact same stray
// rectangle showed up in 6 separately-generated border images at nearly
// identical pixel coordinates, and fixing it required a Claude session
// to hand-edit files in its own ephemeral sandbox each time -- a real
// single point of failure for a fix that should just be a feature. This
// makes "erase a known defect region" a permanent, callable capability
// of the product itself, independent of any AI session's tooling.
// CORS-enabled (same pattern as math-mastery's /api/analytics and
// /api/tokens/leaderboard) so it's callable cross-origin, not just from
// project-forge's own pages.
//
// body: { userId, regions?: [{x,y,width,height,color?}], preset?: string }

const admin: any = supabaseAdmin;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

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
    if (!userId) return json({ error: 'userId is required' }, 400);

    const appliedRegions = preset ? KNOWN_DEFECT_PRESETS[preset] : regions;
    if (!appliedRegions?.length) {
      return json({ error: 'Provide regions, or a valid preset name', knownPresets: Object.keys(KNOWN_DEFECT_PRESETS) }, 400);
    }

    const { data: part, error: fetchErr } = await admin
      .from('library_parts')
      .select('id, file_url, user_id')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single();
    if (fetchErr || !part) return json({ error: 'Library part not found' }, 404);
    if (!part.file_url) return json({ error: 'This part has no image to patch' }, 400);

    const imgRes = await fetch(part.file_url);
    if (!imgRes.ok) return json({ error: `Could not fetch the current image (${imgRes.status})` }, 502);
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
    if (uploadErr) return json({ error: uploadErr.message }, 500);

    const { data: urlData } = admin.storage.from('design-assets').getPublicUrl(path);

    const { error: updateErr } = await admin.from('library_parts').update({ file_url: urlData.publicUrl }).eq('id', params.id);
    if (updateErr) return json({ error: updateErr.message }, 500);

    return json({ ok: true, newFileUrl: urlData.publicUrl, regionsApplied: appliedRegions.length });
  } catch (e: any) {
    return json({ error: e.message || String(e) }, 500);
  }
}
