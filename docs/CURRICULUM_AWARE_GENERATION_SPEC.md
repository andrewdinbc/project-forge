# Curriculum-Aware Generation Pipeline — Spec (2026-07-21)

Spec only, nothing built yet, per Aj's explicit instruction. Triggered by
gaps found in the dinosaur test: the reading passage should have been
differentiated, math and ELA need genuinely different differentiation
logic, and Hidden Pictures wasn't actually dinosaur-themed (only its
background scene was — the hidden objects come from a fixed generic icon
library).

## Goal

Every generator that produces topic-based content should, before
generating:
1. Look up how the topic is actually covered in the end user's
   curriculum (province/state-dependent — BC is the first implementation,
   not the only one).
2. Refine that with Aj's own steering documents (philosophy, pedagogy,
   concrete techniques).
3. Generate content that's genuinely calibrated to grade + curricular
   relevance, with math and ELA differentiated by different mechanisms.
4. Surface real, verified supplementary resources (links, videos,
   teacher resources) alongside the generated content.

## Finding 0: a live bug this spec surfaces, unrelated to anything new

`lib/steering-context.js` (lesson-planner) — the function every steering
consumer calls, including the existing cross-app endpoint math-mastery's
remediation generator already uses — pulls **every** row in
`steering_documents` with **no quality filter** and no topic/subject
relevance filter. It was built to organize by category
(philosophy/psychology/actionable_resources) and dump it all into the
prompt.

Audited all 40 rows in the table before writing this spec (Aj's explicit
instruction). 21 of them are failed web scrapes — YouTube channel "About"
pages and JS-heavy sites that returned page-shell boilerplate, with the
scraper's own AI summary honestly saying "no substantive content" or
"could not be retrieved," but that honest failure got saved as a
steering document anyway. Clean signal: everything above ~2000 characters
is real; everything at or below is a failed scrape. 16 pre-existing
documents (July 12-16) and the newest 4 (2x BC Curriculum overview, 2x
Ted Ed) are genuinely good.

**This is being fixed regardless of what happens with the rest of this
spec** — right now, math-mastery's remediation feature (and anything
else that calls this endpoint) is getting 21 documents of "no
substantive content" noise mixed into its real steering material. Fix:
add a quality filter (char_count threshold + a manual `is_valid` flag
for edge cases) to `buildSteeringContext()`, and re-scrape or manually
replace the 21 broken entries with real content (YouTube channel scrapes
need actual video pages/transcripts or the YouTube Data API, not the
channel homepage).

## Stage 1: Curriculum Lookup (topic → curricular relevance)

**Not the BC Curriculum steering documents** — those are a framework
*overview* (philosophy, Big Ideas/Competencies/Content structure, Core
Competencies, assessment approach), not topic-searchable. Real source:
`lib/curriculum-full-elaborations.js` (Project Forge) — already
structured as `CURRICULUM_ELABORATIONS[subject][grade] = { bigIdeas,
content, elaborations }` for all 9 K-9 BC subject areas. This is
genuinely topic-searchable today.

New function needed: `findCurricularRelevance(topic, province)` —
searches `content` arrays and `elaborations[].term/.detail` text across
subjects/grades for the topic, returns matches ranked by relevance
(subject, grade, matched Big Idea/Content line). For "dinosaurs" this
would very likely surface Science's early-grade "living things" /
"biodiversity" Big Ideas, not just return nothing or a random guess.

**Province/state as a floating variable**: `findCurricularRelevance`
takes a `province` (or `state`) param and dispatches to a per-region
implementation. BC's is real and buildable now. Alberta/Ontario and any
US states need their own equivalent structured curriculum data before
they can plug in — until then, calling this for a non-BC region should
degrade honestly (no curriculum-relevance data available, generation
proceeds on grade level alone) rather than silently applying BC's
curriculum to an Alberta or Ontario end user.

## Stage 2: Steering Refinement

Reuse the existing `buildSteeringContext()` mechanism (already built,
already has a cross-app pull pattern via `STEERING_SYNC_SECRET`) —
**after** Stage 0's quality fix, and **extended** with topic/subject
filtering so a Math generator pulls Math-tagged + general
philosophy/psychology docs, not the full indiscriminate dump every
category currently gets regardless of relevance.

## Stage 3: Subject-Aware Differentiation

Math and ELA need different differentiation mechanisms — this was the
direct feedback. Proposed split:

