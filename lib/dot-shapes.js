// lib/dot-shapes.js (Aj, 2026-07-20): hand-authored coordinate pictures,
// extracted out of the Mystery Graph Art generator so Dot-to-Dots can
// reuse the exact same shape data instead of a second hand-authored copy
// that could drift -- same single-source-of-truth principle used for
// lib/pixel-art.js. Each shape is a genuine ordered list of (x, y)
// points in a normalized -10..10 box, grouped into "strokes" (pen up,
// move, pen down again -- e.g. a boat's hull and sail are two strokes).
export const SHAPES = {
  house: {
    label: 'House',
    strokes: [
      [[-6, -6], [-6, 2], [0, 8], [6, 2], [6, -6], [-6, -6]],
      [[-2, -6], [-2, -1], [2, -1], [2, -6]],
    ],
  },
  sailboat: {
    label: 'Sailboat',
    strokes: [
      [[-8, -4], [8, -4], [5, -7], [-5, -7], [-8, -4]],
      [[0, -4], [0, 7]],
      [[0, 6], [-5, -3], [0, -3]],
      [[0, 6], [4, 1], [0, 1]],
    ],
  },
  arrow: {
    label: 'Arrow',
    strokes: [
      [[-8, 0], [5, 0]],
      [[5, 0], [1, 4]],
      [[5, 0], [1, -4]],
    ],
  },
  heart: {
    label: 'Heart',
    strokes: [
      [[0, -8], [-8, 1], [-8, 5], [-4, 8], [0, 4], [4, 8], [8, 5], [8, 1], [0, -8]],
    ],
  },
  star: {
    label: 'Star',
    strokes: [
      [[0, 9], [2, 2], [9, 2], [3, -2], [5, -9], [0, -4], [-5, -9], [-3, -2], [-9, 2], [-2, 2], [0, 9]],
    ],
  },
  tree: {
    label: 'Tree',
    strokes: [
      [[-1, -9], [-1, -3], [1, -3], [1, -9]],
      [[0, -3], [-6, 1], [-3, 1], [-7, 5], [-4, 5], [0, 9], [4, 5], [7, 5], [3, 1], [6, 1], [0, -3]],
    ],
  },
  fish: {
    label: 'Fish',
    strokes: [
      [[-8, 0], [-2, 5], [6, 3], [8, 0], [6, -3], [-2, -5], [-8, 0]],
      [[6, 3], [10, 6], [6, 0], [10, -6], [6, -3]],
      [[-4, 1], [-3, 2]],
    ],
  },
  kite: {
    label: 'Kite',
    strokes: [
      [[0, 9], [5, 2], [0, -9], [-5, 2], [0, 9]],
      [[0, -9], [1, -10], [-1, -12], [1, -14], [-1, -16]],
    ],
  },
  butterfly: {
    label: 'Butterfly',
    strokes: [
      [[0, 8], [0, -8]],
      [[0, 5], [-6, 8], [-9, 4], [-6, 1], [0, 3]],
      [[0, 3], [-7, -1], [-8, -5], [-4, -6], [0, -2]],
      [[0, 5], [6, 8], [9, 4], [6, 1], [0, 3]],
      [[0, 3], [7, -1], [8, -5], [4, -6], [0, -2]],
    ],
  },
  umbrella: {
    label: 'Umbrella',
    strokes: [
      [[-9, 2], [-6, 6], [-3, 3], [0, 6], [3, 3], [6, 6], [9, 2], [7, -1], [-7, -1], [-9, 2]],
      [[0, 2], [0, -8], [3, -9]],
    ],
  },
};

export function collectPoints(strokes) {
  const seen = new Set();
  const out = [];
  for (const stroke of strokes) {
    for (const [x, y] of stroke) {
      const key = `${x},${y}`;
      if (!seen.has(key)) { seen.add(key); out.push([x, y]); }
    }
  }
  return out;
}
