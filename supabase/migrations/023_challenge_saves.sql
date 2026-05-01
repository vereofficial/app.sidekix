-- Bookmark classic challenges (`challenges`) for later, parallel to sidequest_saves.

create table if not exists public.challenge_saves (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

create index if not exists idx_challenge_saves_user_created
  on public.challenge_saves (user_id, created_at desc);

create index if not exists idx_challenge_saves_challenge
  on public.challenge_saves (challenge_id);

alter table public.challenge_saves enable row level security;

drop policy if exists challenge_saves_select_own on public.challenge_saves;
drop policy if exists challenge_saves_insert_own on public.challenge_saves;
drop policy if exists challenge_saves_delete_own on public.challenge_saves;

create policy challenge_saves_select_own on public.challenge_saves
for select to authenticated
using (auth.uid() = user_id);

create policy challenge_saves_insert_own on public.challenge_saves
for insert to authenticated
with check (auth.uid() = user_id);

create policy challenge_saves_delete_own on public.challenge_saves
for delete to authenticated
using (auth.uid() = user_id);
