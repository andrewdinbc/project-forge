// The 8 abstract style/format layers Style Lab extracts per resource (Aj's
// breakdown, 2026-07-18). Extracted out of the Style Lab page so the new
// Gallery/Inspiration browse view (organizes resources by these same
// layers) uses one shared list instead of a second copy that could drift.
export const LAYER_META = [
  { key: 'visuals', label: 'Visuals Layer', hint: 'Layout, color coding, formatting conventions -- described abstractly, never reproducing actual clipart/icon assets.' },
  { key: 'structure', label: 'Structure Layer', hint: 'Sequencing, scaffolding, differentiation, pacing, grouping, formatting.' },
  { key: 'interaction', label: 'Interaction Layer', hint: 'How students engage, as a generic format -- task cards, drag-and-drop, centers, games.' },
  { key: 'assessmentFormat', label: 'Assessment Layer', hint: 'Format of how understanding is checked -- self-checking, rubric tiers, auto-grading -- not the actual key/rubric content.' },
  { key: 'teacherDirections', label: 'Teacher Directions Layer', hint: 'Format of setup/prep notes, if present.' },
  { key: 'studentDirections', label: 'Student Directions Layer', hint: 'Format of how instructions are presented to students.' },
  { key: 'extension', label: 'Extension Layer', hint: 'Format of any early-finisher/enrichment provision.' },
  { key: 'digital', label: 'Digital Layer', hint: 'Which digital format(s) exist, as a plain fact.' },
]
