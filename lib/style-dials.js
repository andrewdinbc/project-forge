// lib/style-dials.js
// The legitimate "layers" of a teaching resource's style/format/pedagogical
// approach, as sliders (Aj, 2026-07-18: "make them sliders so I can make
// micro adjustments"). Every dial here describes HOW a resource is built --
// tone, pacing, structure, format -- never WHAT it says. None of these are
// copyrightable; they're the genre/production dimensions a teacher can
// legitimately blend and tune, the same way a musician dials in reverb,
// tempo, and distortion without copying anyone's actual song.
//
// Each dial is a 0-100 spectrum between two poles. `loLabel` = 0, `hiLabel`
// = 100. `default` is used when no estimate/value exists yet.

export const STYLE_DIALS = [
  { key: 'tone', label: 'Tone', loLabel: 'Formal & Serious', hiLabel: 'Playful & Silly', default: 50 },
  { key: 'rigorPacing', label: 'Rigor Pacing', loLabel: 'Gentle Ramp-Up', hiLabel: 'Steep Challenge', default: 50 },
  { key: 'scaffolding', label: 'Scaffolding', loLabel: 'Heavily Scaffolded', hiLabel: 'Independent / Open-Ended', default: 50 },
  { key: 'visualDensity', label: 'Visual Density', loLabel: 'Minimalist / White Space', hiLabel: 'Densely Packed', default: 50 },
  { key: 'realWorldContext', label: 'Real-World Context', loLabel: 'Abstract / Textbook-Style', hiLabel: 'Real-World Application', default: 50 },
  { key: 'activityLength', label: 'Activity Length', loLabel: 'Quick Bursts', hiLabel: 'Long Deep-Dives', default: 50 },
  { key: 'studentChoice', label: 'Student Choice', loLabel: 'Fixed Path', hiLabel: 'Choice Menu', default: 30 },
  { key: 'techIntegration', label: 'Technology Integration', loLabel: 'Paper-Based', hiLabel: 'Digital-Heavy', default: 40 },
  { key: 'gamification', label: 'Gamification', loLabel: 'Non-Competitive', hiLabel: 'Game-Like / Scored', default: 30 },
  { key: 'feedbackImmediacy', label: 'Feedback Immediacy', loLabel: 'Delayed / Teacher-Graded', hiLabel: 'Instant Self-Check', default: 50 },
  { key: 'narrativeFraming', label: 'Narrative Framing', loLabel: 'Direct, No Theme', hiLabel: 'Story / Theme Wrapper', default: 30 },
  { key: 'groupDynamic', label: 'Group Dynamic', loLabel: 'Individual Work', hiLabel: 'Collaborative / Group', default: 40 },
  { key: 'humor', label: 'Humor', loLabel: 'Straightforward', hiLabel: 'Jokes & Wordplay', default: 30 },
  { key: 'repetitionStyle', label: 'Repetition Style', loLabel: 'Single-Pass', hiLabel: 'Spaced Repetition / Drill', default: 40 },
]

export function defaultDialValues() {
  return Object.fromEntries(STYLE_DIALS.map((d) => [d.key, d.default]))
}

// Averages dial_estimates across multiple resources into one starting set
// of dial_values for a new blend -- resources missing an estimate for a
// given dial just don't contribute to that dial's average.
export function averageDialEstimates(estimatesList) {
  const result = {}
  for (const dial of STYLE_DIALS) {
    const values = estimatesList.map((e) => e?.[dial.key]).filter((v) => typeof v === 'number')
    result[dial.key] = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : dial.default
  }
  return result
}

// Turns a dial_values object into a plain-language directive block for the
// generation prompt -- only dials that lean meaningfully toward one pole
// (i.e. not sitting near the midpoint) get called out, so the prompt isn't
// cluttered with 14 neutral statements.
export function dialValuesToPromptText(dialValues) {
  if (!dialValues) return ''
  const lines = STYLE_DIALS
    .map((dial) => {
      const v = dialValues[dial.key] ?? dial.default
      if (v >= 40 && v <= 60) return null // near-neutral, skip
      const pole = v > 60 ? dial.hiLabel : dial.loLabel
      const strength = Math.abs(v - 50) >= 35 ? 'strongly' : 'somewhat'
      return `- ${dial.label}: ${strength} ${pole.toLowerCase()}`
    })
    .filter(Boolean)
  return lines.length ? `Style dial settings (format/pedagogy only, not content):\n${lines.join('\n')}` : ''
}
