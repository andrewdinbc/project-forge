// Product Builder (Aj, 2026-07-19): "It will include components called
// title, instructions, learning contentS. i want it to be able to find
// border, section headers, font, spacing and alignment, icon and
// illustrations from my parts library. So I guess that means I will need a
// border, section header, font, spacing and alignment, icon and
// illustrations editors as well."
//
// STYLE_CATEGORIES are the 5 style-asset slots a product pulls from Parts
// Library. Border / Section Header / Icon & Illustration are all "make a
// visual asset" tasks, so their "editor" is the existing Style Editor
// (Asset Modifier) launched pre-tagged to save into that category --
// building 3 separate from-scratch canvas editors would just be 3 copies of
// the same tool. Font reuses the existing font-reference flow. Spacing &
// Alignment is genuinely different (a layout preset, not an image) and gets
// its own real editor.
export const STYLE_CATEGORIES = [
  {
    key: 'border', label: 'Border', icon: '🖼',
    hint: 'A decorative frame/border to wrap the page.',
    editorLabel: 'Border Editor', editorPath: '/dashboard/asset-modifier', multi: false,
  },
  {
    key: 'section_header', label: 'Section Header', icon: '📑',
    hint: 'A banner/heading graphic that introduces a section.',
    editorLabel: 'Section Header Editor', editorPath: '/dashboard/asset-modifier', multi: false,
  },
  {
    key: 'font', label: 'Font', icon: '🔤',
    hint: 'A saved font reference or lettering asset.',
    editorLabel: 'Font Editor', editorPath: '/dashboard/asset-modifier', multi: false,
  },
  {
    key: 'spacing_alignment', label: 'Spacing & Alignment', icon: '📐',
    hint: 'Margins and alignment rules applied when the product is generated.',
    editorLabel: 'Spacing & Alignment Editor', editorPath: '/dashboard/spacing-alignment-editor', multi: false,
  },
  {
    key: 'icon_illustration', label: 'Icon & Illustration', icon: '🎨',
    hint: 'Small decorative art -- can pick more than one.',
    editorLabel: 'Icon & Illustration Editor', editorPath: '/dashboard/asset-modifier', multi: true,
  },
]

export function categoryMeta(key) {
  return STYLE_CATEGORIES.find((c) => c.key === key) || null
}

// Default shape for products.style_selections.
export function emptySelections() {
  return { border: null, section_header: null, font: null, spacing_alignment: null, icon_illustration: [] }
}
