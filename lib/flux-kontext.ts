// lib/flux-kontext.ts (Aj, 2026-07-20): the Replicate FLUX Kontext
// call+poll logic, extracted out of app/api/asset-modifier/ai-edit/route.ts
// so the new bulk-edit route (Needs Review -> apply one instruction to
// many parts at once) calls the exact same code instead of a second,
// possibly-drifting copy -- same single-source-of-truth principle as
// lib/pixel-art.js, lib/dot-shapes.js, and lib/crossword-engine.ts
// elsewhere in this codebase.
//
// 2026-07-23, real bug found and fixed: FLUX Kontext is an image-to-image
// model and rejects SVG input with error E006 ("input was invalid") --
// confirmed live, a PNG reference worked perfectly, an SVG reference
// failed immediately. This matters today specifically because today's
// Recraft-based character library fix (Owl Professor, Remy) saved its
// output as SVG, which every caller of runFluxKontext (generate-matching-
// set, instruct-erase, inpaint-view, bulk-edit) would otherwise silently
// break on. Fixed once, here, in the single shared entry point -- every
// caller gets this fix automatically, none of them need to know or care
// what format their source image happens to be.

import { supabaseAdmin } from '@/lib/supabase';
import sharp from 'sharp';

const admin: any = supabaseAdmin;
const REPLICATE_MODEL = 'black-forest-labs/flux-kontext-pro';

// If the image is already a raster format, return the URL unchanged --
// zero extra cost for the common case. Only SVGs get fetched, converted,
// and re-uploaded.
async function ensureRasterImage(imageUrl: string): Promise<string> {
  if (!imageUrl.toLowerCase().includes('.svg')) return imageUrl;

  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Could not fetch source image for raster conversion (${res.status})`);
  const svgBuffer = Buffer.from(await res.arrayBuffer());

  const pngBuffer = await sharp(svgBuffer, { density: 300 }).png().toBuffer();

  const path = `flux-kontext-converted/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const { error: uploadError } = await admin.storage.from('design-assets').upload(path, pngBuffer, {
    contentType: 'image/png',
    upsert: true,
  });
  if (uploadError) throw new Error(`Could not upload converted raster image: ${uploadError.message}`);

  const { data: urlData } = admin.storage.from('design-assets').getPublicUrl(path);
  return urlData.publicUrl as string;
}

export async function runFluxKontext(imageUrl: string, prompt: string): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set on this Vercel project yet. Add one from replicate.com/account/api-tokens.');

  const rasterImageUrl = await ensureRasterImage(imageUrl);

  const res = await fetch(`https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait=55' },
    body: JSON.stringify({
      input: {
        prompt,
        input_image: rasterImageUrl,
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
