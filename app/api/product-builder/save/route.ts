import { NextRequest, NextResponse } from 'next/server';
import { createProduct, updateProduct } from '@/lib/products';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

// Product Builder (Aj, 2026-07-19): saves the draft as it's being built --
// Title/Instructions/Learning Content(s) plus the 5 style-category picks
// from Parts Library. Reuses the existing `products` table (3 new columns,
// see migration product_builder_fields_on_products) rather than a new
// table, so a saved draft is just a product with status 'draft' like any
// other -- it shows up on the Dashboard/Products page too.
// POST { userId, productId?, title, instructionsText, learningContents, styleSelections }
export async function POST(request: NextRequest) {
  try {
    const { userId, productId, title, instructionsText, learningContents, styleSelections } = (await request.json()) || {};
    if (!userId || !title || !title.trim()) {
      return NextResponse.json({ error: 'userId and a title are required' }, { status: 400 });
    }
    const fields = {
      title: title.trim(),
      instructions_text: instructionsText ?? null,
      learning_contents: Array.isArray(learningContents) ? learningContents : [],
      style_selections: styleSelections && typeof styleSelections === 'object' ? styleSelections : {},
    };

    const product = productId
      ? await updateProduct(productId, userId, fields, supabaseAdmin)
      : await createProduct(userId, { ...fields, status: 'draft' }, supabaseAdmin);

    return NextResponse.json({ ok: true, product });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
