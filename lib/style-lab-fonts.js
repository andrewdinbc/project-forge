// Common built-in system fonts don't need a "find similar / buy / push to
// Font Modifier" prompt -- nobody needs to license Tahoma. Shared between
// VisualComponents.jsx (per-page Fonts used list) and the Style Lab
// resource list (inline bulk push buttons) so the two never drift apart.
// Aj, 2026-07-19.
export const SYSTEM_FONTS = new Set([
  'Tahoma', 'Arial', 'Helvetica', 'Times New Roman', 'TimesNewRomanPSMT', 'Courier', 'CourierNewPSMT',
  'Courier New', 'Calibri', 'Verdana', 'Georgia', 'Wingdings', 'Wingdings-Regular', 'Symbol',
  'Comic Sans MS', 'Trebuchet MS', 'Impact',
]);
