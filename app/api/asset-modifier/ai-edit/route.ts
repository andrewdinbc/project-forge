import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const admin: any = supabaseAdmin;

// Asset Modifier's AI instruction box (Aj, 2026-07-19): "an AI box where I
// can tell it to do changes." Takes whatever's currently rendered on the
// canvas plus a free-text instruction and sends it to FLUX Kontext (same
// model already used for Generate Matching Set) for a reference-image-
// conditioned edit -- keeps the result visually consistent with what's
// there instead of generating something unrelated.
//
// POST { userId, imageDataUrl, instruction }
export const maxDuration = 120;

const REPLICATE_MODEL = 'black-forest-labs/flux-kontext-pro';

async function runFluxKontext(imageUrl: string, prompt: string) {
  const token = process.env.REPLICATE_API_TOKEN;
  const res = await fetch(`https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait=55' },
    body: JSON.stringify({
      input: {
        prompt,
        input_image: imageUrl,
        aspect_ratio: 'match_input_image',
        output_format: 'png',
      },
    }),
  });
  let prediction: any = await res.json();
  if (!res.ok) throw new Error(prediction?.detail || prediction?.error || `Replicate request failed (${res.status})`);

  const deadline = Date.now() + 100_000;
  while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled') {
    if (Date.now() > deadline) throw new Error('Timed out waiting on Replicate');
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(prediction.urls.get, { headers: { Authorization: `Bearer ${token}` } });
    prediction = await poll.json();
  }
  if (prediction.status !== 'succeeded') throw new Error(prediction?.error || `Edit ${prediction.status}`);
  const out = prediction.output;
  const url = Array.isArray(out) ? out[0] : out;
  if (!url) throw new Error('No image returned from Replicate');
  return url as string;
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN is not set on this Vercel project yet. Add one from replicate.com/account/api-tokens.' },
        { status: 400 }
      );
    }
    const { userId, imageDataUrl, instruction } = (await request.json()) || {};
    if (!userId || !imageDataUrl || !instruction || !String(instruction).trim()) {
      return NextResponse.json({ error: 'userId, imageDataUrl, and instruction are required' }, { status: 400 });
    }
    const m = /^data:image\/png;base64,(.+)$/.exec(imageDataUrl);
    if (!m) return NextResponse.json({ error: 'imageDataUrl must be a base64 PNG' }, { status: 400 });
    const inBuf = Buffer.from(m[1], 'base64');
    if (inBuf.length > 8 * 1024 * 1024) return NextResponse.json({ error: 'Canvas image too large' }, { status: 413 });

    // Upload the current canvas so Replicate has a URL to fetch (it can't take base64 directly).
    const srcPath = `${userId}/asset-modifier/src/${Date.now()}.png`;
    const { error: srcErr } = await admin.storage.from('design-assets').upload(srcPath, inBuf, { contentType: 'image/png', upsert: true });
    if (srcErr) throw new Error(`Upload failed: ${srcErr.message}`);
    const { data: srcUrlData } = admin.storage.from('design-assets').getPublicUrl(srcPath);

    const resultUrl = await runFluxKontext(srcUrlData.publicUrl, String(instruction).trim());

    // Re-host so the canvas doesn't depend on Replicate's temporary output URL.
    const resultRes = await fetch(resultUrl);
    const resultBuf = Buffer.from(await resultRes.arrayBuffer());
    const outPath = `${userId}/asset-modifier/edited/${Date.now()}.png`;
    const { error: outErr } = await admin.storage.from('design-assets').upload(outPath, resultBuf, { contentType: 'image/png', upsert: true });
    if (outErr) throw new Error(`Result upload failed: ${outErr.message}`);
    const { data: outUrlData } = admin.storage.from('design-assets').getPublicUrl(outPath);

    return NextResponse.json({ ok: true, imageUrl: outUrlData.publicUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
