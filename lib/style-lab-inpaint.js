import { createCanvas } from '@napi-rs/canvas';

// Shared "remove and blend in" helpers for Style Lab (Aj, 2026-07-19).
// Used by both the per-component Smart Erase button (app/api/style-lab/
// inpaint-view) and the free-text AI Instruction Removal tool (app/api/
// style-lab/instruct-erase), so the Replicate call and mask-building logic
// live in exactly one place instead of drifting apart across two routes.

const REPLICATE_MODEL = 'zylim0702/remove-object'; // LaMa (Large Mask Inpainting)

// Sends {image, mask} to LaMa on Replicate and returns the result image URL.
// White = fill this in, black = leave alone (LaMa's mask convention).
export async function runLamaInpaint(imageUrl, maskUrl) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    const err = new Error(
      'REPLICATE_API_TOKEN is not set on this Vercel project yet. Add one from replicate.com/account/api-tokens, then this will work with no other changes.'
    );
    err.code = 'NO_TOKEN';
    throw err;
  }
  const res = await fetch(`https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait=55' },
    body: JSON.stringify({ input: { image: imageUrl, mask: maskUrl } }),
  });
  let prediction = await res.json();
  if (!res.ok) {
    throw new Error(prediction?.detail || prediction?.error || `Replicate request failed (${res.status})`);
  }

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
  return url;
}

// boxes: [{x,y,w,h}] as FRACTIONS of the image (0..1, x/y = top-left).
// Returns a PNG Buffer: black background, white rectangles over each box.
export async function buildMaskBuffer(boxes, W, H) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  for (const b of boxes) {
    ctx.fillRect(Math.round(b.x * W), Math.round(b.y * H), Math.round(b.w * W), Math.round(b.h * H));
  }
  return canvas.encode('png');
}
