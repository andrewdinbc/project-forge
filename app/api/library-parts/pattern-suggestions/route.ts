import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const admin: any = supabaseAdmin;

// GET /api/library-parts/pattern-suggestions?userId=&category=
// Returns the top few instructions Aj has actually used before for this
// category, most-used first -- the "remembering and replicating" half of
// bulk edit. Deliberately a ranked list handed back to the UI to
// pre-fill/suggest, not an auto-applied action -- Aj still reviews and
// confirms every batch (same copyright-safety principle as pending_review
// itself: nothing skips his review just because a pattern matched).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const category = searchParams.get('category');
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    let query = admin
      .from('edit_patterns')
      .select('category, instruction, times_used, last_used_at')
      .eq('user_id', userId)
      .order('times_used', { ascending: false })
      .order('last_used_at', { ascending: false })
      .limit(5);
    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ patterns: data || [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
