import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';

const admin: any = supabaseAdmin;

// Copyright Auditor (Aj, 2026-07-20): "design a Copyright Auditor that will
// stop it moving out of Needs Review until it meets criteria."
//
// Deliberately built on PROVENANCE, not similarity-to-source. Whether an
// edited image is "different enough" from a copyrighted original to no
// longer be an infringing derivative work is a legal judgment (how much of
// the original's protected expression survives, market effect, etc.) --
// not something a script can score and certify. An automated "87% unique,
// approved" verdict would be false confidence, not a real safeguard.
//
// What CAN be verified as fact: does every item in the real Parts Library
// (pending_review=false) have a known, honest source_type, and if it's
// external_license, does it carry real license info -- and if that license
// requires credit, is the credit text actually saved? That's the gate this
// route checks. Rows failing it aren't proof of infringement, just proof
// the paperwork is missing -- which is itself worth surfacing before
// something ships in a paid product.
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    const { data: rows, error } = await admin
      .from('library_parts')
      .select('id, title, category, source_type, license_name, requires_attribution, attribution_text, pending_review, created_at')
      .eq('user_id', userId)
      .eq('pending_review', false);
    if (error) throw new Error(error.message);

    const issues: any[] = [];
    for (const r of rows || []) {
      if (!r.source_type) {
        issues.push({ id: r.id, title: r.title, category: r.category, problem: 'No provenance recorded at all -- unknown where this asset came from.' });
        continue;
      }
      if (r.source_type === 'external_license') {
        if (!r.license_name) {
          issues.push({ id: r.id, title: r.title, category: r.category, problem: 'Marked as externally-licensed but no license name saved.' });
        }
        if (r.requires_attribution && !r.attribution_text) {
          issues.push({ id: r.id, title: r.title, category: r.category, problem: 'License requires attribution but no attribution text is saved -- credit is owed and not on file.' });
        }
      }
      if (r.source_type === 'uploaded_extraction') {
        issues.push({ id: r.id, title: r.title, category: r.category, problem: 'Extracted pixels from a third-party PDF landed in the real Parts Library without going through Needs Review -- this should not be possible; flag for investigation.' });
      }
    }

    const bySourceType: Record<string, number> = {};
    for (const r of rows || []) {
      const k = r.source_type || 'unknown';
      bySourceType[k] = (bySourceType[k] || 0) + 1;
    }

    return NextResponse.json({
      ok: true,
      totalLibraryItems: (rows || []).length,
      bySourceType,
      clean: issues.length === 0,
      issueCount: issues.length,
      issues,
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
