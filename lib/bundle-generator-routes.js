// lib/bundle-generator-routes.js
//
// Batch Generation Orchestrator support (2026-07-20) -- Layer B half of
// docs/CURRICULUM_BUNDLE_GENERATION_SPEC.md. Every worksheet-generator API
// route follows the same response contract (PDF bytes + an X-File-Url
// header, see lib/worksheet-pdf.js's uploadWorksheetPdf), so the
// orchestrator can treat all of them generically -- what differs per
// generator is only the request path and how a job's params (plus, for
// chained jobs, the parent job's result) become that generator's request
// body. That per-generator mapping lives here, in one place, so adding a
// new generator to the auto-chain later means adding one entry, not
// touching the orchestrator route itself.

export const GENERATOR_ROUTES = {
  'spelling-list': {
    path: '/api/worksheet-generators/spelling-list',
    buildBody: (job, ctx) => ({
      userId: ctx.userId,
      bundleId: ctx.bundleId,
      grade: job.grade,
      topic: job.params?.topic,
      title: job.params?.title,
    }),
  },
  'word-search': {
    path: '/api/worksheet-generators/word-search',
    buildBody: (job, ctx) => ({
      userId: ctx.userId,
      bundleId: ctx.bundleId,
      words: (ctx.dependencyWordList || []).join('\n'),
      difficulty: job.params?.difficulty || 'intermediate',
      title: job.params?.title,
    }),
  },
  flashcards: {
    path: '/api/worksheet-generators/flashcards',
    buildBody: (job, ctx) => ({
      userId: ctx.userId,
      bundleId: ctx.bundleId,
      words: (ctx.dependencyWordList || []).join('\n'),
      title: job.params?.title,
    }),
  },
  'missing-letters': {
    path: '/api/worksheet-generators/missing-letters',
    buildBody: (job, ctx) => ({
      userId: ctx.userId,
      bundleId: ctx.bundleId,
      words: (ctx.dependencyWordList || []).join('\n'),
      title: job.params?.title,
    }),
  },
  'reading-passage': {
    path: '/api/worksheet-generators/reading-passage/generate',
    buildBody: (job, ctx) => ({
      userId: ctx.userId,
      topic: job.params?.topic,
      gradeLevel: job.params?.gradeLevel,
      mode: job.params?.mode || 'single',
      title: job.params?.title,
    }),
  },
  math: {
    path: '/api/worksheet-generators/math',
    buildBody: (job, ctx) => ({
      userId: ctx.userId,
      bundleId: ctx.bundleId,
      op: job.params?.op,
      mode: job.params?.mode,
      title: job.params?.title,
    }),
  },
};

export function isOrchestratable(generatorKey) {
  return Object.prototype.hasOwnProperty.call(GENERATOR_ROUTES, generatorKey);
}
