-- Sidequest feed + adventure completions (v1)

create table if not exists public.sidequests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  categories text[] not null default '{}',
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sidequest_posts (
  id uuid primary key default gen_random_uuid(),
  sidequest_id uuid not null references public.sidequests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text,
  image_path text,
  video_path text,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_sidequests_created_at on public.sidequests (created_at desc);
create index if not exists idx_sidequests_creator_id on public.sidequests (creator_id);
create index if not exists idx_sidequest_posts_sidequest_id on public.sidequest_posts (sidequest_id);
create index if not exists idx_sidequest_posts_created_at on public.sidequest_posts (created_at desc);
create index if not exists idx_sidequest_posts_user_id on public.sidequest_posts (user_id);
create index if not exists idx_sidequests_categories_gin on public.sidequests using gin (categories);

alter table public.sidequests enable row level security;
alter table public.sidequest_posts enable row level security;

drop policy if exists sidequests_select_all on public.sidequests;
drop policy if exists sidequests_insert_own on public.sidequests;
drop policy if exists sidequest_posts_select_all on public.sidequest_posts;
drop policy if exists sidequest_posts_insert_own on public.sidequest_posts;
drop policy if exists sidequest_posts_delete_own on public.sidequest_posts;

create policy sidequests_select_all on public.sidequests
for select using (true);

create policy sidequests_insert_own on public.sidequests
for insert to authenticated
with check (auth.uid() = creator_id);

create policy sidequest_posts_select_all on public.sidequest_posts
for select using (true);

create policy sidequest_posts_insert_own on public.sidequest_posts
for insert to authenticated
with check (auth.uid() = user_id);

create policy sidequest_posts_delete_own on public.sidequest_posts
for delete to authenticated
using (auth.uid() = user_id);
