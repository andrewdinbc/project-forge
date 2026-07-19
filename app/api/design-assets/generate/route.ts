import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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
const LINE_ART_STYLE_SUFFIX =
  ', black and white line art, clean bold outlines, no shading, no color fill, no gradients, simple coloring-book style illustration, plain white background, designed to be colored in';

async function generateWithGemini(prompt: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in this project\'s environment variables');

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
    {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${prompt}${LINE_ART_STYLE_SUFFIX}` }] }],
      }),
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData || p.inline_data);
  const inline = imagePart?.inlineData || imagePart?.inline_data;
  if (!inline?.data) throw new Error('Gemini did not return an image (it may have only returned text -- try rephrasing the prompt)');
  return Buffer.from(inline.data, 'base64');
}

async function generateWithRecraft(prompt: string): Promise<Buffer> {
  const apiKey = process.env.RECRAFT_API_KEY;
  if (!apiKey) throw new Error('RECRAFT_API_KEY is not set in this project\'s environment variables');

  const res = await fetch('https://external.api.recraft.ai/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `${prompt}${LINE_ART_STYLE_SUFFIX}`,
      style: 'vector_illustration/line_art',
      size: '1024x1024',
      n: 1,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Recraft API error (${res.status}): ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const imageUrl = data?.data?.[0]?.url;
  if (!imageUrl) throw new Error('Recraft did not return an image URL');

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to download generated Recraft image (${imgRes.status})`);
  return Buffer.from(await imgRes.arrayBuffer());
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, prompt, provider } = body as { userId: string; prompt: string; provider: 'gemini' | 'recraft' };

    if (!userId || !prompt?.trim() || !provider) {
      return NextResponse.json({ error: 'userId, prompt, and provider are required' }, { status: 400 });
    }
    if (provider !== 'gemini' && provider !== 'recraft') {
      return NextResponse.json({ error: 'provider must be "gemini" or "recraft"' }, { status: 400 });
    }

    const buffer = provider === 'gemini' ? await generateWithGemini(prompt) : await generateWithRecraft(prompt);

    const path = `${userId}/${Date.now()}-${provider}.png`;
    const { error: uploadError } = await supabaseAdmin.storage.from('design-assets').upload(path, buffer, {
      contentType: 'image/png',
      upsert: true,
    });
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const { data: urlData } = supabaseAdmin.storage.from('design-assets').getPublicUrl(path);
    return NextResponse.json({ url: urlData.publicUrl, provider });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
