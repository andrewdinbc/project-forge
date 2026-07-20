// lib/flux-kontext.ts (Aj, 2026-07-20): the Replicate FLUX Kontext
// call+poll logic, extracted out of app/api/asset-modifier/ai-edit/route.ts
// so the new bulk-edit route (Needs Review -> apply one instruction to
// many parts at once) calls the exact same code instead of a second,
// possibly-drifting copy -- same single-source-of-truth principle as
// lib/pixel-art.js, lib/dot-shapes.js, and lib/crossword-engine.ts
// elsewhere in this codebase.
const REPLICATE_MODEL = 'black-forest-labs/flux-kontext-pro';

export async function runFluxKontext(imageUrl: string, prompt: string): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set on this Vercel project yet. Add one from replicate.com/account/api-tokens.');
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
