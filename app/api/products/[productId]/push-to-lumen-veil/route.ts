import { NextRequest, NextResponse } from 'next/server';
import { getProduct, updateProduct } from '@/lib/products';
import { errorMessage } from '@/lib/error-message';
import { supabaseAdmin } from '@/lib/supabase';

// Approve & Push to Lumen Veil (Aj, 2026-07-24): "I want to be able to
// click on each finished item to view it, and from there approve and
// push to Lumen Veil." Mirrors push-to-steering exactly -- same admin-
// client RLS fix (server routes have no browser session, so the anon
// client's auth.uid() is always null here), same guard on file_url,
// same shape.
//
// Real design choice: this does NOT talk to Hyperion's Redis review
// queue directly. It calls the same public /api/ceo pipeline Lumen
// Veil's own "Run Competitive Research Now" button already calls --
// full routing, risk check, and (as of 2026-07-24) a Copywriting agent
// that can actually read the real attached PDF and ground the listing
// in it, rather than guessing. That's also what makes the resulting
// item show up in Lumen Veil's "Check Hyperion" panel automatically:
// marketable there requires real listing copy AND a real file, and
// this produces both in the same pipeline run Lumen Veil already knows
// how to read.
//
// POST { userId, productId }
const admin: any = supabaseAdmin;
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { userId, productId } = (await request.json()) || {};
    if (!userId || !productId) {
      return NextResponse.json({ error: 'userId and productId are required' }, { status: 400 });
    }

    const product = await getProduct(productId, userId, admin);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (!product.file_url) return NextResponse.json({ error: 'This product has no file uploaded yet' }, { status: 400 });

    const context = [
      `Write a TPT listing (title, description, tags) for this product, ready to publish. Here is the actual product file: ${product.file_url}`,
      `Working title: ${product.title}`,
      product.description ? `Current description/notes: ${product.description}` : null,
      product.resource_type ? `Resource type: ${product.resource_type}` : null,
      product.subject ? `Subject: ${product.subject}` : null,
      Array.isArray(product.grade_level) && product.grade_level.length ? `Grade level: ${product.grade_level.join(', ')}` : null,
      typeof product.price_usd === 'number' && product.price_usd > 0 ? `Current price on record: $${product.price_usd}` : null,
    ].filter(Boolean).join('\n');

    const res = await fetch('https://morpheus-scheduler.vercel.app/api/ceo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: context }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: data.error || `Hyperion returned ${res.status}` }, { status: 502 });
    }
    if (data.needsClarification) {
      return NextResponse.json({ error: `Hyperion needs more detail: ${data.clarifyingQuestion}` }, { status: 422 });
    }
    if (data.needsRiskApproval) {
      return NextResponse.json({ error: `Flagged as ${data.riskLevel} risk before it would run -- review in Hyperion directly: ${data.riskReasoning}` }, { status: 422 });
    }
    if (!data.reviewId) {
      // Same honesty rule as Lumen Veil's own revise flow: don't claim
      // success if nothing was actually queued for review.
      return NextResponse.json({
        error: `Ran, but produced no real deliverable to queue (${data.reviewNote || 'text-only output'}).`,
        output: data.output || data.finalOutput || null,
      }, { status: 422 });
    }

    const updated = await updateProduct(
      productId,
      userId,
      { pushed_to_lumen_veil_review_id: data.reviewId, pushed_to_lumen_veil_at: new Date().toISOString() },
      admin
    );

    return NextResponse.json({ ok: true, reviewId: data.reviewId, output: data.output || data.finalOutput, product: updated });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
