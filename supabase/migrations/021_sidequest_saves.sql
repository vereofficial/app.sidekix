-- Save sidequests for later ("want to do this")

create table if not exists public.sidequest_saves (
  id uuid primary key default gen_random_uuid(),
  sidequest_id uuid not null references public.sidequests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (sidequest_id, user_id)
);

create index if not exists idx_sidequest_saves_user_id_created_at
  on public.sidequest_saves (user_id, created_at desc);

create index if not exists idx_sidequest_saves_sidequest_id
  on public.sidequest_saves (sidequest_id);

alter table public.sidequest_saves enable row level security;

drop policy if exists sidequest_saves_select_own on public.sidequest_saves;
drop policy if exists sidequest_saves_insert_own on public.sidequest_saves;
drop policy if exists sidequest_saves_delete_own on public.sidequest_saves;

create policy sidequest_saves_select_own on public.sidequest_saves
for select to authenticated
using (auth.uid() = user_id);

create policy sidequest_saves_insert_own on public.sidequest_saves
for insert to authenticated
with check (auth.uid() = user_id);

create policy sidequest_saves_delete_own on public.sidequest_saves
for delete to authenticated
using (auth.uid() = user_id);
