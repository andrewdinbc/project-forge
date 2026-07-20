import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

// Saving a Style Match result (Aj, 2026-07-20): originally finalized
// straight to the real Parts Library since it's already open-license and
// needs no copyright review. Revised same day: "I still want to modify
// them before sending to parts library with AI assistance" -- so this now
// lands in Needs Review too (pending_review=true), same as a raw Separator
// extraction, EXCEPT tagged source_type='external_license' so the Auditor
// and the UI both know this one isn't in review for copyright reasons --
// it's just staged for Aj to combine, sketch over, and AI-edit via the
// existing Style Editor before it becomes a real asset. Editing it there
// (asset-modifier/save) carries the license metadata forward automatically.
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

    // Fonts have nothing to edit in the Style Editor (no image canvas) --
    // those still land directly, matching how Separator's own font_reference
    // rows already skip the review gate as derived data, not pixels.
    const isFont = category === 'font' || category === 'font_reference';

    const { data: inserted, error: insErr } = await admin
      .from('library_parts')
      .insert({
        user_id: userId, kind: fileUrl ? 'image' : 'component',
        source_id: `style-match:${category}:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title, category, file_url: fileUrl,
        notes: `Sourced from ${source} (${license}). ${sourceUrl}`,
        pending_review: !isFont,
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

    return NextResponse.json({ ok: true, saved: inserted, stagedForEditing: !isFont });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
