import { FOLDABLE_SHAPES } from './foldable-shapes';

// Interactive Notebook Generator (Aj, 2026-07-20): "add all the images to
// shape library, and determine a way to encode them... make an Interactive
// Notebook Generator." This module is the "encoding" -- it's the bridge
// between Schema Lab's AI-written, free-text structural components (e.g.
// "Foldable/Flap Template", "Multi-Flap Radial Foldable") and an actual
// buildable shape key in the Foldable Shape Library. Rather than a brittle
// hardcoded name===name lookup (schema names are AI-generated prose and
// won't match a shape's `name` field verbatim), each shape declares
// `matchKeywords` (see lib/foldable-shapes.ts) and this does simple
// keyword-overlap scoring against the component's name + purpose text.
//
// A handful of component types are intentionally NOT shapes -- they're
// plain text/typeset pages (title page, table of contents, answer key,
// assembly directions, terms of use, promotional page). Those are matched
// first by a small denylist so a stray keyword collision (e.g. "Title
// Page" containing no foldable-ish words anyway) can't misfire.

const NON_SHAPE_KEYWORDS = [
  'table of contents', 'answer key', 'teacher notes', 'assembly direction',
  'terms of use', 'credits', 'promotional', 'resource link', 'directions page',
  'absent student', 'catch-up',
  // Added 2026-07-24 (schema-shape-matcher false-positive sweep): a
  // "Materials List" component's purpose text lists the physical items a
  // *different* foldable needs (paperclip, spinner template, etc.), so its
  // own keyword-overlap score against those shapes was spuriously high --
  // it was matching "spinner" as if the list itself were the foldable.
  // Materials/supply lists are always plain text, never a cut/fold shape.
  'materials list', 'materials needed', 'supply list', 'supplies needed',
];

export interface ShapeMatch {
  shapeKey: string;
  shapeName: string;
  score: number;
  count: number; // suggested labels.length for this shape, clamped to its min/max
}

// Minimum score to accept a match at all. Added 2026-07-24: a single
// generic-word hit buried in a long purpose paragraph (e.g. "stack" in a
// sentence about stacking finished cards in a pile, nothing to do with the
// Layered Book shape) was enough to win when it was the *only* shape that
// scored anything. Requiring 2+ weighted points means one incidental
// purpose-text word can no longer single-handedly assign a shape; either
// the name itself is a strong signal (worth 3) or multiple keywords need
// to agree.
const MIN_MATCH_SCORE = 2;
const NAME_MATCH_WEIGHT = 3;
const PURPOSE_MATCH_WEIGHT = 1;

export function matchComponentToShape(componentName: string, componentPurpose: string = ''): ShapeMatch | null {
  const nameText = componentName.toLowerCase();
  const purposeText = componentPurpose.toLowerCase();
  const fullText = `${nameText} ${purposeText}`;

  if (NON_SHAPE_KEYWORDS.some((kw) => fullText.includes(kw))) return null;

  let best: { shape: (typeof FOLDABLE_SHAPES)[number]; score: number } | null = null;
  for (const shape of FOLDABLE_SHAPES as any[]) {
    const keywords: string[] = shape.matchKeywords || [];
    const score = keywords.reduce((acc, kw) => {
      const k = kw.toLowerCase();
      let s = acc;
      if (nameText.includes(k)) s += NAME_MATCH_WEIGHT;
      else if (purposeText.includes(k)) s += PURPOSE_MATCH_WEIGHT;
      return s;
    }, 0);
    if (score > 0 && (!best || score > best.score)) best = { shape, score };
  }
  if (!best || best.score < MIN_MATCH_SCORE) return null;

  return {
    shapeKey: best.shape.key,
    shapeName: best.shape.name,
    score: best.score,
    count: best.shape.defaultCount,
  };
}

// Convenience: run matchComponentToShape across a whole schema's component
// list at once (what the Interactive Notebook Generator actually calls),
// returning one plan entry per component so it's a straight map over the
// result when assembling the final PDF.
export function planShapesForSchema(components: { name: string; purpose?: string; content?: string }[]) {
  return components.map((c) => ({
    component: c,
    shape: matchComponentToShape(c.name, c.purpose || ''),
  }));
}
