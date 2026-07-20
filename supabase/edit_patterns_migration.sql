-- edit_patterns_migration.sql (Aj, 2026-07-20)
-- Tracks bulk-edit instructions applied in Needs Review, per category, so
-- the most frequently-used instruction for a category can be suggested
-- back to Aj on future batches ("you usually crop borders tighter --
-- apply that here too?") instead of him retyping the same instruction
-- every time. Frequency-based suggestion, not exotic ML -- grounded in
-- Aj's own real edit history, same spirit as style_profiles' dial_values
-- already tracking how he adjusts blended style from its source averages.
create table if not exists edit_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  instruction text not null,
  times_used integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table edit_patterns enable row level security;
create policy "own edit patterns" on edit_patterns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists edit_patterns_user_category_idx on edit_patterns (user_id, category, times_used desc);
