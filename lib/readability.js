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
