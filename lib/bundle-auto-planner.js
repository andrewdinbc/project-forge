// lib/bundle-auto-planner.js
//
// Bundle Auto-Planner (2026-07-20): Layer A of the curriculum-driven
// year-bundle generation feature. Spec: docs/CURRICULUM_BUNDLE_GENERATION_SPEC.md
//
// Takes a teacher's unit list (subject/grade/topic per unit -- the shape
// Unit Priorities in lesson-planner already produces) and turns it into a
// flat list of generator jobs: which of the 30 catalog generators to run,
// with what params, and in what order when one generator's output feeds
// another (e.g. Spelling List's word list feeding Word Search).
//
// V1 only plans the "vocab chain" the app's own UI already describes
// (lib/worksheet-generator-catalog.js spelling-list entry: "Send it
// straight into a Spelling Test, Word Search, Word Scramble, ABC Order,
// Flashcards, or Missing Letters worksheet") plus Reading Passage for ELA
// and the Math generator for math units. Deliberately NOT wiring
// Crossword into the auto-chain yet: it needs {word, clue} pairs
// (WordClue[]), not a bare word list, and Spelling List only produces
// words -- chaining it in today would silently produce jobs that always
// fail. Same reasoning kept Quiz out (needs pre-written question content,
// not just a topic). Both are real next steps, not oversights -- noted in
// the spec doc rather than guessed at here.
//
// Hard rule: only ever plan a generator whose catalog status is 'live'.
// Planning a 'planned'-status generator would create a job that fails
// forever with no code behind it -- a durable guard, not a preference.

import { GENERATOR_CATALOG } from './worksheet-generator-catalog';
import { CURRICULUM_ELABORATIONS } from './curriculum-full-elaborations';

const CATALOG_BY_KEY = {};
for (const group of GENERATOR_CATALOG) {
  for (const tool of group.tools) CATALOG_BY_KEY[tool.key] = tool;
}

function isLive(key) {
  return CATALOG_BY_KEY[key]?.status === 'live';
}

// Subjects where a vocabulary/term-list chain (spelling list -> word
// search/flashcards/missing-letters) is the natural resource type.
// Matches the exact subject-name strings used as top-level keys in
// CURRICULUM_ELABORATIONS so lookups below just work.
const VOCAB_HEAVY_SUBJECTS = new Set([
  'English Language Arts',
  'Science',
  'Social Studies',
  'French',
  'Applied Design, Skills, and Technologies',
  'Arts Education',
  'Health & Career Education',
  'Physical Education',
]);

function normalizeGrade(grade) {
  const g = String(grade ?? '').trim().toUpperCase();
  return g === 'K' ? 'K' : String(parseInt(g, 10) || g);
}

function getCurriculumContent(subject, grade) {
  const bySubject = CURRICULUM_ELABORATIONS[subject];
  if (!bySubject) return null;
  return bySubject[normalizeGrade(grade)] || null;
}

// Rough grade -> op/mode default for the Math generator. This is a
// starting default, not a curriculum-accurate math-strand mapping --
// flagged in the spec doc as worth a real per-grade table once someone
// (Aj) confirms the BC math curriculum's actual strand-by-grade sequence.
function defaultMathParamsForGrade(grade) {
  const g = parseInt(grade, 10);
  if (Number.isNaN(g) || g <= 1) return { op: 'addition', mode: 'basic' };
  if (g === 2) return { op: 'subtraction', mode: 'basic' };
  if (g === 3) return { op: 'multiplication', mode: 'basic' };
  if (g === 4) return { op: 'division', mode: 'basic' };
  if (g <= 6) return { op: 'multiplication', mode: 'advanced' };
  return { op: 'division', mode: 'advanced' };
}

/**
 * Build a generation plan for one unit.
 * @param {object} unit - { subject, grade, topic, unitLabel }
 * @returns {Array<{ chainKey: string, generatorKey: string, dependsOn?: string, params: object }>}
 *   dependsOn (when present) is a `${chainKey}:${generatorKey}` ref to
 *   another job returned in this same array -- resolved to a real job id
 *   by the caller (app/api/bundles/auto-generate/plan/route.ts) after insert.
 */
export function planUnitResources(unit) {
  const { subject, grade, topic, unitLabel } = unit || {};
  const jobs = [];
  const content = getCurriculumContent(subject, grade);
  // Prefer the teacher's own topic; fall back to a real curriculum Content
  // line so an auto-generated bundle is always grounded in something real
  // for this subject/grade, never a generic guess.
  const seedTopic = (topic || '').trim() || content?.content?.[0] || (subject ? `${subject} — Grade ${grade}` : `Grade ${grade}`);
  const label = unitLabel || seedTopic;

  const wantsVocabChain = subject ? VOCAB_HEAVY_SUBJECTS.has(subject) : true;
  const wantsMath = /math/i.test(subject || '');
  const wantsReading = subject === 'English Language Arts';

  if (wantsVocabChain && isLive('spelling-list')) {
    jobs.push({
      chainKey: 'vocab',
      generatorKey: 'spelling-list',
      params: { grade, topic: seedTopic, title: `${label} — Vocabulary List` },
    });
    if (isLive('word-search')) {
      jobs.push({
        chainKey: 'vocab', generatorKey: 'word-search', dependsOn: 'vocab:spelling-list',
        params: { title: `${label} — Word Search`, difficulty: 'intermediate' },
      });
    }
    if (isLive('flashcards')) {
      jobs.push({
        chainKey: 'vocab', generatorKey: 'flashcards', dependsOn: 'vocab:spelling-list',
        params: { title: `${label} — Flashcards` },
      });
    }
    if (isLive('missing-letters')) {
      jobs.push({
        chainKey: 'vocab', generatorKey: 'missing-letters', dependsOn: 'vocab:spelling-list',
        params: { title: `${label} — Missing Letters` },
      });
    }
  }

  // reading-passage needs a numeric gradeLevel -- skip for Kindergarten
  // (route rejects non-numeric grades) rather than send a job we know
  // will fail.
  const numericGrade = parseInt(normalizeGrade(grade), 10);
  if (wantsReading && !Number.isNaN(numericGrade) && isLive('reading-passage')) {
    jobs.push({
      chainKey: 'reading',
      generatorKey: 'reading-passage',
      params: { topic: seedTopic, gradeLevel: numericGrade, mode: 'single', title: `${label} — Reading Passage` },
    });
  }

  if (wantsMath && isLive('math')) {
    const { op, mode } = defaultMathParamsForGrade(grade);
    jobs.push({
      chainKey: 'math',
      generatorKey: 'math',
      params: { op, mode, title: `${label} — Math Practice` },
    });
  }

  return jobs;
}

/**
 * Build a full year's plan across many units, with chain/depends-on refs
 * disambiguated per-unit (so two units both using the vocab chain don't
 * collide on the same 'vocab:spelling-list' ref).
 * @param {Array<object>} units - each { subject, grade, topic, unitLabel }
 */
export function planYearResources(units) {
  return (units || []).flatMap((u, idx) =>
    planUnitResources(u).map((j) => ({
      ...j,
      subject: u.subject || null,
      grade: u.grade != null ? String(u.grade) : null,
      unitLabel: u.unitLabel || null,
      chainKey: `${idx}:${j.chainKey}`,
      dependsOn: j.dependsOn ? `${idx}:${j.dependsOn}` : null,
    }))
  );
}
