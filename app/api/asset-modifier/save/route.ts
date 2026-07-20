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
