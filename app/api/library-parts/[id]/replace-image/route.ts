import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/library-parts/[id]/replace-image
//
// Wholesale image replacement for an existing library part -- distinct
// from patch-image (which erases/shifts a small defect region within
// the SAME image). This is for the "the whole asset needs to be
// regenerated" case: body { userId, newFileUrl } swaps file_url after
// the caller has already generated the replacement (e.g. via
// /api/design-assets/generate) and uploaded it. Built 2026-07-22 to fix
// character-library color/background inconsistency Visual QA found --
// kept as a real, reusable capability rather than a one-off script,
// since "regenerate and swap in a library asset" will come up again.

const admin: any = supabaseAdmin;

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId, newFileUrl } = (await request.json()) || {};
    if (!userId || !newFileUrl) {
      return NextResponse.json({ error: 'userId and newFileUrl are required' }, { status: 400 });
    }

    const { data: existing, error: fetchErr } = await admin
      .from('library_parts')
      .select('id, file_url, user_id, source_id')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single();
    if (fetchErr || !existing) return NextResponse.json({ error: 'Library part not found' }, { status: 404 });

    const previousFileUrl = existing.file_url;

    const { error: updateErr } = await admin
      .from('library_parts')
      .update({ file_url: newFileUrl })
      .eq('id', params.id);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, id: params.id, sourceId: existing.source_id, previousFileUrl, newFileUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
