import { NextRequest, NextResponse } from 'next/server';
import { getProduct } from '@/lib/products';
import { supabaseAdmin } from '@/lib/supabase';
import { extractImagesFromPdf } from '@/lib/pdf-image-extract';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

// Extracts every embedded raster image from a product's PDF and stores
// each as a standalone file in the design-assets bucket, ready to reuse.
// Step 1 of "disassemble a PDF to reuse the parts I like" -- see
// lib/pdf-image-extract.js for exactly what's covered and what's skipped.
// Server-side route: passes supabaseAdmin explicitly to getProduct, same
// RLS pattern as every other server route in this app (no browser
// session here, anon client would be silently blocked).
export async function POST(request: NextRequest, { params }: { params: { productId: string } }) {
  try {
    const body = await request.json();
    const { userId } = body;
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    const product = await getProduct(params.productId, userId, admin);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (!product.file_url) return NextResponse.json({ error: 'This product has no file uploaded yet' }, { status: 400 });

    const pdfRes = await fetch(product.file_url);
    if (!pdfRes.ok) return NextResponse.json({ error: `Could not download the PDF (${pdfRes.status})` }, { status: 422 });
    const pdfBytes = await pdfRes.arrayBuffer();

    const { images, skipped } = await extractImagesFromPdf(Buffer.from(pdfBytes));

    const saved = [];
    for (const img of images) {
      try {
        const path = `${userId}/extracted/${params.productId}/${Date.now()}-p${img.pageNumber}-${img.index}.${img.ext}`;
        const { error: uploadError } = await admin.storage.from('design-assets').upload(path, img.buffer, {
          contentType: img.ext === 'jpg' ? 'image/jpeg' : img.ext === 'png' ? 'image/png' : 'image/jp2',
          upsert: true,
        });
        if (uploadError) throw uploadError;
        const { data: urlData } = admin.storage.from('design-assets').getPublicUrl(path);

        // Auto-save directly into the Parts Library -- extraction's whole
        // point is "keep it as an isolated item to reuse," so this doesn't
        // wait for a separate star/save click.
        const title = `${product.title} -- page ${img.pageNumber} image ${img.index + 1}`;
        await admin.from('library_parts').insert({
          user_id: userId, kind: 'image',
          source_id: `${params.productId}:p${img.pageNumber}:${img.index}`,
          source_product_id: params.productId,
          title, category: 'extracted_image', file_url: urlData.publicUrl,
        });

        saved.push({ url: urlData.publicUrl, pageNumber: img.pageNumber, width: img.width, height: img.height });
      } catch (e) {
        skipped.push({ label: `page ${img.pageNumber}, image ${img.index + 1}`, reason: `upload/save failed: ${errorMessage(e)}` });
      }
    }

    return NextResponse.json({ images: saved, skipped, productTitle: product.title });
  } catch (e) {
    const message = errorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
