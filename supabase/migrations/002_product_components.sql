-- Product components: decomposes a product into its structural pieces
-- (cover page, TOC, teacher info, answer keys, etc.) tagged by page range,
-- so pieces from different products can be recombined into a new hybrid
-- product via the composer.
CREATE TABLE IF NOT EXISTS public.product_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- see lib/component-categories.js CATEGORY_GROUPS keys, e.g. "cover_page", "answer_keys"
  label TEXT NOT NULL, -- human-readable, e.g. "Cover Page" or a custom title if user renames
  page_start INTEGER NOT NULL,
  page_end INTEGER NOT NULL, -- inclusive
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (page_end >= page_start)
);

CREATE INDEX IF NOT EXISTS idx_product_components_product ON public.product_components(product_id);
CREATE INDEX IF NOT EXISTS idx_product_components_category ON public.product_components(category);

-- Hybrid products: a generated product assembled from selected components
-- across multiple source products. Kept separate from `products` (rather
-- than just adding a row there) so composition history/provenance survives
-- even if source products are later edited or deleted.
CREATE TABLE IF NOT EXISTS public.hybrid_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_product_ids UUID[] NOT NULL, -- which products were used as sources
  selections JSONB NOT NULL, -- { [category]: componentId | null } - the actual picks made
  generated_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL, -- the resulting product row, once created
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hybrid_products_user ON public.hybrid_products(user_id);
