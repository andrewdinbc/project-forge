// Worksheet Generators (Aj, 2026-07-19): the Super Teacher Worksheets-style
// generator catalog, attached to Bundle Generator -- every generator here
// can save its output as a Finished Product, which is exactly what Bundle
// Builder assembles bundles from.
//
// 'status: planned' = not built yet, listed honestly rather than silently
// omitted. Crossword Puzzle is the one tool in the whole catalog that's a
// genuinely different scale of problem (real word-intersection layout,
// not just a word list laid into a grid/list) -- flagged rather than
// half-built.
export const GENERATOR_CATALOG = [
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
      { key: 'crossword', label: 'Crossword Puzzle', desc: 'Enter vocabulary + clues and get a real interlocking crossword grid.', href: null, status: 'planned' },
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
]
