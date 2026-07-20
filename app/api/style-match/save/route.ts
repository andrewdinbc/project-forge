import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

// Saving a Style Match result (Aj, 2026-07-20): this is the other side of
// style-search -- takes the candidate Aj picked and lands it directly in
// the real Parts Library, source_type='external_license', WITH the license
// metadata attached to the row (not just shown once in a search UI and
// forgotten). requires_attribution + attribution_text travel with the
// asset so the Copyright Auditor -- and Aj, months from now -- can always
// answer "do I owe someone credit for this" without re-searching.
//
// Fonts don't have a downloadable image (the row IS the reference, same as
// the existing Separator font_reference rows) -- just insert the metadata
// row, no storage upload.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId, category, title, previewUrl, sourceUrl, source,
      license, licenseUrl, requiresAttribution, attributionText,
      replacesPendingId,
    } = body;
    if (!userId || !category || !title) {
      return NextResponse.json({ error: 'userId, category, and title are required' }, { status: 400 });
    }

    let fileUrl: string | null = null;
    if (category !== 'font' && category !== 'font_reference' && previewUrl) {
      const imgRes = await fetch(previewUrl);
      if (!imgRes.ok) return NextResponse.json({ error: `Could not download the source image (${imgRes.status})` }, { status: 422 });
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const contentType = imgRes.headers.get('content-type') || 'image/png';
      const ext = contentType.includes('svg') ? 'svg' : contentType.includes('jpeg') ? 'jpg' : 'png';
      const path = `${userId}/style-match/${category}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await admin.storage.from('design-assets').upload(path, buffer, { contentType, upsert: true });
      if (upErr) throw new Error(upErr.message);
      const { data: urlData } = admin.storage.from('design-assets').getPublicUrl(path);
      fileUrl = urlData.publicUrl;
    }

    const { data: inserted, error: insErr } = await admin
      .from('library_parts')
      .insert({
        user_id: userId, kind: fileUrl ? 'image' : 'component',
        source_id: `style-match:${category}:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title, category, file_url: fileUrl,
        notes: `Sourced from ${source} (${license}). ${sourceUrl}`,
        pending_review: false,
        source_type: 'external_license',
        license_name: license || null,
        license_url: licenseUrl || null,
        attribution_text: attributionText || null,
        requires_attribution: !!requiresAttribution,
        external_source_url: sourceUrl || null,
      })
      .select().single();
    if (insErr) throw new Error(insErr.message);

    // The pending row it's replacing (the copyrighted-PDF extraction) gets
    // dismissed automatically -- Aj picked a free-license equivalent
    // instead of editing the original, so the original never needs to
    // stick around in Needs Review.
    if (replacesPendingId) {
      await admin.from('library_parts').delete().eq('id', replacesPendingId).eq('user_id', userId);
    }

    return NextResponse.json({ ok: true, saved: inserted });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
