-- Bundle Generation Jobs (project-forge): one row per planned generator call
-- for the curriculum-driven year-bundle auto-generator. A "plan" step
-- inserts these as 'pending' (fast, no LLM calls); a "process" step works
-- through them in small batches, calling the actual generator route,
-- creating a product, and linking it into the bundle -- never aborting the
-- whole run on one failure (matches Aj's standing Hyperion queue rule).
-- Spec: project-forge/docs/CURRICULUM_BUNDLE_GENERATION_SPEC.md
--
-- Applied directly to chalk-circuit-canada (bxsrnamtutxjzglyqmhc) via
-- Supabase MCP on 2026-07-20. Committed here for repo history / parity
-- with 001-003, matching this repo's existing migrations/ convention.

create table if not exists public.bundle_generation_jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bundle_id uuid not null references public.bundles(id) on delete cascade,
  unit_label text,
  subject text,
  grade text,
  generator_key text not null,
  params jsonb not null default '{}'::jsonb,
  depends_on_job_id uuid references public.bundle_generation_jobs(id) on delete set null,
  status text not null default 'pending', -- pending, running, done, failed, skipped
  product_id uuid references public.products(id) on delete set null,
  error text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bundle_generation_jobs_bundle on public.bundle_generation_jobs(bundle_id);
create index if not exists idx_bundle_generation_jobs_status on public.bundle_generation_jobs(bundle_id, status);
create index if not exists idx_bundle_generation_jobs_depends on public.bundle_generation_jobs(depends_on_job_id);

alter table public.bundle_generation_jobs enable row level security;

create policy "Users manage their own generation jobs"
  on public.bundle_generation_jobs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
