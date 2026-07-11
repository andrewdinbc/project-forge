-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Auth: Users table (Supabase Auth integration)
-- Uses auth.users, we just need profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table (individual TPT products)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  resource_type TEXT, -- "worksheet", "lesson_plan", "assessment", etc.
  grade_level TEXT[], -- Array of grade levels
  subject TEXT,
  price_usd DECIMAL(10, 2),
  thumbnail_url TEXT,
  file_url TEXT, -- Original TPT file or uploaded file
  tpt_url TEXT, -- Link to TPT product
  tpt_id TEXT, -- TPT product ID if imported
  status TEXT DEFAULT 'draft', -- draft, active, archived
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bundles table (collections of products)
CREATE TABLE IF NOT EXISTS public.bundles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  bundle_type TEXT, -- "grade_level", "subject", "custom", etc.
  grade_levels TEXT[],
  subjects TEXT[],
  thumbnail_url TEXT,
  bundle_discount DECIMAL(5, 2), -- Discount percentage (e.g., 20.00 for 20%)
  original_price_usd DECIMAL(10, 2),
  bundle_price_usd DECIMAL(10, 2),
  status TEXT DEFAULT 'draft', -- draft, active, archived
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bundle items (junction table: bundles -> products)
CREATE TABLE IF NOT EXISTS public.bundle_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bundle_id UUID NOT NULL REFERENCES public.bundles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(bundle_id, product_id)
);

-- TPT metadata (enrichment data for products/bundles)
CREATE TABLE IF NOT EXISTS public.tpt_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  bundle_id UUID REFERENCES public.bundles(id) ON DELETE CASCADE,
  tpt_rating DECIMAL(3, 2),
  tpt_reviews_count INTEGER,
  tpt_downloads INTEGER,
  tpt_page_count INTEGER,
  tpt_formats TEXT[], -- Array of file formats: PDF, Google Slides, etc.
  tpt_standards TEXT[], -- Array of standards aligned
  last_fetched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_bundles_user_id ON public.bundles(user_id);
CREATE INDEX IF NOT EXISTS idx_bundles_status ON public.bundles(status);
CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle_id ON public.bundle_items(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_product_id ON public.bundle_items(product_id);
CREATE INDEX IF NOT EXISTS idx_tpt_metadata_product_id ON public.tpt_metadata(product_id);
CREATE INDEX IF NOT EXISTS idx_tpt_metadata_bundle_id ON public.tpt_metadata(bundle_id);

-- RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpt_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies: Products
CREATE POLICY "Users can view own products" ON public.products
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create products" ON public.products
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" ON public.products
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" ON public.products
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies: Bundles
CREATE POLICY "Users can view own bundles" ON public.bundles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create bundles" ON public.bundles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bundles" ON public.bundles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bundles" ON public.bundles
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies: Bundle Items
CREATE POLICY "Users can view bundle items for own bundles" ON public.bundle_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.bundles WHERE id = bundle_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can manage bundle items for own bundles" ON public.bundle_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.bundles WHERE id = bundle_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can delete bundle items from own bundles" ON public.bundle_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.bundles WHERE id = bundle_id AND user_id = auth.uid())
  );

-- RLS Policies: TPT Metadata
CREATE POLICY "Users can view metadata for own content" ON public.tpt_metadata
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.bundles WHERE id = bundle_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can create metadata for own content" ON public.tpt_metadata
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.bundles WHERE id = bundle_id AND user_id = auth.uid())
  );
