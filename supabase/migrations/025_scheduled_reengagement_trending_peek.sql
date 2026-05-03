-- Read helpers for the `enqueue-scheduled-notifications` Edge Function (service role).
-- Inserts into notification_outbox happen in TypeScript so we can build Expo-shaped payloads + dedupe keys.

create or replace function public.peek_sidequest_trending_notifications()
returns table (sidequest_id uuid, creator_id uuid, completions bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.sidequest_id, s.creator_id, count(*)::bigint as completions
  from public.sidequest_posts p
  inner join public.sidequests s on s.id = p.sidequest_id
  where p.created_at > now() - interval '48 hours'
  group by p.sidequest_id, s.creator_id
  having count(*) >= 3;
$$;

revoke all on function public.peek_sidequest_trending_notifications() from public;
grant execute on function public.peek_sidequest_trending_notifications() to service_role;

create or replace function public.peek_re_engagement_gentle_users()
returns table (user_id uuid, last_post_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with activity as (
    select x.user_id, max(x.created_at) as last_at
    from (
      select user_id, created_at from public.sidequest_posts
      union all
      select user_id, created_at from public.posts
    ) x
    group by x.user_id
  )
  select a.user_id, a.last_at
  from activity a
  where a.last_at < now() - interval '14 days'
  limit 800;
$$;

revoke all on function public.peek_re_engagement_gentle_users() from public;
grant execute on function public.peek_re_engagement_gentle_users() to service_role;

create or replace function public.peek_re_engagement_saved_users()
returns table (user_id uuid, saved_count bigint, last_post_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with saves as (
    select ss.user_id, count(*)::bigint as c
    from public.sidequest_saves ss
    group by ss.user_id
    having count(*) >= 1
  ),
  activity as (
    select x.user_id, max(x.created_at) as last_at
    from (
      select user_id, created_at from public.sidequest_posts
      union all
      select user_id, created_at from public.posts
    ) x
    group by x.user_id
  )
  select s.user_id, s.c as saved_count, a.last_at as last_post_at
  from saves s
  left join activity a on a.user_id = s.user_id
  where a.last_at is null or a.last_at < now() - interval '7 days'
  limit 800;
$$;

revoke all on function public.peek_re_engagement_saved_users() from public;
grant execute on function public.peek_re_engagement_saved_users() to service_role;
