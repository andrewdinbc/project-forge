// Worksheet Generators (Aj, 2026-07-19): the Super Teacher Worksheets-style
// generator catalog, attached to Bundle Generator -- every generator here
// can save its output as a Finished Product, which is exactly what Bundle
// Builder assembles bundles from.
//
// 'status: planned' = not built yet, listed honestly rather than silently
// omitted. Crossword Puzzle (2026-07-20) is no longer one of those --
// it was flagged for a long time as "a genuinely different scale of
// problem" needing a real word-intersection layout, not a word list laid
// into a grid, and now has exactly that: greedy placement with
// intersection scoring, validated in code (see
// app/api/worksheet-generators/crossword/route.ts), tested against a
// real word set before shipping.
export const GENERATOR_CATALOG = [
  {
    group: 'Puzzles & Brain Teasers', icon: '🧠',
    tools: [
      { key: 'addition-squares', label: 'Addition Squares', desc: 'Logic puzzles -- fill in a missing number in each row using row/column sums.', href: '/dashboard/worksheet-generators/addition-squares', status: 'live' },
      { key: 'brain-teasers', label: 'Brain Teasers', desc: 'Original mind-bending critical-thinking riddles, AI-written, with an answer key.', href: '/dashboard/worksheet-generators/text-puzzle?type=brain_teaser', status: 'live' },
      { key: 'cipher-wheels', label: 'Cipher Wheels: Secret Code Facts', desc: 'A cut-out rotating cipher disk to decode facts.', href: null, status: 'planned' },
      { key: 'color-by-number', label: 'Color by Number', desc: 'AI-generates a picture from your prompt, then pixelates it into a numbered grid + color key -- the STW mystery-picture format, any subject. Answer key included.', href: '/dashboard/worksheet-generators/color-by-number', status: 'live' },
      { key: 'cootie-catchers', label: 'Cootie Catchers', desc: 'Foldable origami fortune-teller games.', href: null, status: 'planned' },
      { key: 'dot-to-dots', label: 'Dot-to-Dots', desc: 'Connect numbered dots in order to reveal a picture -- 10 hand-drawn shapes, no coordinate grid, just counting in sequence. Shares its picture library with Mystery Graph Art.', href: '/dashboard/worksheet-generators/dot-to-dots', status: 'live' },
      { key: 'hidden-pictures', label: 'Hidden Picture Puzzles', desc: 'Find items hidden within an illustrated scene.', href: null, status: 'planned' },
      { key: 'analogies', label: 'Logic: Analogies', desc: '"A is to B as C is to ___" multiple choice, AI-written and themeable.', href: '/dashboard/worksheet-generators/text-puzzle?type=analogy', status: 'live' },
      { key: 'mystery-state', label: 'Mystery US State (Geography Clues)', desc: 'A Monday-Friday clue log narrowing down a real US state.', href: '/dashboard/worksheet-generators/mystery-clues?subject=state', status: 'live' },
      { key: 'math-crosswords', label: 'Math Crossword Puzzles', desc: 'Solve math problems, place the digits into a real interlocking crossword grid -- same placement engine as the word Crossword Puzzle, digits instead of letters.', href: '/dashboard/worksheet-generators/math-crosswords', status: 'live' },
      { key: 'math-riddles', label: 'Math Riddle Worksheets', desc: 'Solve problems, decode the number key, reveal an AI-written joke.', href: '/dashboard/worksheet-generators/math-riddle', status: 'live' },
      { key: 'mystery-graph-art', label: 'Mystery Graph Art', desc: 'Plot ordered pairs on a real coordinate grid, connecting them in sequence, to reveal one of 8 hand-drawn pictures. All-4-quadrants or Quadrant-1-only modes.', href: '/dashboard/worksheet-generators/mystery-graph-art', status: 'live' },
      { key: 'mystery-math-pictures', label: 'Mystery Math Pictures', desc: 'Same AI-generate + pixelate pipeline as Color by Number, but every space holds a math fact instead of a plain number -- solve to find the key, then color it in.', href: '/dashboard/worksheet-generators/mystery-math-pictures', status: 'live' },
      { key: 'number-detective', label: 'Number Detective', desc: 'A Monday-Friday clue log narrowing down a mystery number.', href: '/dashboard/worksheet-generators/mystery-clues?subject=number', status: 'live' },
      { key: 'pentominoes', label: 'Pentomino Puzzles', desc: 'Tiling puzzles using the 12 pentomino shapes.', href: null, status: 'planned' },
      { key: 'puzzle-match', label: 'Puzzle Match Math Game', desc: 'Cut-apart problem cards and shuffled answer cards to match up.', href: '/dashboard/worksheet-generators/puzzle-match', status: 'live' },
      { key: 'sudoku', label: 'Sudoku for Kids', desc: 'Freshly-generated 4x4/6x6/9x9 puzzles with a real backtracking solver, not stock images.', href: '/dashboard/worksheet-generators/sudoku', status: 'live' },
      { key: 'kenken', label: 'KenKen (Calcudoku)', desc: '3x3-9x9 math logic puzzles with cage arithmetic -- solver-verified to have exactly one solution every time. Supports a bundle border theme.', href: '/dashboard/worksheet-generators/kenken', status: 'live' },
      { key: 'tangrams', label: 'Tangram Puzzles', desc: '7-piece tangram silhouette challenges.', href: null, status: 'planned' },
      { key: 'what-am-i', label: 'What Am I? Challenges', desc: 'First-person clue riddles, AI-written and themeable.', href: '/dashboard/worksheet-generators/text-puzzle?type=what_am_i', status: 'live' },
      { key: 'word-ladders', label: 'Word Ladders', desc: 'Change one letter at a time to turn one word into another. Every chain is verified in code (same length, exactly one letter different per step) before it ships.', href: '/dashboard/worksheet-generators/word-ladders', status: 'live' },
      { key: 'word-maze', label: 'Word-Maze Puzzles', desc: 'Connect letters through a maze to spell words, revealing a hidden fact.', href: null, status: 'planned' },
      { key: 'word-search-puzzles', label: 'Word Search Puzzles', desc: 'Same tool as under Puzzle Generators below -- a real grid-placement word search.', href: '/dashboard/worksheet-generators/word-search', status: 'live' },
    ],
  },
  {
    group: 'Graphic Organizers (Language Arts)', icon: '🗺️',
    tools: [
      { key: 'graphic-organizer', label: 'Graphic Organizer Generator', desc: 'Webs, Venn diagrams, T-charts, KWL charts, story maps, vocabulary organizers, relationship trees, and more -- blank for students, or AI-personalized to a specific topic.', href: '/dashboard/worksheet-generators/graphic-organizer', status: 'live' },
    ],
  },
  {
    group: 'Math Generators', icon: '➕',
    tools: [
      { key: 'addition-basic', label: 'Addition (Basic) Generator', desc: 'Drill-and-practice pages, 25 or 50 single-digit problems per page (e.g. 7 + 8).', href: '/dashboard/worksheet-generators/math?op=addition&mode=basic', status: 'live' },
      { key: 'addition-advanced', label: 'Addition (Advanced) Generator', desc: 'Choose digits per addend (2-7) and optional word problems (e.g. 457 + 108).', href: '/dashboard/worksheet-generators/math?op=addition&mode=advanced', status: 'live' },
      { key: 'subtraction-basic', label: 'Subtraction (Basic) Generator', desc: 'Drill pages, 25 or 50 problems, answers under 10 (e.g. 14 - 7).', href: '/dashboard/worksheet-generators/math?op=subtraction&mode=basic', status: 'live' },
      { key: 'subtraction-advanced', label: 'Subtraction (Advanced) Generator', desc: 'Choose digits, borrowing on/off, vertical or horizontal (e.g. 561 - 304).', href: '/dashboard/worksheet-generators/math?op=subtraction&mode=advanced', status: 'live' },
      { key: 'multiplication-basic', label: 'Multiplication (Basic) Generator', desc: '25 or 50 problems per page, choose the factor range up to 12 (e.g. 7 x 6).', href: '/dashboard/worksheet-generators/math?op=multiplication&mode=basic', status: 'live' },
      { key: 'multiplication-advanced', label: 'Multiplication (Advanced) Generator', desc: 'Choose digits per factor, vertical or horizontal (e.g. 899 x 14).', href: '/dashboard/worksheet-generators/math?op=multiplication&mode=advanced', status: 'live' },
      { key: 'division-basic', label: 'Division (Basic) Generator', desc: 'Basic division facts -- choose the dividend and divisor ranges (e.g. 72 ÷ 8).', href: '/dashboard/worksheet-generators/math?op=division&mode=basic', status: 'live' },
      { key: 'division-advanced', label: 'Division (Advanced) Generator', desc: 'Long division -- choose digits in dividend/divisor and remainders on/off (e.g. 560 ÷ 10).', href: '/dashboard/worksheet-generators/math?op=division&mode=advanced', status: 'live' },
    ],
  },
  {
    group: 'Flashcards & Games', icon: '🃏',
    tools: [
      { key: 'bingo', label: 'Bingo', desc: 'A class set of unique bingo boards plus calling cards, from your own word/fact list.', href: '/dashboard/worksheet-generators/bingo', status: 'live' },
      { key: 'flashcards', label: 'Flashcards', desc: 'Your own word list as printable flash cards -- spelling, math facts, vocabulary.', href: '/dashboard/worksheet-generators/flashcards', status: 'live' },
    ],
  },
  {
    group: 'Puzzle Generators', icon: '🧩',
    tools: [
      { key: 'word-search', label: 'Word Search Maker', desc: 'A word search from your own word list -- basic, intermediate, or advanced difficulty.', href: '/dashboard/worksheet-generators/word-search', status: 'live' },
      { key: 'crossword', label: 'Crossword Puzzle', desc: 'Enter vocabulary + clues and get a real interlocking crossword grid -- words actually cross at shared letters via a genuine placement algorithm, not a word list laid into a grid.', href: '/dashboard/worksheet-generators/crossword', status: 'live' },
      { key: 'cryptogram', label: 'Cryptogram Generator', desc: 'A phrase turned into a letter/number/symbol substitution puzzle to decode.', href: '/dashboard/worksheet-generators/cryptogram', status: 'live' },
      { key: 'word-scramble', label: 'Word Scrambler', desc: 'Your word list, scrambled, for students to unscramble.', href: '/dashboard/worksheet-generators/word-scramble', status: 'live' },
      { key: 'missing-letters', label: 'Missing Letters', desc: 'Your spelling/vocabulary list with letters blanked out to fill in.', href: '/dashboard/worksheet-generators/missing-letters', status: 'live' },
    ],
  },
  {
    group: 'ABC Order Generator', icon: '🔤',
    tools: [
      { key: 'abc-order', label: 'ABC Order Generator', desc: 'A cut-and-glue alphabetical order worksheet from your own word list.', href: '/dashboard/worksheet-generators/abc-order', status: 'live' },
    ],
  },
  {
    group: 'Quiz Generators', icon: '📝',
    tools: [
      { key: 'quiz-multiple-choice', label: 'Multiple Choice', desc: 'Write your own questions, professionally laid out as a quiz or worksheet.', href: '/dashboard/worksheet-generators/quiz?type=multiple_choice', status: 'live' },
      { key: 'quiz-matching', label: 'Matching', desc: 'Two-column matching questions, draw-a-line style.', href: '/dashboard/worksheet-generators/quiz?type=matching', status: 'live' },
      { key: 'quiz-fill-blank', label: 'Fill-in-the-Blanks', desc: 'Your own fill-in-the-blank questions, formatted as a clean quiz.', href: '/dashboard/worksheet-generators/quiz?type=fill_blank', status: 'live' },
      { key: 'quiz-short-answer', label: 'Short Answer / Essay Test', desc: 'Short answer or essay prompts, formatted with room to write.', href: '/dashboard/worksheet-generators/quiz?type=short_answer', status: 'live' },
    ],
  },
  {
    // Modeled on commoncoresheets.com's two-tool spelling workflow: a
    // Spelling List Generator (grade/topic-appropriate word list) that
    // feeds into a Spelling Worksheet Maker. Rather than rebuilding a
    // dozen near-duplicate worksheet types, the List Generator sends its
    // output straight into the existing Word Search, Word Scramble, ABC
    // Order, Flashcards, and Missing Letters generators via one-click
    // handoff (same sessionStorage prefill pattern as Schema Lab ->
    // Foldable Shapes) -- only the two genuinely new formats (the list
    // itself, and the dictation-test/Look-Say-Cover-Write-Check practice
    // sheet) are new code.
    group: 'Spelling', icon: '📋',
    tools: [
      { key: 'spelling-list', label: 'Spelling List Generator', desc: 'A grade/topic-appropriate word list, AI-generated with real classroom word-count guidance. Send it straight into a Spelling Test, Word Search, Word Scramble, ABC Order, Flashcards, or Missing Letters worksheet.', href: '/dashboard/worksheet-generators/spelling-list', status: 'live' },
      { key: 'spelling-test', label: 'Spelling Test / Practice Sheet', desc: 'A real dictation test (numbered blank lines) and/or the classic Look-Say-Cover-Write-Check independent practice table.', href: '/dashboard/worksheet-generators/spelling-test', status: 'live' },
    ],
  },
]
