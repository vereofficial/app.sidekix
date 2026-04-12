-- Fix: posts RLS must read friends_only even when profiles RLS hides that row from the viewer.
-- SECURITY DEFINER bypasses RLS on profiles for this boolean check only.

create or replace function public.profile_friends_only(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select friends_only from public.profiles where id = uid), false);
$$;

revoke all on function public.profile_friends_only(uuid) from public;
grant execute on function public.profile_friends_only(uuid) to anon, authenticated, service_role;

drop policy if exists posts_select_by_privacy on public.posts;
create policy posts_select_by_privacy on public.posts for select using (
  not public.profile_friends_only(user_id)
  or auth.uid() = user_id
  or (
    auth.uid() is not null
    and exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid() and f.following_id = posts.user_id
    )
  )
);

drop policy if exists votes_insert_own on public.votes;
create policy votes_insert_own on public.votes for insert to authenticated with check (
  auth.uid() = voter_id
  and exists (
    select 1
    from public.posts po
    where po.id = post_id
    and (
      not public.profile_friends_only(po.user_id)
      or auth.uid() = po.user_id
      or exists (
        select 1 from public.follows f
        where f.follower_id = auth.uid() and f.following_id = po.user_id
      )
    )
  )
);
