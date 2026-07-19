import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// supabaseAdmin is a lazily-initialized Proxy from a plain .js file (see
// lib/supabase.js), so TypeScript sees it as `{}` with no properties --
// this compiled fine in every other .js route that uses it, but breaks
// strict TS compilation here since this route is .ts. Cast to any at the
// call site rather than changing the shared client's type broadly.
const admin: any = supabaseAdmin;

// Generates a design asset (line art / illustration) from a text prompt
// using either Gemini or Recraft, then stores it in the design-assets
// bucket and returns a public URL. Built specifically to compare the two
// for coloring-page-style line art, per Aj 2026-07-19 -- Composer's
// gap-fill feature can write the TEXT content of something like a color
// by number, but can't draw the actual illustration; this is the missing
// piece. Requires GEMINI_API_KEY and/or RECRAFT_API_KEY to be set in this
// project's Vercel environment variables -- neither key is provided by
// this code, each requires Aj's own account/billing with that provider.
//
// A style-guidance suffix is appended to every prompt so both providers
// are compared on equal footing for the actual target use case (clean
// black-and-white coloring-page line art), not generic image generation.
//
// 2026-07-19 fixes/additions:
// - Recraft bug fix: 'style' and 'substyle' are SEPARATE request fields
//   (confirmed against Recraft's own official MCP server source and
//   multiple independent docs) -- the prior version sent a single
//   slash-combined string 'vector_illustration/line_art', which Recraft's
//   API rejected outright (400 invalid_request_parameter). Corrected to
//   style: 'vector_illustration', substyle: 'line_art'.
// - Reference image support: an optional uploaded image can now be passed
//   alongside the prompt so the output can be guided toward "make it look
//   like this." Gemini's generateContent natively accepts an inline image
//   part alongside text (well-documented, high confidence). Recraft's
//   dedicated image-to-image endpoint is used for the same purpose --
//   its exact field names are confirmed from Recraft's own official MCP
//   server implementation, but this project has not yet exercised it
//   against the live API the way generate-image has, so if the request
//   shape needs adjusting once tested, that's expected next-iteration
//   work, not a guess treated as fact.
const LINE_ART_STYLE_SUFFIX =
  ', black and white line art, clean bold outlines, no shading, no color fill, no gradients, simple coloring-book style illustration, plain white background, designed to be colored in';

async function generateWithGemini(prompt: string, referenceImageBase64?: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in this project\'s environment variables');

  const parts: any[] = [];
  if (referenceImageBase64) {
    const match = referenceImageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    const mimeType = match?.[1] || 'image/png';
    const data = match?.[2] || referenceImageBase64;
    parts.push({ inline_data: { mime_type: mimeType, data } });
    parts.push({ text: `Using the attached reference image as a style/content guide, generate: ${prompt}${LINE_ART_STYLE_SUFFIX}` });
  } else {
    parts.push({ text: `${prompt}${LINE_ART_STYLE_SUFFIX}` });
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

async function generateWithRecraft(prompt: string, referenceImageBase64?: string): Promise<Buffer> {
  const apiKey = process.env.RECRAFT_API_KEY;
  if (!apiKey) throw new Error('RECRAFT_API_KEY is not set in this project\'s environment variables');

  const fullPrompt = `${prompt}${LINE_ART_STYLE_SUFFIX}`;
  let imageUrl: string | undefined;

  if (referenceImageBase64) {
    // Image-to-image: guide generation using an uploaded reference image.
    // Field names confirmed against Recraft's own official MCP server
    // source (imageURI/prompt/strength/style/substyle) -- adapted here to
    // this project's multipart REST call.
    const match = referenceImageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    const mimeType = match?.[1] || 'image/png';
    const base64Data = match?.[2] || referenceImageBase64;
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const formData = new FormData();
    formData.append('image', new Blob([imageBuffer], { type: mimeType }), 'reference.png');
    formData.append('prompt', fullPrompt);
    formData.append('strength', '0.6'); // moderate: guided by reference, not a near-copy
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
        prompt: fullPrompt,
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
// Recraft's `vector_illustration` style returns an SVG, but the route
// hardcoded `.png` + `image/png` on upload -- Supabase then served SVG bytes
// as image/png and the browser rendered a broken image. Magic bytes are the
// source of truth; never hardcode the stored type from the provider name again.
function sniffImageType(buffer: Buffer): { contentType: string; ext: string } {
  const b = buffer;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { contentType: 'image/png', ext: 'png' };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { contentType: 'image/jpeg', ext: 'jpg' };
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return { contentType: 'image/webp', ext: 'webp' };
  if (b.length >= 4 && b.toString('ascii', 0, 4) === 'GIF8') return { contentType: 'image/gif', ext: 'gif' };
  // SVG is text; tolerate a BOM, leading whitespace, an XML prolog or a comment before <svg
  const head = b.toString('utf8', 0, Math.min(b.length, 512)).replace(/^\uFEFF/, '').trimStart().toLowerCase();
  if (head.startsWith('<?xml') || head.startsWith('<svg') || head.includes('<svg')) return { contentType: 'image/svg+xml', ext: 'svg' };
  return { contentType: 'image/png', ext: 'png' }; // sensible default
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, prompt, provider, referenceImage } = body as {
      userId: string;
      prompt: string;
      provider: 'gemini' | 'recraft';
      referenceImage?: string; // data URL (data:image/png;base64,...)
    };

    if (!userId || !prompt?.trim() || !provider) {
      return NextResponse.json({ error: 'userId, prompt, and provider are required' }, { status: 400 });
    }
    if (provider !== 'gemini' && provider !== 'recraft') {
      return NextResponse.json({ error: 'provider must be "gemini" or "recraft"' }, { status: 400 });
    }

    const buffer =
      provider === 'gemini'
        ? await generateWithGemini(prompt, referenceImage)
        : await generateWithRecraft(prompt, referenceImage);

    // Store with the true type (e.g. Recraft vector output is SVG, not PNG) so
    // the browser can actually render it — see sniffImageType above.
    const { contentType, ext } = sniffImageType(buffer);
    const path = `${userId}/${Date.now()}-${provider}.${ext}`;
    const { error: uploadError } = await admin.storage.from('design-assets').upload(path, buffer, {
      contentType,
      upsert: true,
    });
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const { data: urlData } = admin.storage.from('design-assets').getPublicUrl(path);
    return NextResponse.json({ url: urlData.publicUrl, provider });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Provider quota / rate-limit conditions reflect the caller's own account
    // state, not a server fault — return 429 so they aren't miscounted as 500s
    // in error dashboards / by the auditor. The client already shows a friendly
    // "check your plan/billing" explanation for these.
    const isQuota = /\b429\b/.test(message) || /quota|rate[\s-]?limit/i.test(message);
    return NextResponse.json({ error: message }, { status: isQuota ? 429 : 500 });
  }
}
