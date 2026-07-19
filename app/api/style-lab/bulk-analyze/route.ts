import { NextRequest, NextResponse } from 'next/server';
import { analyzeResourcePage } from '@/lib/style-lab-vision';

// Bulk auto-analyze (Aj, 2026-07-19): "AI will do the legwork in determining
// what is necessary... automate the process." Given a batch of Style Lab
// resources (e.g. after bulk-importing a stack of TPT + non-TPT PDFs), runs
// page-1 analysis on each one concurrently so "Push to Asset Modifier" /
// "Push to Font Modifier" are ready right on the resource card, without
// opening Visual layers and waiting on each one individually.
//
// Deliberately scoped to PAGE 1 of each resource, not every page of every
// resource -- that's the page most likely to carry the title/main art/
// dominant font, and keeps this bounded and fast for a real batch (a
// 20-resource, all-pages job could genuinely exceed serverless time limits).
// Deeper resources still get their other pages analyzed individually via
// the page selector once opened in Visual layers.
//
// POST { userId, resourceIds: string[] }
export const maxDuration = 280;

export async function POST(request: NextRequest) {
  try {
    const { userId, resourceIds } = (await request.json()) || {};
    if (!userId || !Array.isArray(resourceIds) || resourceIds.length === 0) {
      return NextResponse.json({ error: 'userId and at least one resourceId are required' }, { status: 400 });
    }
    const ids = resourceIds.slice(0, 25); // sane upper bound per call; re-run for more

    const results = await Promise.allSettled(
      ids.map((id: string) => analyzeResourcePage(userId, id, 1, false))
    );

    const items = results.map((r, i) => {
      if (r.status === 'fulfilled') {
        return { resourceId: ids[i], status: 'ok', cached: r.value.cached, analysis: r.value.analysis };
      }
      return { resourceId: ids[i], status: 'error', error: r.reason?.message || String(r.reason) };
    });

    const ok = items.filter((i) => i.status === 'ok').length;
    const errored = items.filter((i) => i.status === 'error').length;

    return NextResponse.json({ ok: true, requested: ids.length, analyzed: ok, errored, results: items });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
