import { NextRequest, NextResponse } from 'next/server';
import { getProduct, updateProduct } from '@/lib/products';
import { pushToSteering } from '@/lib/style-lab';
import { extractPdfText } from '@/lib/pdf-extract';
import { cleanForSteering } from '@/lib/steering-cleanup';
import { errorMessage } from '@/lib/error-message';
import { supabaseAdmin } from '@/lib/supabase';

// 2026-07-20: this route was missed in the 2026-07-19 systemic RLS fix
// (see app/api/products/route.ts) -- it's a server route with no browser
// session, so calling getProduct/updateProduct without the admin client
// meant auth.uid() was always null and RLS silently returned nothing,
// making every push-to-steering attempt 404 with "Product not found" even
// for the caller's own real product. Found while tracing the bundles RLS
// report; same category of bug, same fix.
const admin: any = supabaseAdmin;

// Push to AI Steering, moved here from Style Lab (Aj, 2026-07-19): "I want
// nothing going directly into AI steering. Instead I want my products I
// have made go into AI steering." Style Lab's resource-level and style-
// profile push actions were removed entirely (see app/api/style-lab/
// resources -- push_to_steering now returns 410). This is the only
// remaining way to add something to AI Steering, and it only ever reads
// from a product Aj actually authored and published, on his own Dashboard.
//
// POST { userId, productId }
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { userId, productId } = (await request.json()) || {};
    if (!userId || !productId) {
      return NextResponse.json({ error: 'userId and productId are required' }, { status: 400 });
    }

    const product = await getProduct(productId, userId, admin);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (!product.file_url) return NextResponse.json({ error: 'This product has no file uploaded yet' }, { status: 400 });

    const pdfRes = await fetch(product.file_url);
    if (!pdfRes.ok) return NextResponse.json({ error: `Could not download the product file (${pdfRes.status})` }, { status: 422 });
    const buffer = Buffer.from(await pdfRes.arrayBuffer());
    const extracted = await extractPdfText(buffer);
    if (!extracted.text.trim()) {
      return NextResponse.json({ error: 'No extractable text found in this product\'s file' }, { status: 400 });
    }

    let text = extracted.text;
    try {
      text = await cleanForSteering(extracted.text, product.title);
    } catch (e) {
      console.error('AI cleanup before steering push failed, pushing original text:', errorMessage(e));
    }

    const doc = await pushToSteering(userId, {
      title: product.title,
      full_text: text,
      category: 'my_products',
      source_type: 'upload',
      char_count: text.length,
    });
    const updated = await updateProduct(productId, userId, { pushed_to_steering_doc_id: doc.id }, admin);

    return NextResponse.json({ ok: true, steering_doc_id: doc.id, product: updated });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
