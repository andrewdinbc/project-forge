// lib/design-assets-gen.ts (Aj, 2026-07-21): the Gemini/Recraft image-generation
// call logic, extracted out of app/api/design-assets/generate/route.ts so the
// new Comic Generator (and any future caller) can request a raw generated
// image buffer directly -- a function call, not an HTTP round-trip to our
// own API -- without a second, possibly-drifting copy of the provider
// logic. Same single-source-of-truth principle as lib/flux-kontext.ts.
//
// Behavior is unchanged from the original route: same two providers, same
// reference-image support, same magic-byte type sniffing. The only real
// change is that the style suffix is now the CALLER's responsibility --
// generateImageBuffer takes a already-complete prompt, so design-assets/
// generate/route.ts appends its coloring-page suffixes and the Comic
// Generator appends its own comic-panel suffix, without either one having
// to know about the other's vocabulary.

export const LINE_ART_STYLE_SUFFIX =
  ', black and white line art, clean bold outlines, no shading, no color fill, no gradients, simple coloring-book style illustration, plain white background, designed to be colored in';

export const FLAT_COLOR_ICON_SUFFIX =
  ', flat vector clip art style, bold black outlines, bright cheerful saturated colors, simple friendly cartoon illustration, plain white background, no gradients, no shading, designed for children\'s educational materials';

export const STYLE_SUFFIXES: Record<string, string> = {
  line_art: LINE_ART_STYLE_SUFFIX,
  flat_color_icon: FLAT_COLOR_ICON_SUFFIX,
};

export async function generateWithGemini(prompt: string, referenceImageBase64?: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in this project\'s environment variables');

  const parts: any[] = [];
  if (referenceImageBase64) {
    const match = referenceImageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    const mimeType = match?.[1] || 'image/png';
    const data = match?.[2] || referenceImageBase64;
    parts.push({ inline_data: { mime_type: mimeType, data } });
    parts.push({ text: `Using the attached reference image as a style/content guide, generate: ${prompt}` });
  } else {
    parts.push({ text: prompt });
  }

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
    {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const resultParts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = resultParts.find((p: any) => p.inlineData || p.inline_data);
  const inline = imagePart?.inlineData || imagePart?.inline_data;
  if (!inline?.data) throw new Error('Gemini did not return an image (it may have only returned text -- try rephrasing the prompt)');
  return Buffer.from(inline.data, 'base64');
}

export async function generateWithRecraft(prompt: string, referenceImageBase64?: string): Promise<Buffer> {
  const apiKey = process.env.RECRAFT_API_KEY;
  if (!apiKey) throw new Error('RECRAFT_API_KEY is not set in this project\'s environment variables');

  let imageUrl: string | undefined;

  if (referenceImageBase64) {
    const match = referenceImageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    const mimeType = match?.[1] || 'image/png';
    const base64Data = match?.[2] || referenceImageBase64;
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const formData = new FormData();
    formData.append('image', new Blob([imageBuffer], { type: mimeType }), 'reference.png');
    formData.append('prompt', prompt);
    formData.append('strength', '0.6');
    formData.append('style', 'vector_illustration');
    formData.append('substyle', 'line_art');

    const res = await fetch('https://external.api.recraft.ai/v1/images/imageToImage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Recraft image-to-image error (${res.status}): ${errText.slice(0, 300)}`);
    }
    const data = await res.json();
    imageUrl = data?.data?.[0]?.url ?? data?.image?.url;
    if (!imageUrl) throw new Error('Recraft image-to-image did not return an image URL');
  } else {
    const res = await fetch('https://external.api.recraft.ai/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        style: 'vector_illustration',
        substyle: 'line_art',
        size: '1024x1024',
        n: 1,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Recraft API error (${res.status}): ${errText.slice(0, 300)}`);
    }
    const data = await res.json();
    imageUrl = data?.data?.[0]?.url;
    if (!imageUrl) throw new Error('Recraft did not return an image URL');
  }

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to download generated Recraft image (${imgRes.status})`);
  return Buffer.from(await imgRes.arrayBuffer());
}

// Detects the REAL image type from the bytes, so we store and serve the file
// with the correct content-type/extension regardless of which provider
// produced it and what it claimed. Durable guard for the 2026-07-19 bug where
// Recraft's `vector_illustration` style returns an SVG, but a hardcoded
// `.png` + `image/png` on upload meant Supabase served SVG bytes as
// image/png and the browser rendered a broken image. Magic bytes are the
// source of truth; never hardcode the stored type from the provider name.
export function sniffImageType(buffer: Buffer): { contentType: string; ext: string } {
  const b = buffer;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { contentType: 'image/png', ext: 'png' };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { contentType: 'image/jpeg', ext: 'jpg' };
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return { contentType: 'image/webp', ext: 'webp' };
  if (b.length >= 4 && b.toString('ascii', 0, 4) === 'GIF8') return { contentType: 'image/gif', ext: 'gif' };
  const head = b.toString('utf8', 0, Math.min(b.length, 512)).replace(/^\uFEFF/, '').trimStart().toLowerCase();
  if (head.startsWith('<?xml') || head.startsWith('<svg') || head.includes('<svg')) return { contentType: 'image/svg+xml', ext: 'svg' };
  return { contentType: 'image/png', ext: 'png' };
}

// High-level entry point: takes an ALREADY-COMPLETE prompt (caller has
// appended whatever style suffix it wants) and returns the generated image
// buffer plus its sniffed real content type. Never throws away a failure
// silently -- callers that want best-effort behavior across many parallel
// calls (e.g. 6 comic panels) should .catch() at the call site themselves.
export async function generateImageBuffer(opts: {
  prompt: string;
  provider: 'gemini' | 'recraft';
  referenceImage?: string;
}): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  const { prompt, provider, referenceImage } = opts;
  if (!prompt?.trim()) throw new Error('prompt is required');
  if (provider !== 'gemini' && provider !== 'recraft') throw new Error('provider must be "gemini" or "recraft"');

  const buffer = provider === 'gemini'
    ? await generateWithGemini(prompt, referenceImage)
    : await generateWithRecraft(prompt, referenceImage);

  const { contentType, ext } = sniffImageType(buffer);
  return { buffer, contentType, ext };
}
