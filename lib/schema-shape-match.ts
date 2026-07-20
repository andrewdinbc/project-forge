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
];

export interface ShapeMatch {
  shapeKey: string;
  shapeName: string;
  score: number;
  count: number; // suggested labels.length for this shape, clamped to its min/max
}

export function matchComponentToShape(componentName: string, componentPurpose: string = ''): ShapeMatch | null {
  const text = `${componentName} ${componentPurpose}`.toLowerCase();

  if (NON_SHAPE_KEYWORDS.some((kw) => text.includes(kw))) return null;

  let best: { shape: (typeof FOLDABLE_SHAPES)[number]; score: number } | null = null;
  for (const shape of FOLDABLE_SHAPES as any[]) {
    const keywords: string[] = shape.matchKeywords || [];
    const score = keywords.reduce((acc, kw) => acc + (text.includes(kw.toLowerCase()) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { shape, score };
  }
  if (!best) return null;

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
