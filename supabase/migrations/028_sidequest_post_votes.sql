-- Fire-style reactions on sidequest adventure posts (parallel to public.votes on legacy posts).

create table if not exists public.sidequest_post_votes (
  sidequest_post_id uuid not null references public.sidequest_posts (id) on delete cascade,
  voter_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sidequest_post_id, voter_id)
);

create index if not exists idx_sidequest_post_votes_post on public.sidequest_post_votes (sidequest_post_id);

alter table public.sidequest_post_votes enable row level security;

drop policy if exists sidequest_post_votes_select_all on public.sidequest_post_votes;
create policy sidequest_post_votes_select_all on public.sidequest_post_votes
  for select using (true);

drop policy if exists sidequest_post_votes_insert_own on public.sidequest_post_votes;
create policy sidequest_post_votes_insert_own on public.sidequest_post_votes
  for insert to authenticated
  with check (auth.uid() = voter_id);

drop policy if exists sidequest_post_votes_delete_own on public.sidequest_post_votes;
create policy sidequest_post_votes_delete_own on public.sidequest_post_votes
  for delete to authenticated
  using (auth.uid() = voter_id);

grant select on public.sidequest_post_votes to anon, authenticated;
grant insert, delete on public.sidequest_post_votes to authenticated;
