import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

// Saves the current Asset Modifier canvas as a new Parts Library asset.
// POST { userId, dataUrl, title, sourcePartId?, category? }
export async function POST(request: NextRequest) {
  try {
    const { userId, dataUrl, title, sourcePartId, category } = (await request.json()) || {};
    if (!userId || !dataUrl || !title) {
      return NextResponse.json({ error: 'userId, dataUrl, and title are required' }, { status: 400 });
    }
    const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
    if (!m) return NextResponse.json({ error: 'dataUrl must be a base64 PNG' }, { status: 400 });
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length > 8 * 1024 * 1024) return NextResponse.json({ error: 'Image too large' }, { status: 413 });

    const path = `${userId}/asset-modifier/saved/${Date.now()}.png`;
    const { error: upErr } = await admin.storage.from('design-assets').upload(path, buf, { contentType: 'image/png', upsert: true });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
    const { data: urlData } = admin.storage.from('design-assets').getPublicUrl(path);

    // Per Aj, 2026-07-19: Product Builder's Border/Section Header/Font/Icon
    // & Illustration "editors" are all this same Asset Modifier, launched
    // with a category hint so what gets saved lands in the right Parts
    // Library slot instead of the generic 'asset_modifier' bucket.
    const validCategories = new Set(['border', 'section_header', 'font', 'icon_illustration', 'color_palette']);
    const resolvedCategory = validCategories.has(category) ? category : 'asset_modifier';

    // Provenance (Aj, 2026-07-20): "modify them... before Approval to move
    // from Needs Review to my parts library." Whatever this save is built
    // from, the resulting item needs an honest source_type so the
    // Copyright Auditor doesn't flag it as unexplained later:
    //   - editing a raw third-party-PDF extraction -> 'edited_derivative'
    //     (no longer a raw copy -- this IS the copyright-safe path the
    //     whole Needs Review -> Edit -> Parts Library flow exists for)
    //   - editing a Style Match result (already open-license) -> stays
    //     'external_license', license/attribution metadata carried forward
    //     unchanged since editing doesn't revoke the source license
    //   - starting from a blank canvas -> 'hand_drawn', Aj's own original
    let resolvedSourceType = 'hand_drawn';
    let licenseFields: Record<string, any> = {};
    if (sourcePartId) {
      const { data: original } = await admin
        .from('library_parts')
        .select('source_type, license_name, license_url, requires_attribution, attribution_text, external_source_url')
        .eq('id', sourcePartId)
        .single();
      if (original?.source_type === 'external_license') {
        resolvedSourceType = 'external_license';
        licenseFields = {
          license_name: original.license_name,
          license_url: original.license_url,
          requires_attribution: original.requires_attribution,
          attribution_text: original.attribution_text,
          external_source_url: original.external_source_url,
        };
      } else {
        resolvedSourceType = 'edited_derivative';
      }
    }

    const { data: inserted, error: insErr } = await admin
      .from('library_parts')
      .insert({
        user_id: userId,
        kind: 'image',
        source_id: `asset-modifier:${sourcePartId || 'blank'}:${Date.now()}`,
        source_product_id: null,
        title: String(title).trim() || 'Modified asset',
        category: resolvedCategory,
        notes: sourcePartId ? `Modified from part ${sourcePartId}` : 'Created in Asset Modifier',
        file_url: urlData.publicUrl,
        pending_review: false,
        source_type: resolvedSourceType,
        ...licenseFields,
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    return NextResponse.json({ ok: true, part: inserted });
  } catch (e) {
    const message = errorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
