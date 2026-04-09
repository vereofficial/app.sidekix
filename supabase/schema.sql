-- Run this in the Supabase SQL editor (Dashboard → SQL).
-- Also run (in order):
--   supabase/migrations/002_media_username_trigger.sql
--   supabase/migrations/003_rls_profile_storage_fix.sql
-- Then enable Phone auth: Authentication → Providers → Phone (configure SMS e.g. Twilio).

create extension if not exists "pgcrypto";

-- Challenges (one row per calendar day you want a prompt)
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  title text not null,
  emphasis text not null default '',
  display_number int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_emoji text not null default '🌵',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists avatar_path text;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  image_path text,
  is_anonymous boolean not null default false,
  caption text,
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  post_id uuid not null references public.posts (id) on delete cascade,
  voter_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, voter_id)
);

create table if not exists public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

alter table public.challenges enable row level security;
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.votes enable row level security;
alter table public.follows enable row level security;

-- Idempotent RLS: safe to re-run this script
drop policy if exists challenges_select_all on public.challenges;
drop policy if exists profiles_select_auth on public.profiles;
drop policy if exists profiles_select_public on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists posts_select_all on public.posts;
drop policy if exists posts_insert_own on public.posts;
drop policy if exists votes_select_all on public.votes;
drop policy if exists votes_insert_own on public.votes;
drop policy if exists votes_delete_own on public.votes;
drop policy if exists follows_select_own on public.follows;
drop policy if exists follows_insert_own on public.follows;
drop policy if exists follows_delete_own on public.follows;

-- Challenges: anyone with anon key can read (guest + app)
create policy challenges_select_all on public.challenges for select using (true);

-- Profiles: public read (usernames on feed); insert/update own row only
create policy profiles_select_public on public.profiles for select using (true);
create policy profiles_insert_own on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy profiles_update_own on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Posts: anyone can read; authors insert own
create policy posts_select_all on public.posts for select using (true);
create policy posts_insert_own on public.posts for insert to authenticated with check (auth.uid() = user_id);

-- Votes: read all; insert/delete own vote
create policy votes_select_all on public.votes for select using (true);
create policy votes_insert_own on public.votes for insert to authenticated with check (auth.uid() = voter_id);
create policy votes_delete_own on public.votes for delete to authenticated using (auth.uid() = voter_id);

-- Follows
create policy follows_select_own on public.follows for select to authenticated using (
  auth.uid() = follower_id or auth.uid() = following_id
);
create policy follows_insert_own on public.follows for insert to authenticated with check (auth.uid() = follower_id);
create policy follows_delete_own on public.follows for delete to authenticated using (auth.uid() = follower_id);

-- Storage: public bucket for post images
insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict (id) do nothing;

drop policy if exists "post-media public read" on storage.objects;
drop policy if exists "post-media auth upload own folder" on storage.objects;
drop policy if exists "post-media auth update own" on storage.objects;
drop policy if exists "post-media auth delete own" on storage.objects;

create policy "post-media public read"
on storage.objects for select
using (bucket_id = 'post-media');

create policy "post-media auth upload own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'post-media'
  and name like auth.uid()::text || '/%'
);

create policy "post-media auth update own"
on storage.objects for update to authenticated
using (bucket_id = 'post-media' and name like auth.uid()::text || '/%')
with check (bucket_id = 'post-media' and name like auth.uid()::text || '/%');

create policy "post-media auth delete own"
on storage.objects for delete to authenticated
using (bucket_id = 'post-media' and name like auth.uid()::text || '/%');

-- Example challenge (change copy as you like)
insert into public.challenges (day, title, emphasis, display_number)
values (
  (timezone('utc', now()))::date,
  'find your ick in the wild on campus',
  'ick',
  1
)
on conflict (day) do nothing;
