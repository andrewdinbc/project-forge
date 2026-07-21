import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createBundle } from '@/lib/bundles';
import { planYearResources } from '@/lib/bundle-auto-planner';
import { errorMessage } from '@/lib/error-message';

// POST /api/bundles/auto-generate/plan
//
// Layer A+B entry point (2026-07-20). Takes a teacher's unit list, creates
// a draft bundle, and inserts one 'pending' bundle_generation_jobs row per
// planned generator call -- no generation happens here, this is just
// planning + fast DB writes, safe well within a normal request timeout.
// Actual generation happens via repeated calls to
// /api/bundles/auto-generate/process (see that route for why this is
// split in two). Spec: docs/CURRICULUM_BUNDLE_GENERATION_SPEC.md

const admin: any = supabaseAdmin;

export async function POST(request: NextRequest) {
  try {
    const { userId, title, gradeLevels, subjects, units } = (await request.json()) || {};
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    if (!Array.isArray(units) || !units.length) {
      return NextResponse.json(
        { error: 'units (array) is required -- one entry per unit/week you want resources for, e.g. { subject, grade, topic, unitLabel }' },
        { status: 400 }
      );
    }

    const bundle = await createBundle(userId, {
      title: title?.trim() || `${new Date().getFullYear()} Year Bundle`,
      description: `Auto-generated from ${units.length} curriculum unit(s).`,
      bundle_type: 'auto_generated',
      grade_levels: gradeLevels || Array.from(new Set(units.map((u: any) => String(u.grade)))),
      subjects: subjects || Array.from(new Set(units.map((u: any) => u.subject).filter(Boolean))),
      status: 'draft',
    }, admin);

    const plan = planYearResources(units);
    if (!plan.length) {
      return NextResponse.json(
        { error: 'No live generators matched these units -- nothing to plan. Check subject names match curriculum subject names.' },
        { status: 422 }
      );
    }

    const rows = plan.map((j: any, i: number) => ({
      user_id: userId,
      bundle_id: bundle.id,
      unit_label: j.unitLabel,
      subject: j.subject,
      grade: j.grade,
      generator_key: j.generatorKey,
      params: j.params || {},
      sort_order: i,
      status: 'pending',
    }));
    // Keep the chain/dependsOn refs alongside (not persisted) so we can
    // resolve depends_on_job_id to real ids in a second pass below.
    const refs = plan.map((j: any) => ({ chainRef: `${j.chainKey}:${j.generatorKey}`, dependsOnRef: j.dependsOn || null }));

    const { data: inserted, error: insertErr } = await admin
      .from('bundle_generation_jobs')
      .insert(rows)
      .select();
    if (insertErr) throw insertErr;

    const refToId: Record<string, string> = {};
    inserted.forEach((row: any, i: number) => { refToId[refs[i].chainRef] = row.id; });

    const dependencyUpdates = inserted
      .map((row: any, i: number) => ({ id: row.id, dependsOnRef: refs[i].dependsOnRef }))
      .filter((u: any) => u.dependsOnRef && refToId[u.dependsOnRef]);

    for (const u of dependencyUpdates) {
      const { error: depErr } = await admin
        .from('bundle_generation_jobs')
        .update({ depends_on_job_id: refToId[u.dependsOnRef] })
        .eq('id', u.id);
      if (depErr) throw depErr;
    }

    return NextResponse.json({ bundleId: bundle.id, jobCount: inserted.length });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
