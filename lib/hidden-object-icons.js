// lib/hidden-object-icons.js (Aj, 2026-07-20): a small library of simple
// line-stroke icons for the Hidden Pictures generator. Same stroke
// format as lib/dot-shapes.js (arrays of [x,y] points in a normalized
// -5..5 box, grouped into pen-up/pen-down strokes) so an icon can be
// drawn as a set of line segments at any position/rotation/scale.
// Deliberately hand-authored, not AI-generated -- Hidden Pictures needs
// to know EXACTLY where each object sits so the answer key can circle
// it accurately, which isn't possible with an AI-generated scene (no
// way to know what ended up where in the output image).
export const HIDDEN_OBJECT_ICONS = {
  spoon: {
    label: 'Spoon',
    strokes: [
      [[0, 5], [0, -1]],
      [[-1.4, 3.6], [-1.4, 4.6], [-0.7, 5.3], [0.7, 5.3], [1.4, 4.6], [1.4, 3.6], [0.7, 2.9], [-0.7, 2.9], [-1.4, 3.6]],
    ],
  },
  key: {
    label: 'Key',
    strokes: [
      [[-4, 0], [3, 0]],
      [[3, 0], [3, -1.5]],
      [[4, 0], [4, -1.5]],
      [[-4, 2.2], [-1.6, 2.2], [-1.6, -2.2], [-4, -2.2], [-4, 2.2]],
    ],
  },
  heart: {
    label: 'Heart',
    strokes: [
      [[0, -4], [-4, 0.5], [-4, 2.5], [-2, 4], [0, 2], [2, 4], [4, 2.5], [4, 0.5], [0, -4]],
    ],
  },
  star: {
    label: 'Star',
    strokes: [
      [[0, 5], [1.1, 1.1], [5, 1.1], [1.7, -1.1], [2.8, -5], [0, -2.2], [-2.8, -5], [-1.7, -1.1], [-5, 1.1], [-1.1, 1.1], [0, 5]],
    ],
  },
  fish: {
    label: 'Fish',
    strokes: [
      [[-4, 0], [-1, 2.5], [3, 1.5], [4, 0], [3, -1.5], [-1, -2.5], [-4, 0]],
      [[3, 1.5], [5, 3], [3, 0], [5, -3], [3, -1.5]],
    ],
  },
  moon: {
    label: 'Crescent Moon',
    strokes: [
      [[1, 5], [-2, 4], [-3.5, 1], [-3, -2], [-1, -4.5], [1, -5], [-0.5, -3.5], [-1.5, -1], [-1, 2], [1, 4], [1, 5]],
    ],
  },
  arrow: {
    label: 'Arrow',
    strokes: [
      [[-4, 0], [3, 0]],
      [[3, 0], [1, 2]],
      [[3, 0], [1, -2]],
    ],
  },
  mug: {
    label: 'Mug',
    strokes: [
      [[-2.5, 3], [-2.5, -3], [2.5, -3], [2.5, 3], [-2.5, 3]],
      [[2.5, 1.5], [4.5, 1.5], [4.5, -1.5], [2.5, -1.5]],
    ],
  },
  comb: {
    label: 'Comb',
    strokes: [
      [[-4, 3], [4, 3]],
      [[-4, 3], [-4, -3]], [[-2.5, 3], [-2.5, -3]], [[-1, 3], [-1, -3]],
      [[0.5, 3], [0.5, -3]], [[2, 3], [2, -3]], [[3.5, 3], [3.5, -3]], [[4, 3], [4, -3]],
    ],
  },
  pencil: {
    label: 'Pencil',
    strokes: [
      [[-1, -5], [1, -5], [1.5, 4], [0, 5.5], [-1.5, 4], [-1, -5]],
      [[-1.5, 4], [1.5, 4]],
    ],
  },
  bell: {
    label: 'Bell',
    strokes: [
      [[-3, 1], [-3, -1], [-1.8, -3.5], [1.8, -3.5], [3, -1], [3, 1], [4, 2], [-4, 2], [-3, 1]],
      [[-1.5, 2], [-1.5, 3], [1.5, 3], [1.5, 2]],
      [[0, -4.5], [0, -3.5]],
    ],
  },
  kite: {
    label: 'Kite',
    strokes: [
      [[0, 5], [3, 0], [0, -5], [-3, 0], [0, 5]],
      [[0, -5], [0.5, -6], [-0.5, -7]],
    ],
  },
  umbrella: {
    label: 'Umbrella',
    strokes: [
      [[-4.5, 1], [-3, 3], [-1.5, 1.5], [0, 3], [1.5, 1.5], [3, 3], [4.5, 1], [3.5, -0.5], [-3.5, -0.5], [-4.5, 1]],
      [[0, 1], [0, -4], [1.5, -5]],
    ],
  },
};
