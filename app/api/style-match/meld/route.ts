import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

// Meld (Aj, 2026-07-20): "make a new [image] that combines this one with
// the free one as part of it." Takes 2+ library_parts images -- each
// already source_type external_license or edited_derivative, i.e. assets
// Aj already has clear rights to -- and asks Gemini's multi-image
// composition to blend them into one new design. Safe by construction:
// nothing from the originally-uploaded copyrighted product ever enters
// this function; it only ever touches Aj's own already-cleared assets.
//
// Lands in Needs Review (pending_review=true, source_type='ai_generated')
// rather than finalizing immediately, same as every other path into the
// real Parts Library -- Aj still wants to hand-edit/refine before
// approving it (per his 2026-07-20 "modify them... with AI assistance"
// instruction, same reasoning as Style Match Finder's staging change).

async function toInlineImage(url: string): Promise<{ mimeType: string; data: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch source image (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'image/png';
  return { mimeType: contentType.split(';')[0], data: buf.toString('base64') };
}

async function meldWithGemini(images: { mimeType: string; data: string }[], instruction: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in this project\'s environment variables');

  const parts: any[] = images.map((img) => ({ inline_data: { mime_type: img.mimeType, data: img.data } }));
  parts.push({ text: instruction });

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
  if (!inline?.data) throw new Error('Gemini did not return an image (it may have only returned text -- try rephrasing the blend instruction)');
  return Buffer.from(inline.data, 'base64');
}

export async function POST(request: NextRequest) {
  try {
    const { userId, category, title, partIds, instruction } = await request.json();
    if (!userId || !category || !Array.isArray(partIds) || partIds.length < 2) {
      return NextResponse.json({ error: 'userId, category, and at least 2 partIds are required' }, { status: 400 });
    }
    if (partIds.length > 3) {
      return NextResponse.json({ error: 'Meld supports up to 3 items at once' }, { status: 400 });
    }

    const { data: sources, error: fetchErr } = await admin
      .from('library_parts')
      .select('id, title, file_url, source_type')
      .eq('user_id', userId).in('id', partIds);
    if (fetchErr) throw new Error(fetchErr.message);
    if (!sources || sources.length !== partIds.length) {
      return NextResponse.json({ error: 'One or more source items were not found' }, { status: 404 });
    }
    const notOwned = sources.find((s: any) => !['external_license', 'edited_derivative'].includes(s.source_type));
    if (notOwned) {
      return NextResponse.json({ error: `"${notOwned.title}" isn't a free-license or already-edited item -- Meld only works with assets you already have clear rights to.` }, { status: 400 });
    }
    if (sources.some((s: any) => !s.file_url)) {
      return NextResponse.json({ error: 'One or more source items has no image to meld' }, { status: 400 });
    }

    const images = await Promise.all(sources.map((s: any) => toInlineImage(s.file_url)));
    const categoryLabel = category.replace(/_/g, ' ');
    const prompt = `Blend and meld these ${images.length} reference images into a single new, cohesive ${categoryLabel} design for a teaching resource. Combine their color palettes, motifs, and visual style into one unified new design -- don't just place them side by side. ${instruction ? `Additional direction: ${instruction}` : ''}`;

    const buffer = await meldWithGemini(images, prompt);
    const path = `${userId}/meld/${category}/${Date.now()}.png`;
    const { error: upErr } = await admin.storage.from('design-assets').upload(path, buffer, { contentType: 'image/png', upsert: true });
    if (upErr) throw new Error(upErr.message);
    const { data: urlData } = admin.storage.from('design-assets').getPublicUrl(path);

    const sourceTitles = sources.map((s: any) => s.title).join(' + ');
    const { data: inserted, error: insErr } = await admin
      .from('library_parts')
      .insert({
        user_id: userId, kind: 'image',
        source_id: `meld:${category}:${Date.now()}`,
        title: title || `${sourceTitles} (melded)`,
        category,
        notes: `AI-melded from: ${sourceTitles} (all already free-license/edited, source items: ${partIds.join(', ')})`,
        file_url: urlData.publicUrl,
        pending_review: true,
        source_type: 'ai_generated',
      })
      .select().single();
    if (insErr) throw new Error(insErr.message);

    return NextResponse.json({ ok: true, saved: inserted });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
