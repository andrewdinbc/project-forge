-- Bundle-level style selections (Aj, 2026-07-19 evening session): mirrors
-- products.style_selections (added live 2026-07-19, never had a committed
-- migration -- see IMPLEMENTATION_NOTES gap). This lets a whole BUNDLE
-- carry a border/section-header/color-palette pulled from the Parts
-- Library, so every worksheet-generator PDF saved into that bundle can be
-- rendered with a consistent, bundle-specific visual theme instead of the
-- plain unstyled pages worksheet-generators have produced up to now.
-- Reuses the exact same STYLE_CATEGORIES shape as products
-- (lib/product-builder-categories.js) -- border, section_header, font,
-- spacing_alignment, icon_illustration, color_palette -- so the same
-- picker UI and the same lib/worksheet-pdf.js theme-drawing helper work
-- for both products and bundles without a second schema shape to maintain.
ALTER TABLE public.bundles
  ADD COLUMN IF NOT EXISTS style_selections jsonb NOT NULL DEFAULT '{}'::jsonb;