- **ELA-type** (reading-passage, and any future long-form text
  generator): tiered by text complexity/lexile — this already exists as
  the reading-passage generator's real 3-tier `differentiated` mode
  (Support/On-Level/Challenge), just wasn't used in the dinosaur test.
  Extend the same tiering logic to any other prose-generating tool.
- **Math-type** (the 8 math operation/mode combos, math-riddle,
  math-crosswords, mystery-math-pictures, addition-squares, puzzle-match,
  kenken, sudoku): tiered by number range, operation complexity, and
  scaffolding (fewer steps shown vs. more), not by "reading level" — a
  structurally different parameter set. Needs its own tiering schema, not
  a reuse of the ELA one.
- **Mechanic-only puzzles** (sudoku, kenken, dot-to-dots, mystery-graph-art):
  these already have their own difficulty/size parameters (sudoku size,
  kenken difficulty) that serve the same role differentiation would —
  no new work needed here, just don't force curriculum-lookup onto
  generators that have no topic to look up.

## Stage 4: Resource Suggestions

Not built from the broken pre-scraped bank. Two real options, not
mutually exclusive:
- **Live web_search at generation time** — search for the specific topic
  + grade + "teacher resources" / "educational video" at the moment of
  generation, so results are current and topic-specific rather than a
  fixed channel list.
- **A properly-rebuilt curated bank** — if a fixed set of trusted
  channels/sites is still wanted for reliability, it needs real scraping
  (actual video pages or the YouTube Data API for channel video listings,
  not channel homepages) and a topic-matching layer on top, not a static
  per-subject list with no topic awareness at all.

Recommend starting with live search (faster to build, inherently
topic-specific, no stale/broken-scrape risk) and revisiting a curated
bank later only if search quality proves insufficient.

## Generator classification (30 distinct routes)

**Fully topic-driven, all 4 stages apply:**
reading-passage, spelling-list, text-puzzle (brain-teasers/analogies/
what-am-i), math-riddle, word-ladders, color-by-number,
mystery-math-pictures (math stage 3, not ELA), graphic-organizer

**Topic informs word/content list, which then feeds a mechanic-only
renderer** (curriculum lookup applies to the topic→word-list step, not
the rendering step): bingo, flashcards, word-search, word-scramble,
missing-letters, abc-order, spelling-test, crossword, hidden-pictures
(scene AND object-selection both need to become topic-aware — currently
only the AI-generated background scene can flex; the hidden objects
themselves are a fixed generic icon library with no dinosaur/topic
options, same root problem as Dot-to-Dots and Mystery Graph Art below)

**Mechanic-only, no topic applicable — explicitly out of scope for
Stages 1/2/4:**
sudoku, kenken, addition-squares, puzzle-match, math (pure drill),
math-crosswords, dot-to-dots, mystery-graph-art (both share one shape
library with no topic-expansion path — would need real per-topic shape
art, a separate and much larger undertaking, not a pipeline change)

**Literal-content required, topic doesn't map cleanly:**
cryptogram (needs an exact phrase), word-maze (needs an exact fact),
mystery-clues (hardcoded to `subject: 'number'` or `'state'` only, no
open-topic path without restructuring the generator itself), quiz
(teacher supplies the actual questions — curriculum lookup could inform
*suggested* questions, but the current contract takes finished content)

## Data/schema additions needed

- `steering_documents`: add a boolean quality flag (or rely purely on
  the char_count heuristic — needs a decision) so
  `buildSteeringContext()` can exclude broken entries automatically
  going forward, not just this one-time cleanup.
- New: a `province`/`state` param threaded through any generator route
  that adopts this pipeline, defaulting to BC until other regions have
  real curriculum data.
- No new table needed for Stage 1 — `curriculum-full-elaborations.js` is
  sufficient for BC; a future non-BC region would need its own
  equivalent file or table, decided when that becomes real work rather
  than speculative now.

## Open questions before building (need Aj's call)

1. Fix the Stage 0 bug (steering context quality filter) as a standalone
   fix now, independent of the rest of this pipeline? It's affecting
   production today regardless of pipeline timing.
2. Confirm the differentiation split above (ELA=lexile-tiered,
   Math=range/scaffolding-tiered) matches what "differentiate Math vs
   ELA" meant, or is there a different distinction intended?
3. Resource suggestions: live search vs. rebuilt curated bank (or both,
   phased) — confirm before either gets built.
4. Rollout order across the ~14 topic-relevant generators — one pilot
   first (reading-passage was the original suggestion), or several at
   once?
