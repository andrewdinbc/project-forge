// lib/theme.js
// Shared design tokens for the Chalk & Circuit ecosystem. These exact hex
// values match the Student Portfolio (parent-portal) teacher dashboard,
// so Lesson Planner reads as part of the same product family rather than
// a separately-styled app. Import COLORS instead of redeclaring a local
// `const C = {...}` in each page.
export const COLORS = {
  navy: '#1c3557',
  gold: '#b57c2a',
  green: '#1a7a3e',
  red: '#a33',
  border: '#e3ddd0',
  bg: '#f7f5f0',
  card: '#fff',
  muted: '#8a7d6e',
}

// Header/brand wordmark stays serif across the whole ecosystem (matches
// Student Portfolio's Header.jsx). Page body content uses the same sans
// family Student Portfolio's teacher dashboard uses, for a consistent feel
// across both apps.
export const FONT_BRAND = 'Georgia, serif'
export const FONT_BODY = "'Segoe UI', sans-serif"
