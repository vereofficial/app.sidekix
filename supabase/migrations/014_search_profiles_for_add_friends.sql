-- Add-friends search must find users by username even when profiles.friends_only hides rows
-- from non-followers (after unfriend, RLS would otherwise return zero rows).

create or replace function public.search_profiles_for_add_friends(p_query text, p_exclude uuid)
returns table (
  id uuid,
  username text,
  display_emoji text,
  avatar_path text,
  friends_only boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.display_emoji,
    p.avatar_path,
    p.friends_only,
    p.created_at
  from public.profiles p
  where p.id <> p_exclude
    and coalesce(trim(p_query), '') <> ''
    and length(trim(p_query)) <= 64
    and p.username ilike '%' || trim(p_query) || '%'
  order by p.username asc
  limit 25;
$$;

revoke all on function public.search_profiles_for_add_friends(text, uuid) from public;
grant execute on function public.search_profiles_for_add_friends(text, uuid) to authenticated;
