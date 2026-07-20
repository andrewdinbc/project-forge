import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { errorMessage } from '@/lib/error-message';
import { runFluxKontext } from '@/lib/flux-kontext';

const admin: any = supabaseAdmin;

// Bulk edit for Needs Review (Aj, 2026-07-20): "make a component at the
// Parts library where I can request changes and additions to different
// parts in the needs review section so we can modify them in bulk...
// picking up on the patterns I work through, remembering them and
// replicating the same level of modification."
//
// One instruction, applied to N selected pending-review parts via the
// same FLUX Kontext edit already used for single-item Asset Modifier
// edits (lib/flux-kontext.ts) -- not a different, weaker bulk mechanism.
// Each successfully edited part is promoted out of Needs Review exactly
// like a single manual edit-and-save: a new non-pending library_parts
// row is created, the original pending row is deleted. One part failing
// (e.g. a bad image URL) does not abort the rest of the batch.
//
// Every call also upserts into edit_patterns (category + instruction),
// incrementing times_used on a repeat -- the data source the
// pattern-suggestions endpoint reads from to surface "you usually do
// this" back to Aj on future batches.
export const maxDuration = 280;

export async function POST(request: NextRequest) {
  try {
    const { userId, partIds, instruction } = (await request.json()) || {};
    if (!userId || !Array.isArray(partIds) || partIds.length === 0 || !instruction || !String(instruction).trim()) {
      return NextResponse.json({ error: 'userId, a non-empty partIds array, and instruction are required' }, { status: 400 });
    }
    const trimmedInstruction = String(instruction).trim();

    const { data: parts, error: fetchErr } = await admin
      .from('library_parts')
      .select('id, title, category, file_url, notes')
      .in('id', partIds)
      .eq('user_id', userId)
      .eq('pending_review', true);
    if (fetchErr) throw new Error(fetchErr.message);
    if (!parts || parts.length === 0) {
      return NextResponse.json({ error: 'None of the selected parts were found in Needs Review for this user.' }, { status: 404 });
    }

    const results: { id: string; title: string; ok: boolean; newPartId?: string; error?: string }[] = [];
    const categoriesTouched = new Set<string>();

    for (const part of parts) {
      try {
        if (!part.file_url) throw new Error('No source image on this part.');
        const resultUrl = await runFluxKontext(part.file_url, trimmedInstruction);

        const resultRes = await fetch(resultUrl);
        const resultBuf = Buffer.from(await resultRes.arrayBuffer());
        const outPath = `${userId}/needs-review-bulk-edit/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
        const { error: outErr } = await admin.storage.from('design-assets').upload(outPath, resultBuf, { contentType: 'image/png', upsert: true });
        if (outErr) throw new Error(`Result upload failed: ${outErr.message}`);
        const { data: outUrlData } = admin.storage.from('design-assets').getPublicUrl(outPath);

        const { data: inserted, error: insErr } = await admin
          .from('library_parts')
          .insert({
            user_id: userId,
            kind: 'image',
            source_id: `bulk-edit:${part.id}:${Date.now()}`,
            title: part.title || 'Modified asset',
            category: part.category,
            notes: `Bulk-edited from Needs Review: "${trimmedInstruction}"`,
            file_url: outUrlData.publicUrl,
            pending_review: false,
          })
          .select('id')
          .single();
        if (insErr) throw new Error(insErr.message);

        // Un-pend (delete the original) only after the edited replacement
        // is safely saved -- never leave a part in neither state if the
        // insert above had failed.
        await admin.from('library_parts').delete().eq('id', part.id).eq('user_id', userId);

        if (part.category) categoriesTouched.add(part.category);
        results.push({ id: part.id, title: part.title, ok: true, newPartId: inserted.id });
      } catch (e) {
        results.push({ id: part.id, title: part.title, ok: false, error: errorMessage(e) });
      }
    }

    // Log/refresh the pattern for every category actually touched by a
    // successful edit in this batch -- one row per (user, category,
    // instruction) combination, incrementing on repeat rather than
    // growing unboundedly for the same instruction reused many times.
    for (const category of Array.from(categoriesTouched)) {
      const { data: existingPattern } = await admin
        .from('edit_patterns')
        .select('id, times_used')
        .eq('user_id', userId)
        .eq('category', category)
        .eq('instruction', trimmedInstruction)
        .maybeSingle();
      if (existingPattern) {
        await admin
          .from('edit_patterns')
          .update({ times_used: existingPattern.times_used + 1, last_used_at: new Date().toISOString() })
          .eq('id', existingPattern.id);
      } else {
        await admin.from('edit_patterns').insert({ user_id: userId, category, instruction: trimmedInstruction });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    return NextResponse.json({ ok: true, succeeded, failed: results.length - succeeded, results });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
