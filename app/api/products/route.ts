import { NextRequest, NextResponse } from 'next/server';
import { getUserProducts, createProduct } from '@/lib/products';
import { supabaseAdmin } from '@/lib/supabase';

// Was a mock stub returning hardcoded fake course data, unconnected to the
// real `products` table -- fixed 2026-07-18. The Products list page itself
// never actually called this route (it uses lib/products.js directly,
// client-side), so this wasn't blocking the UI, but it's real API surface
// that should return real data rather than fixtures if anything else
// (external integrations, future server-side pages) ever calls it.
//
// 2026-07-19: also passes supabaseAdmin explicitly -- same root-cause RLS
// issue as the auto-tag route (server routes have no browser session, so
// the anon client's auth.uid() is always null here and RLS silently
// blocked every read/write). See lib/products.js for the shared fix.

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    const status = searchParams.get('status') || undefined;
    const products = await getUserProducts(userId, status ? { status } : {}, supabaseAdmin);
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, ...productData } = body;
    if (!userId || !productData.title) {
      return NextResponse.json({ error: 'userId and title are required' }, { status: 400 });
    }
    const product = await createProduct(userId, productData, supabaseAdmin);
    return NextResponse.json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
