import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';
import { runFluxKontext } from '@/lib/flux-kontext';

const admin: any = supabaseAdmin;

// Asset Modifier's AI instruction box (Aj, 2026-07-19): "an AI box where I
// can tell it to do changes." Takes whatever's currently rendered on the
// canvas plus a free-text instruction and sends it to FLUX Kontext (same
// model already used for Generate Matching Set) for a reference-image-
// conditioned edit -- keeps the result visually consistent with what's
// there instead of generating something unrelated.
//
// POST { userId, imageDataUrl, instruction }
//
// The actual Replicate call+poll logic now lives in lib/flux-kontext.ts
// (extracted 2026-07-20) so the new bulk-edit route (Needs Review -> one
// instruction applied to many parts at once) shares this exact code
// rather than a second copy.
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const { userId, imageDataUrl, instruction } = (await request.json()) || {};
    if (!userId || !imageDataUrl || !instruction || !String(instruction).trim()) {
      return NextResponse.json({ error: 'userId, imageDataUrl, and instruction are required' }, { status: 400 });
    }
    const m = /^data:image\/png;base64,(.+)$/.exec(imageDataUrl);
    if (!m) return NextResponse.json({ error: 'imageDataUrl must be a base64 PNG' }, { status: 400 });
    const inBuf = Buffer.from(m[1], 'base64');
    if (inBuf.length > 8 * 1024 * 1024) return NextResponse.json({ error: 'Canvas image too large' }, { status: 413 });

    const srcPath = `${userId}/asset-modifier/src/${Date.now()}.png`;
    const { error: srcErr } = await admin.storage.from('design-assets').upload(srcPath, inBuf, { contentType: 'image/png', upsert: true });
    if (srcErr) throw new Error(`Upload failed: ${srcErr.message}`);
    const { data: srcUrlData } = admin.storage.from('design-assets').getPublicUrl(srcPath);

    const resultUrl = await runFluxKontext(srcUrlData.publicUrl, String(instruction).trim());

    const resultRes = await fetch(resultUrl);
    const resultBuf = Buffer.from(await resultRes.arrayBuffer());
    const outPath = `${userId}/asset-modifier/edited/${Date.now()}.png`;
    const { error: outErr } = await admin.storage.from('design-assets').upload(outPath, resultBuf, { contentType: 'image/png', upsert: true });
    if (outErr) throw new Error(`Result upload failed: ${outErr.message}`);
    const { data: outUrlData } = admin.storage.from('design-assets').getPublicUrl(outPath);

    return NextResponse.json({ ok: true, imageUrl: outUrlData.publicUrl });
  } catch (e) {
    const message = errorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
