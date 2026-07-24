import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

// Recraft inpainting (Aj, 2026-07-24): "I like the color backgrounds you
// made, I do not like the character you put in them." The background
// generations were image-to-image conditioned on a character reference,
// and despite the prompt explicitly asking for no people, the character
// (and a flag) kept showing up anyway -- the reference image itself
// contained them, and conditioning strength wasn't enough to fully
// suppress that. Rather than regenerate from scratch and risk the same
// problem (or lose the background style Aj said he liked), this erases
// just the unwanted region and fills it back in with matching
// surroundings, via Recraft's real inpaint endpoint -- a mask marks what
// to remove (white = erase/regenerate, black = leave untouched).
//
// Deliberately NOT using the LaMa/Replicate inpaint helper already in
// lib/style-lab-inpaint.js -- that requires REPLICATE_API_TOKEN, which
// is out of credit right now. Recraft has its own inpaint endpoint and
// Recraft credit is funded, so this uses that instead.
//
// POST { userId, imageDataUrl, maskDataUrl, prompt, style? }
//   imageDataUrl -- data URL of the source image to edit
//   maskDataUrl  -- data URL of the mask (white = erase, black = keep)
//   prompt       -- what should appear in the erased region instead
export const maxDuration = 90;

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  const mimeType = match?.[1] || 'image/png';
  const base64Data = match?.[2] || dataUrl;
  return { buffer: Buffer.from(base64Data, 'base64'), mimeType };
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.RECRAFT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'RECRAFT_API_KEY is not set on this Vercel project.' }, { status: 400 });
    }

    const { userId, imageDataUrl, maskDataUrl, prompt, style } = (await request.json()) || {};
    if (!userId || !imageDataUrl || !maskDataUrl || !prompt) {
      return NextResponse.json({ error: 'userId, imageDataUrl, maskDataUrl, and prompt are required' }, { status: 400 });
    }

    const { buffer: imageBuf, mimeType: imageMime } = dataUrlToBuffer(imageDataUrl);
    const { buffer: maskBuf, mimeType: maskMime } = dataUrlToBuffer(maskDataUrl);

    const formData = new FormData();
    formData.append('image', new Blob([imageBuf], { type: imageMime }), 'image.png');
    formData.append('mask', new Blob([maskBuf], { type: maskMime }), 'mask.png');
    formData.append('prompt', prompt);
    formData.append('style', style || 'digital_illustration');

    const res = await fetch('https://external.api.recraft.ai/v1/images/inpaint', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json({ error: `Recraft inpaint error (${res.status}): ${errText.slice(0, 300)}` }, { status: 502 });
    }
    const data = await res.json();
    const imageUrl = data?.data?.[0]?.url;
    if (!imageUrl) {
      return NextResponse.json({ error: 'Recraft inpaint did not return an image URL' }, { status: 502 });
    }

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return NextResponse.json({ error: `Failed to download inpainted image (${imgRes.status})` }, { status: 502 });
    const resultBuf = Buffer.from(await imgRes.arrayBuffer());

    const path = `${userId}/inpainted/${Date.now()}-recraft.png`;
    const { error: uploadError } = await admin.storage.from('design-assets').upload(path, resultBuf, {
      contentType: 'image/png',
      upsert: true,
    });
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);
    const { data: urlData } = admin.storage.from('design-assets').getPublicUrl(path);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (e) {
    const message = errorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
