import { NextRequest, NextResponse } from 'next/server';
import { getProduct } from '@/lib/products';
import { supabaseAdmin } from '@/lib/supabase';
import { getPdfPageCount, renderPdfPageToPng } from '@/lib/pdf-page-render';

const admin: any = supabaseAdmin;

// Renders a single page of a product's PDF to a PNG image, for the crop
// tool to display and let a teacher draw a selection box over. Returns
// the image directly (not JSON) so it can be used as an <img> src.
// GET /api/products/[productId]/render-page?userId=X&page=1&scale=1.5
export async function GET(request: NextRequest, { params }: { params: { productId: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const scale = parseFloat(searchParams.get('scale') || '1.5');
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    const product = await getProduct(params.productId, userId, admin);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (!product.file_url) return NextResponse.json({ error: 'This product has no file uploaded yet' }, { status: 400 });

    const pdfRes = await fetch(product.file_url);
    if (!pdfRes.ok) return NextResponse.json({ error: `Could not download the PDF (${pdfRes.status})` }, { status: 422 });
    const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());

    const pageCount = await getPdfPageCount(pdfBytes);
    if (page < 1 || page > pageCount) {
      return NextResponse.json({ error: `Page ${page} is out of range (this PDF has ${pageCount} pages)` }, { status: 400 });
    }

    const pngBuffer = await renderPdfPageToPng(pdfBytes, page, scale);
    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'X-Page-Count': String(pageCount),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
