-- Friends-only: when true, posts + profile are visible only to accepted followers (see public.follows).

alter table public.profiles add column if not exists friends_only boolean not null default false;

comment on column public.profiles.friends_only is 'When true, only users who follow this profile can see their posts and profile row.';

-- Posts: public by default; friends_only authors only for followers or self.
drop policy if exists posts_select_all on public.posts;
create policy posts_select_by_privacy on public.posts for select using (
  not exists (
    select 1 from public.profiles p
    where p.id = posts.user_id and coalesce(p.friends_only, false)
  )
  or auth.uid() = posts.user_id
  or (
    auth.uid() is not null
    and exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid() and f.following_id = posts.user_id
    )
  )
);

-- Profiles: same rule for reading other users’ profile rows.
drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public on public.profiles for select using (
  not coalesce(friends_only, false)
  or auth.uid() = id
  or (
    auth.uid() is not null
    and exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid() and f.following_id = profiles.id
    )
  )
);

-- Votes: only on posts you are allowed to see.
drop policy if exists votes_insert_own on public.votes;
create policy votes_insert_own on public.votes for insert to authenticated with check (
  auth.uid() = voter_id
  and exists (
    select 1
    from public.posts po
    join public.profiles p on p.id = po.user_id
    where po.id = post_id
    and (
      not coalesce(p.friends_only, false)
      or auth.uid() = po.user_id
      or exists (
        select 1 from public.follows f
        where f.follower_id = auth.uid() and f.following_id = po.user_id
      )
    )
  )
);
