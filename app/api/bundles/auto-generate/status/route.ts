import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

// GET /api/bundles/auto-generate/status?bundleId=...&userId=...
//
// Read-only progress check (2026-07-20) -- separate from /process so the
// dashboard page can poll for a progress bar without ever accidentally
// triggering more generation work as a side effect of just looking.

const admin: any = supabaseAdmin;

export async function GET(request: NextRequest) {
  try {
    const bundleId = request.nextUrl.searchParams.get('bundleId');
    const userId = request.nextUrl.searchParams.get('userId');
    if (!bundleId || !userId) return NextResponse.json({ error: 'bundleId and userId are required' }, { status: 400 });

    const { data: jobs, error } = await admin
      .from('bundle_generation_jobs')
      .select('id, unit_label, subject, grade, generator_key, status, error, product_id, sort_order')
      .eq('bundle_id', bundleId)
      .eq('user_id', userId)
      .order('sort_order', { ascending: true });
    if (error) throw error;

    const counts = { pending: 0, running: 0, done: 0, failed: 0, skipped: 0 };
    (jobs || []).forEach((j: any) => { counts[j.status as keyof typeof counts] = (counts[j.status as keyof typeof counts] || 0) + 1; });
    const complete = counts.pending === 0 && counts.running === 0;

    return NextResponse.json({ jobs: jobs || [], counts, total: jobs?.length || 0, complete });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
