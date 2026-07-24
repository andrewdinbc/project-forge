// Lightweight Flesch-Kincaid Grade Level calculator, no external
// dependencies (Aj, 2026-07-20 -- built specifically because the
// Differentiated Reading Passage schema (#5) had a logged, confirmed bug:
// the AI's own claimed Lexile numbers weren't reliable ("generated
// 420L-520L for a grade band the Lexile table puts at 600-800L" --
// structure and rendering worked, but the arithmetic didn't). Rather than
// trust the model's self-reported grade level again, every generated
// passage in the Reading Passage Generator is independently scored with
// this and the ACTUAL computed grade is shown next to the target, so a
// mismatch is visible and actionable instead of silently wrong.
//
// Standard algorithm: 0.39*(words/sentences) + 11.8*(syllables/words) - 15.59
// Syllable counting uses the common vowel-group heuristic (count vowel
// clusters, drop a trailing silent 'e', minimum 1 per word) -- not
// perfectly linguistically accurate, but the same approach used by most
// readability tools (e.g. Python's textstat, which is what the 100
// HELPS Curriculum reference passages in helps_reference_passages were
// scored with) and good enough for a "does this land near the target
// grade" sanity check.

function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  let stripped = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  stripped = stripped.replace(/^y/, '');
  const groups = stripped.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

// Grade-to-Lexile band lookup table (Aj, 2026-07-24 -- closing the
// numeric-grounding gap: this route is literally called "Reading Passage
// Generator (Lexile-Leveled)" and its schema promises a Lexile number, but
// fleschKincaidGrade() only ever produced a Flesch-Kincaid GRADE LEVEL --
// a different scale entirely -- and the route just displayed that grade
// float next to a Lexile-labeled target with no conversion. A teacher
// asking for a "600L-800L" passage had no way to know if a computed grade
// of 4.1 actually lands in that band. Midpoints below are the published
// MetaMetrics/Common Core grade-band Lexile ranges; values are interpolated
// linearly between grade-midpoints for fractional grades, then clamped to
// the table's ends for out-of-range input rather than extrapolating wildly.
const LEXILE_GRADE_TABLE = [
  { grade: 1, min: 190, max: 530 },
  { grade: 2, min: 420, max: 650 },
  { grade: 3, min: 520, max: 820 },
  { grade: 4, min: 740, max: 940 },
  { grade: 5, min: 830, max: 1010 },
  { grade: 6, min: 925, max: 1070 },
  { grade: 7, min: 970, max: 1120 },
  { grade: 8, min: 1010, max: 1185 },
  { grade: 9.5, min: 1050, max: 1335 }, // published table bands 9-10 together
  { grade: 11.5, min: 1185, max: 1385 }, // published table bands 11-12 together
];

export function gradeToLexile(grade) {
  const g = Number(grade);
  if (!Number.isFinite(g)) return null;
  const table = LEXILE_GRADE_TABLE;
  const midpoint = (row) => (row.min + row.max) / 2;

  if (g <= table[0].grade) return Math.round(midpoint(table[0]));
  if (g >= table[table.length - 1].grade) return Math.round(midpoint(table[table.length - 1]));

  for (let i = 0; i < table.length - 1; i++) {
    const lo = table[i], hi = table[i + 1];
    if (g >= lo.grade && g <= hi.grade) {
      const t = (g - lo.grade) / (hi.grade - lo.grade);
      const lexile = midpoint(lo) + t * (midpoint(hi) - midpoint(lo));
      return Math.round(lexile / 10) * 10; // Lexile scores are reported in 10s
    }
  }
  return Math.round(midpoint(table[table.length - 1]));
}

export function fleschKincaidGrade(text) {
  const clean = String(text || '').trim();
  if (!clean) return { grade: 0, words: 0, sentences: 0, syllables: 0 };

  const words = (clean.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || []);
  const sentences = (clean.match(/[.!?]+(?:\s|$)/g) || []);
  const sentenceCount = Math.max(1, sentences.length);
  const wordCount = Math.max(1, words.length);
  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);

  const grade = 0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59;
  return {
    grade: Math.round(grade * 100) / 100,
    words: wordCount,
    sentences: sentenceCount,
    syllables: syllableCount,
  };
}
