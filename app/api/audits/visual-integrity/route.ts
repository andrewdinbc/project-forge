import { NextRequest, NextResponse } from 'next/server';
import { auditCategory, auditLibraryPart } from '@/lib/visual-integrity-auditor';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

// Visual Integrity Auditor endpoint (Aj, 2026-07-24). Design doc:
// docs/visual-integrity-auditor-design.txt.
//
// POST { userId, mode: 'category' | 'part', category?, partId? }
//   mode 'category' -- sweeps every image in the given library_parts
//     category, running Check A (colorspace) and Check B (format,
//     auto-fixed). Use this for on-demand audits and the future
//     scheduled cron sweep.
//   mode 'part' -- audits a single library_parts row by id.
export const maxDuration = 280;

export async function POST(request: NextRequest) {
  try {
    const { userId, mode, category, partId } = (await request.json()) || {};
    if (!userId || !mode) {
      return NextResponse.json({ error: 'userId and mode are required' }, { status: 400 });
    }

    if (mode === 'category') {
      if (!category) return NextResponse.json({ error: 'category is required for mode "category"' }, { status: 400 });
      const result = await auditCategory(userId, category);
      return NextResponse.json({ ok: true, ...result });
    }

    if (mode === 'part') {
      if (!partId) return NextResponse.json({ error: 'partId is required for mode "part"' }, { status: 400 });
      const { data: row, error } = await admin
        .from('library_parts')
        .select('id, user_id, file_url, title')
        .eq('id', partId)
        .eq('user_id', userId)
        .single();
      if (error || !row) return NextResponse.json({ error: 'library_parts row not found' }, { status: 404 });
      const result = await auditLibraryPart(row);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: 'mode must be "category" or "part"' }, { status: 400 });
  } catch (e) {
    const message = errorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET ?userId=...&resolved=false -- list open findings, for a future
// dashboard / CEO-review-queue integration.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const resolvedParam = searchParams.get('resolved');
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    let query = admin.from('visual_audit_findings').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (resolvedParam !== null) query = query.eq('resolved', resolvedParam === 'true');

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ findings: data || [] });
  } catch (e) {
    const message = errorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
