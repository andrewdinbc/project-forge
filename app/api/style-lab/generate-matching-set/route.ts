import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

// Generate a batch of NEW style-matched assets from a saved Parts Library
// reference image -- e.g. "15 shapes for a color-by-number worksheet, in the
// same art style as this saved border/character/palette." (Aj, 2026-07-19)
//
// This is a DIFFERENT Replicate use case from the exact-shape (SAM) cutout
// work already flagged in VisualComponents.jsx / save-view: that's about
// isolating pixels that already exist on the page; this is about GENERATING
// new pixels that don't exist yet, conditioned on a style reference. Both
// need REPLICATE_API_TOKEN but call different models.
//
// Uses FLUX Kontext (black-forest-labs/flux-kontext-pro on Replicate), which
// as of mid-2026 is the strongest widely-available option for "take this
// reference image and produce new, on-style variations" -- much more
// reliable for keeping a consistent look across a batch than prompting
// Gemini/Recraft freeform each time (see Design Assets page), because the
// reference image is fed in as conditioning, not just described in words.
//
// POST { userId, partId, prompt, count? }
//   partId  -- a library_parts.id whose file_url is the style reference
//              (a saved component, palette swatch, or kept view)
//   prompt  -- what to generate, e.g. "a simple leaf outline for a
//              color-by-number worksheet, thick black lines, no shading"
//   count   -- how many variations, default 6, max 12
//
// Each generated image is uploaded to the design-assets bucket and inserted
// as its own library_parts row (kind 'image', category 'generated_set'),
// linked back to the source part in `notes` so you can trace where the style
// came from.
export const maxDuration = 280;

const REPLICATE_MODEL = 'black-forest-labs/flux-kontext-pro';

async function runReplicate(referenceImageUrl: string, prompt: string, seed: number) {
  const token = process.env.REPLICATE_API_TOKEN;
  const res = await fetch(`https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait=55',
    },
    body: JSON.stringify({
      input: {
        prompt,
        input_image: referenceImageUrl,
        aspect_ratio: '1:1',
        output_format: 'png',
        seed,
      },
    }),
  });
  let prediction: any = await res.json();
  if (!res.ok) {
    throw new Error(prediction?.detail || prediction?.error || `Replicate request failed (${res.status})`);
  }

  // Prefer:wait blocks up to ~55s; if it's still running, poll the rest of
  // the way ourselves (maxDuration above gives plenty of headroom).
  const deadline = Date.now() + 200_000;
  while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled') {
    if (Date.now() > deadline) throw new Error('Timed out waiting on Replicate');
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(prediction.urls.get, { headers: { Authorization: `Bearer ${token}` } });
    prediction = await poll.json();
  }
  if (prediction.status !== 'succeeded') {
    throw new Error(prediction?.error || `Generation ${prediction.status}`);
  }
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

    const { userId, partId, prompt, count = 6 } = (await request.json()) || {};
    if (!userId || !partId || !prompt) {
      return NextResponse.json({ error: 'userId, partId, and prompt are required' }, { status: 400 });
    }
    const n = Math.max(1, Math.min(12, parseInt(count, 10) || 6));

    const { data: sourcePart, error: srcErr } = await admin
      .from('library_parts')
      .select('id, title, file_url')
      .eq('id', partId)
      .eq('user_id', userId)
      .single();
    if (srcErr || !sourcePart) return NextResponse.json({ error: 'Source part not found' }, { status: 404 });
    if (!sourcePart.file_url) return NextResponse.json({ error: 'Source part has no reference image' }, { status: 400 });

    // Fire the batch concurrently -- each call is an independent Replicate
    // prediction, varied by seed so the set isn't 6 identical images.
    const results = await Promise.allSettled(
      Array.from({ length: n }, (_, i) => runReplicate(sourcePart.file_url, prompt, Date.now() + i))
    );

    const saved: any[] = [];
    const failures: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'rejected') {
        failures.push(r.reason?.message || String(r.reason));
        continue;
      }
      try {
        const imgRes = await fetch(r.value);
        const buf = Buffer.from(await imgRes.arrayBuffer());
        const path = `${userId}/generated-sets/${partId}/${Date.now()}-${i}.png`;
        const { error: upErr } = await admin.storage.from('design-assets').upload(path, buf, { contentType: 'image/png', upsert: true });
        if (upErr) throw new Error(upErr.message);
        const { data: urlData } = admin.storage.from('design-assets').getPublicUrl(path);
        const { data: inserted, error: insErr } = await admin
          .from('library_parts')
          .insert({
            user_id: userId,
            kind: 'image',
            source_id: `generated:${partId}:${Date.now()}-${i}`,
            title: `${sourcePart.title} — generated ${i + 1}`,
            category: 'generated_set',
            notes: `Generated from "${sourcePart.title}" (part ${partId}) · prompt: ${prompt}`,
            file_url: urlData.publicUrl,
          })
          .select()
          .single();
        if (insErr) throw new Error(insErr.message);
        saved.push(inserted);
      } catch (e: any) {
        failures.push(e?.message || String(e));
      }
    }

    return NextResponse.json({ ok: true, requested: n, saved, savedCount: saved.length, failures });
  } catch (e) {
    const message = errorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
