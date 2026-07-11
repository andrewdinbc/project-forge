// lib/component-categories.js
// The structural taxonomy a TPT product can be decomposed into. Grouped
// exactly as Aj specified. Each entry's `key` is what gets stored in
// product_components.category - keep these stable, they're referenced by
// the composer's selection logic.

export const CATEGORY_GROUPS = [
  {
    group: 'Core Structural Elements',
    icon: '📄',
    categories: [
      { key: 'cover_page', label: 'Cover Page', description: 'A visually appealing, age-appropriate cover that communicates the resource\u2019s purpose.' },
      { key: 'table_of_contents', label: 'Table of Contents', description: 'Helps teachers quickly navigate multi-page resources.' },
      { key: 'teacher_info_page', label: 'Teacher Information Page', description: 'Explains how the resource works, implementation tips, and any prep required.' },
      { key: 'terms_of_use', label: 'Terms of Use', description: 'Protects your work and clarifies how buyers may use the resource.' },
      { key: 'credits_page', label: 'Credits Page', description: 'Lists fonts, clipart, and design sources.' },
    ],
  },
  {
    group: 'Instructional Clarity',
    icon: '📘',
    categories: [
      { key: 'teacher_instructions', label: 'Teacher Instructions', description: 'Clear, concise directions for classroom use.' },
      { key: 'standards_alignment', label: 'Standards Alignment', description: 'Identifies curriculum standards addressed by the resource.' },
      { key: 'answer_keys_rubrics', label: 'Answer Keys and Rubrics', description: 'Saves teachers time and increases usability.' },
    ],
  },
  {
    group: 'Classroom Usability',
    icon: '🎒',
    categories: [
      { key: 'differentiated_versions', label: 'Differentiated Versions', description: 'Multiple levels or formats to support varied learners.' },
      { key: 'editable_interactive', label: 'Editable or Interactive Components', description: 'Editable PDFs, drag-and-drop activities, or customizable elements.' },
      { key: 'student_ready_formatting', label: 'Student-Ready Formatting', description: 'Space for student names, clear fonts, age-appropriate design.' },
      { key: 'extension_activities', label: 'Extension Activities', description: 'Optional extras like coloring pages, word searches, or enrichment tasks.' },
    ],
  },
  {
    group: 'Visual & Professional Polish',
    icon: '🎨',
    categories: [
      { key: 'clean_fonts', label: 'Clean Fonts', description: 'Readable, age-appropriate typography.' },
      { key: 'borders_layout', label: 'Borders and Layout', description: 'Simple borders and consistent spacing improve visual appeal.' },
      { key: 'branding_copyright', label: 'Branding & Copyright', description: 'Copyright notice and brand name on each page.' },
    ],
  },
];

// Flat lookup, e.g. CATEGORY_MAP['cover_page'] -> { key, label, description }
export const CATEGORY_MAP = Object.fromEntries(
  CATEGORY_GROUPS.flatMap((g) => g.categories.map((c) => [c.key, c]))
);

// Output order for assembling a hybrid PDF - front matter first, then
// instructional content, then classroom materials, matching how a real
// TPT resource is conventionally laid out.
export const ASSEMBLY_ORDER = CATEGORY_GROUPS.flatMap((g) => g.categories.map((c) => c.key));
