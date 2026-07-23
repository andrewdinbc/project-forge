import { NextRequest, NextResponse } from 'next/server';
import { getProduct } from '@/lib/products';
import { supabaseAdmin } from '@/lib/supabase';
import { renderPdfPageToPng, cropPngRegion } from '@/lib/pdf-page-render';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

// Crops a rectangular region out of a rendered PDF page and saves it as a
// standalone image in the Parts Library. Step 2 of PDF disassembly --
// handles diagrams, vector art, single questions, anything that isn't a
// discrete embedded image object (see lib/pdf-page-render.js).
// POST /api/products/[productId]/crop-page
// body: { userId, page, scale, x, y, width, height, title? }
// x/y/width/height are in the SAME pixel space as the rendered PNG at the
// given scale (i.e. the client must have rendered at this same scale and
// translated its on-screen selection into that pixel space already).
export async function POST(request: NextRequest, { params }: { params: { productId: string } }) {
  try {
    const body = await request.json();
    const { userId, page, scale, x, y, width, height, title } = body;
    if (!userId || !page || !scale || x == null || y == null || !width || !height) {
      return NextResponse.json({ error: 'userId, page, scale, x, y, width, and height are required' }, { status: 400 });
    }
    if (width < 10 || height < 10) {
      return NextResponse.json({ error: 'Selection is too small to save (minimum 10x10px)' }, { status: 400 });
    }

    const product = await getProduct(params.productId, userId, admin);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (!product.file_url) return NextResponse.json({ error: 'This product has no file uploaded yet' }, { status: 400 });

    const pdfRes = await fetch(product.file_url);
    if (!pdfRes.ok) return NextResponse.json({ error: `Could not download the PDF (${pdfRes.status})` }, { status: 422 });
    const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());

    const pageBuffer = await renderPdfPageToPng(pdfBytes, page, scale);

    // Clamp the requested rectangle to the actual rendered image bounds --
    // client-side coordinate translation could round slightly outside the
    // page edge, which would otherwise throw during cropping.
    const clampedX = Math.max(0, Math.round(x));
    const clampedY = Math.max(0, Math.round(y));
    const clampedWidth = Math.max(1, Math.round(width));
    const clampedHeight = Math.max(1, Math.round(height));

    const cropBuffer = await cropPngRegion(pageBuffer, clampedX, clampedY, clampedWidth, clampedHeight);

    const cropTitle = title?.trim() || `${product.title} -- page ${page} crop`;
    const path = `${userId}/cropped/${params.productId}/${Date.now()}-p${page}.png`;
    const { error: uploadError } = await admin.storage.from('design-assets').upload(path, cropBuffer, {
      contentType: 'image/png',
      upsert: true,
    });
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);
    const { data: urlData } = admin.storage.from('design-assets').getPublicUrl(path);

    await admin.from('library_parts').insert({
      user_id: userId, kind: 'image',
      source_id: `${params.productId}:crop:p${page}:${Date.now()}`,
      source_product_id: params.productId,
      title: cropTitle, category: 'cropped_image', file_url: urlData.publicUrl,
    });

    return NextResponse.json({ url: urlData.publicUrl, title: cropTitle });
  } catch (e) {
    const message = errorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
