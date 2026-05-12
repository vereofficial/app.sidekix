-- Persist "Want to try" / "Done & remembered" per user (cross-device). Client still caches in AsyncStorage for offline.

create table if not exists public.personal_scratchpad_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null check (bucket in ('wish', 'mem')),
  line_text text not null check (char_length(line_text) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_scratchpad_user_bucket_created
  on public.personal_scratchpad_lines (user_id, bucket, created_at desc);

alter table public.personal_scratchpad_lines enable row level security;

drop policy if exists scratchpad_select_own on public.personal_scratchpad_lines;
create policy scratchpad_select_own on public.personal_scratchpad_lines
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists scratchpad_insert_own on public.personal_scratchpad_lines;
create policy scratchpad_insert_own on public.personal_scratchpad_lines
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists scratchpad_delete_own on public.personal_scratchpad_lines;
create policy scratchpad_delete_own on public.personal_scratchpad_lines
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, delete on public.personal_scratchpad_lines to authenticated;
