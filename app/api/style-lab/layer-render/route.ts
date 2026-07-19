import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getPageCount, renderPageWithLayers } from '@/lib/pdf-layer-render';

const admin: any = supabaseAdmin;

// Renders one page of a Style Lab resource's PDF with visual "layers" stripped
// out, so a teacher can see the page without its text / clipart / borders —
// the Acrobat-style deconstruction Aj asked for (2026-07-19). Returns the PNG
// directly so the client can point an <img src> at it and just change the
// query string to toggle a layer.
//
// GET /api/style-lab/layer-render?userId=&resourceId=&page=1&scale=1.5&text=1&images=1&graphics=1
export const maxDuration = 60; // rasterizing a page can take a few seconds

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const resourceId = searchParams.get('resourceId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const scale = Math.min(3, Math.max(0.5, parseFloat(searchParams.get('scale') || '1.5')));
    // A layer is ON unless explicitly passed as 0/false.
    const on = (k: string) => searchParams.get(k) !== '0' && searchParams.get(k) !== 'false';
    const layers = { text: on('text'), images: on('images'), graphics: on('graphics') };

    if (!userId || !resourceId) {
      return NextResponse.json({ error: 'userId and resourceId are required' }, { status: 400 });
    }

    const { data: resource, error } = await admin
      .from('forge_resources')
      .select('file_url, source_type, user_id')
      .eq('id', resourceId)
      .eq('user_id', userId)
      .single();
    if (error || !resource) return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    if (!resource.file_url) return NextResponse.json({ error: 'This resource has no PDF file' }, { status: 400 });
    if (resource.source_type && resource.source_type !== 'pdf') {
      return NextResponse.json({ error: 'Visual layers are only available for PDF resources' }, { status: 400 });
    }

    const pdfRes = await fetch(resource.file_url);
    if (!pdfRes.ok) return NextResponse.json({ error: `Could not download the PDF (${pdfRes.status})` }, { status: 422 });
    const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());

    const pageCount = await getPageCount(pdfBytes);
    const safePage = Math.min(Math.max(1, page), pageCount);

    const png = await renderPageWithLayers(pdfBytes, safePage, layers, scale);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'X-Page-Count': String(pageCount),
        'X-Page': String(safePage),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
