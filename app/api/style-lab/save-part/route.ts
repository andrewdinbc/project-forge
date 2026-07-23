import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { renderPageWithLayers } from '@/lib/pdf-layer-render';
import { cropPngRegion } from '@/lib/pdf-page-render';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

// Saves the current Style Lab visual-layer view (a page rendered with some
// content layers removed, optionally cropped to a region) as a reusable
// component in the Parts Library. The "save the microbial pieces" half of the
// deconstruction tool (Aj, 2026-07-19).
// POST body: { userId, resourceId, page, scale, text, images, title?, crop? }
//   crop = { x, y, width, height } in the rendered-PNG pixel space (optional).
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, resourceId, page = 1, scale = 1.3, text = true, images = true, title, crop } = body || {};
    if (!userId || !resourceId) {
      return NextResponse.json({ error: 'userId and resourceId are required' }, { status: 400 });
    }

    const { data: resource, error } = await admin
      .from('forge_resources')
      .select('file_url, title, source_type, user_id')
      .eq('id', resourceId)
      .eq('user_id', userId)
      .single();
    if (error || !resource) return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    if (!resource.file_url) return NextResponse.json({ error: 'This resource has no PDF file' }, { status: 400 });

    const pdfRes = await fetch(resource.file_url);
    if (!pdfRes.ok) return NextResponse.json({ error: `Could not download the PDF (${pdfRes.status})` }, { status: 422 });
    const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());

    const layers = { text: text !== false, images: images !== false };
    let buffer: any = await renderPageWithLayers(pdfBytes, page, layers, scale);

    if (crop && crop.width >= 10 && crop.height >= 10) {
      buffer = await cropPngRegion(
        buffer,
        Math.max(0, Math.round(crop.x)),
        Math.max(0, Math.round(crop.y)),
        Math.max(1, Math.round(crop.width)),
        Math.max(1, Math.round(crop.height)),
      );
    }

    // Human-readable description of what was kept/removed.
    const parts: string[] = [];
    if (!layers.text) parts.push('no text');
    if (!layers.images) parts.push('no images');
    const layerDesc = parts.length ? ` (${parts.join(', ')})` : ' (full page)';
    const savedTitle = (title && title.trim()) || `${resource.title} — p${page}${crop ? ' crop' : ''}${layerDesc}`;

    const path = `${userId}/style-lab-layers/${resourceId}/${Date.now()}-p${page}.png`;
    const { error: uploadError } = await admin.storage.from('design-assets').upload(path, buffer, {
      contentType: 'image/png',
      upsert: true,
    });
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);
    const { data: urlData } = admin.storage.from('design-assets').getPublicUrl(path);

    const { data: inserted, error: insertError } = await admin
      .from('library_parts')
      .insert({
        user_id: userId,
        kind: 'image',
        source_id: `stylelab:${resourceId}:p${page}:${Date.now()}`,
        source_product_id: null,
        title: savedTitle,
        category: 'style_lab_layer',
        notes: `From Style Lab visual layers${layerDesc}. Page ${page}.`,
        file_url: urlData.publicUrl,
      })
      .select()
      .single();
    if (insertError) throw insertError;

    return NextResponse.json({ ok: true, url: urlData.publicUrl, title: savedTitle, part: inserted });
  } catch (e) {
    const message = errorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
