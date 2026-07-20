// Graphic Organizers (Aj, 2026-07-19): the full Language Arts catalog he
// pasted, mapped onto 7 reusable layouts (lib/graphic-organizer-pdf.js)
// instead of ~40 bespoke ones. Near-duplicate STW versions (e.g. the 3
// Hamburger variants, "with lines" vs "without lines") collapse to one
// entry here -- the underlying structure (topic + N details + closing) is
// identical, only the illustration differs, and this is plain geometric
// boxes rather than clip-art either way.
export const ORGANIZER_CATALOG = [
  {
    group: 'Writing a Paragraph', tools: [
      { key: 'paragraph-3', label: 'Paragraph Writing (3 details)', layout: 'boxes', slots: ['Topic Sentence', 'Detail 1', 'Detail 2', 'Detail 3', 'Closing Sentence'] },
      { key: 'paragraph-4', label: 'Paragraph Writing (4 details)', layout: 'boxes', slots: ['Topic Sentence', 'Detail 1', 'Detail 2', 'Detail 3', 'Detail 4', 'Closing Sentence'] },
    ],
  },
  {
    group: 'Persuasive Writing', tools: [
      { key: 'persuasive', label: 'Persuasive Writing Organizer', layout: 'boxes', slots: ['Opinion', 'Reason 1', 'Reason 2', 'Reason 3', 'Counterargument'] },
    ],
  },
  {
    group: 'Webs', tools: [
      { key: 'web-basic', label: 'Basic Web (Main Idea & Details)', layout: 'radial', center: 'Main Idea', slots: ['Detail 1', 'Detail 2', 'Detail 3', 'Detail 4'] },
      { key: 'web-4', label: 'Web - 4', layout: 'radial', center: 'Topic', slots: ['Detail 1', 'Detail 2', 'Detail 3', 'Detail 4'] },
      { key: 'web-6', label: 'Web - 6', layout: 'radial', center: 'Topic', slots: ['Detail 1', 'Detail 2', 'Detail 3', 'Detail 4', 'Detail 5', 'Detail 6'] },
      { key: 'web-8', label: 'Web - 8', layout: 'radial', center: 'Topic', slots: ['Detail 1', 'Detail 2', 'Detail 3', 'Detail 4', 'Detail 5', 'Detail 6', 'Detail 7', 'Detail 8'] },
      { key: 'five-senses-web', label: 'Five Senses Web', layout: 'radial', center: 'Topic', slots: ['See', 'Hear', 'Smell', 'Touch', 'Taste'] },
    ],
  },
  {
    group: 'Venn Diagrams', tools: [
      { key: 'venn', label: 'Venn Diagram', layout: 'venn', a: 'Only A', b: 'Only B', both: 'Both' },
    ],
  },
  {
    group: 'Column Organizers', tools: [
      { key: 'column-5senses', label: 'Column Organizer: 5 Senses', layout: 'columns', columns: ['See', 'Hear', 'Smell', 'Taste', 'Touch'] },
    ],
  },
  {
    group: 'T-Charts', tools: [
      { key: 'tchart', label: 'T-Chart', layout: 'columns', columns: ['Column A', 'Column B'] },
    ],
  },
  {
    group: 'Concept Wheels', tools: [
      { key: 'wheel-6', label: 'Concept Wheel - 6', layout: 'radial', center: 'Concept', slots: ['Detail 1', 'Detail 2', 'Detail 3', 'Detail 4', 'Detail 5', 'Detail 6'] },
      { key: 'wheel-8', label: 'Concept Wheel - 8', layout: 'radial', center: 'Concept', slots: ['Detail 1', 'Detail 2', 'Detail 3', 'Detail 4', 'Detail 5', 'Detail 6', 'Detail 7', 'Detail 8'] },
    ],
  },
  {
    group: 'Reading', tools: [
      { key: 'story-map-simple', label: 'Simple Story Map', layout: 'boxes', slots: ['Setting', 'Characters', 'Beginning', 'Middle', 'End'] },
      { key: 'story-map-intermediate', label: 'Story Map (Intermediate)', layout: 'boxes', slots: ['Setting', 'Major Characters', 'Minor Characters', 'Main Problem', 'Solution'] },
      { key: 'character-comparison', label: 'Character Comparisons', layout: 'venn', a: 'Character A', b: 'Character B', both: 'Both Characters' },
    ],
  },
  {
    group: 'Sequencing', tools: [
      { key: 'sequence-4', label: 'Sequence Chain (4 steps)', layout: 'chain', count: 4 },
      { key: 'sequence-6', label: 'Sequencing Film (6 panel)', layout: 'chain', count: 6 },
    ],
  },
  {
    group: 'Vocabulary', tools: [
      { key: 'vocab-web', label: 'Vocabulary Word Web', layout: 'radial', center: 'Word', slots: ['Definition', 'Synonyms', 'Antonyms', 'Part of Speech', 'Sentence', 'Picture Description'] },
      { key: 'frayer', label: 'Word & Concept Study (Frayer Model)', layout: 'quadrant', center: 'Word', slots: ['Definition', 'Characteristics', 'Examples', 'Non-Examples'] },
    ],
  },
  {
    group: 'KWL Charts', tools: [
      { key: 'kwl', label: 'KWL Chart', layout: 'columns', columns: ['Know', 'Want to Know', 'Learned'] },
      { key: 'kwhl', label: 'KWHL Chart', layout: 'columns', columns: ['Know', 'Want to Know', 'How to Find Out', 'Learned'] },
    ],
  },
  {
    group: 'Relationship Trees', tools: [
      { key: 'tree-basic', label: 'Relationship Tree (Basic)', layout: 'tree', levels: 1 },
      { key: 'tree-intermediate', label: 'Relationship Tree (Intermediate)', layout: 'tree', levels: 2 },
      { key: 'tree-advanced', label: 'Relationship Tree (Advanced)', layout: 'tree', levels: 3 },
    ],
  },
  {
    group: 'Question Words', tools: [
      { key: 'question-5', label: 'Question Mark Organizer (5 Ws)', layout: 'radial', center: 'Topic', slots: ['Who', 'What', 'Where', 'When', 'Why'] },
      { key: 'question-6', label: 'Question Web (5 Ws + How)', layout: 'radial', center: 'Topic', slots: ['Who', 'What', 'Where', 'When', 'Why', 'How'] },
    ],
  },
]

export function findOrganizer(key) {
  for (const group of ORGANIZER_CATALOG) {
    const tool = group.tools.find((t) => t.key === key)
    if (tool) return tool
  }
  return null
}
