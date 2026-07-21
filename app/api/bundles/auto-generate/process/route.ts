import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createProduct } from '@/lib/products';
import { addProductToBundle } from '@/lib/bundles';
import { GENERATOR_ROUTES, isOrchestratable } from '@/lib/bundle-generator-routes';
import { errorMessage } from '@/lib/error-message';

// POST /api/bundles/auto-generate/process
//
// Layer B (2026-07-20): works through a bundle's pending
// bundle_generation_jobs in small batches, calling the real generator
// route for each, turning its output into a Product, and linking it into
// the bundle. Deliberately NOT one giant loop over the whole year in a
// single request -- individual generators can take up to 180s each
// (reading-passage), so this processes jobs until it's used most of its
// own time budget, then returns with an accurate progress count. The
// caller (the auto-generate dashboard page) polls this repeatedly until
// `pending + running === 0`. This mirrors Hyperion's own task-queue
// pattern on purpose: same "a single failed job skips to the next ready
// job, never aborts the whole run" rule Aj already requires there.
//
// Stale-'running'-job reset: if a previous invocation was killed mid-job
// (e.g. hit the platform's hard timeout), that job would otherwise sit at
// status='running' forever with nothing to pick it back up -- this is the
// exact bug class already found and fixed once in Hyperion's own queue
// (tasks stuck in "running" with no reset). Guarding against it here too
// rather than waiting to rediscover it.

export const maxDuration = 280;
const SOFT_DEADLINE_MS = 240_000; // leave headroom under maxDuration to return cleanly
const STALE_RUNNING_MINUTES = 10;

const admin: any = supabaseAdmin;

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const { userId, bundleId, batchSize = 3 } = (await request.json()) || {};
    if (!userId || !bundleId) return NextResponse.json({ error: 'userId and bundleId are required' }, { status: 400 });

    // Reset any job stuck 'running' past the staleness window before doing
    // anything else, so a prior killed invocation can't wedge this bundle.
    const staleCutoff = new Date(Date.now() - STALE_RUNNING_MINUTES * 60_000).toISOString();
    await admin
      .from('bundle_generation_jobs')
      .update({ status: 'pending' })
      .eq('bundle_id', bundleId)
      .eq('status', 'running')
      .lt('updated_at', staleCutoff);

    const { data: allJobs, error: fetchErr } = await admin
      .from('bundle_generation_jobs')
      .select('*')
      .eq('bundle_id', bundleId)
      .order('sort_order', { ascending: true });
    if (fetchErr) throw fetchErr;
    if (!allJobs?.length) return NextResponse.json({ error: 'No jobs found for this bundle' }, { status: 404 });

    const byId: Record<string, any> = {};
    allJobs.forEach((j: any) => { byId[j.id] = j; });

    // Cascade: a job whose dependency failed/was skipped can never run --
    // mark it skipped now rather than leaving it pending forever.
    for (const job of allJobs) {
      if (job.status !== 'pending' || !job.depends_on_job_id) continue;
      const dep = byId[job.depends_on_job_id];
      if (dep && (dep.status === 'failed' || dep.status === 'skipped')) {
        await admin.from('bundle_generation_jobs').update({ status: 'skipped', error: 'Dependency did not complete', updated_at: new Date() }).eq('id', job.id);
        job.status = 'skipped';
      }
    }

    const isReady = (job: any) => job.status === 'pending' && (!job.depends_on_job_id || byId[job.depends_on_job_id]?.status === 'done');
    const origin = request.nextUrl.origin;

    let processedCount = 0;
    for (const job of allJobs) {
      if (Date.now() - startedAt > SOFT_DEADLINE_MS) break;
      if (processedCount >= batchSize) break;
      if (!isReady(job)) continue;

      processedCount++;
      await admin.from('bundle_generation_jobs').update({ status: 'running', updated_at: new Date() }).eq('id', job.id);

      try {
        if (!isOrchestratable(job.generator_key)) {
          throw new Error(`No route mapping for generator "${job.generator_key}" -- not yet wired into the auto-generator`);
        }
        const route = GENERATOR_ROUTES[job.generator_key as keyof typeof GENERATOR_ROUTES];

        let dependencyWordList: string[] | undefined;
        if (job.depends_on_job_id) {
          const dep = byId[job.depends_on_job_id];
          dependencyWordList = dep?.params?.resultWordList;
          if (!dependencyWordList?.length) throw new Error('Dependency job has no word list to use');
        }

        const body = route.buildBody(job, { userId, bundleId, dependencyWordList });
        const res = await fetch(`${origin}${route.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          let msg = `Generator returned ${res.status}`;
          try { const errJson = await res.json(); msg = errJson?.error || msg; } catch { /* not JSON, keep default */ }
          throw new Error(msg);
        }

        const fileUrlHeader = res.headers.get('X-File-Url');
        const fileUrl = fileUrlHeader ? decodeURIComponent(fileUrlHeader) : null;
        const wordListHeader = res.headers.get('X-Word-List');
        const resultWordList = wordListHeader ? decodeURIComponent(wordListHeader).split(',').filter(Boolean) : undefined;
        // Drain the body (PDF bytes) even though we don't store it here --
        // uploadWorksheetPdf already persisted it, this response body is
        // just the same bytes streamed back for a direct download.
        await res.arrayBuffer();

        const product = await createProduct(userId, {
          title: job.params?.title || `${job.generator_key} — ${job.unit_label || job.subject || 'Resource'}`,
          resource_type: job.generator_key,
          grade_level: job.grade ? [job.grade] : [],
          subject: job.subject || null,
          price_usd: 0,
          file_url: fileUrl,
          status: 'draft', // stays draft until reviewed -- no storefront/copyright gate wired yet, see spec doc
        }, admin);
        await addProductToBundle(bundleId, product.id, userId);

        const updatedParams = resultWordList ? { ...(job.params || {}), resultWordList } : job.params;
        await admin.from('bundle_generation_jobs').update({
          status: 'done', product_id: product.id, params: updatedParams, error: null, updated_at: new Date(),
        }).eq('id', job.id);
        byId[job.id] = { ...job, status: 'done', params: updatedParams };
      } catch (jobErr) {
        await admin.from('bundle_generation_jobs').update({
          status: 'failed', error: errorMessage(jobErr), updated_at: new Date(),
        }).eq('id', job.id);
        byId[job.id] = { ...job, status: 'failed' };
        // Deliberately no throw/break here -- one job failing must never
        // stop the rest of the batch or the rest of the run.
      }
    }

    const { data: finalJobs } = await admin.from('bundle_generation_jobs').select('status').eq('bundle_id', bundleId);
    const counts = { pending: 0, running: 0, done: 0, failed: 0, skipped: 0 };
    (finalJobs || []).forEach((j: any) => { counts[j.status as keyof typeof counts] = (counts[j.status as keyof typeof counts] || 0) + 1; });

    return NextResponse.json({ processedThisCall: processedCount, counts, total: finalJobs?.length || 0 });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
