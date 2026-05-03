-- Real post-adventure sidequest ratings (1–5) + notification_outbox rows with full Expo payload
-- (title, body, data) for the deliver-notification-outbox Edge Function.

-- ---- Experience ratings (one per user per sidequest; aggregate via RPC only) ----
create table if not exists public.sidequest_experience_ratings (
  user_id uuid not null references auth.users (id) on delete cascade,
  sidequest_id uuid not null references public.sidequests (id) on delete cascade,
  stars smallint not null check (stars >= 1 and stars <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, sidequest_id)
);

create index if not exists idx_ser_sidequest on public.sidequest_experience_ratings (sidequest_id);

alter table public.sidequest_experience_ratings enable row level security;

drop policy if exists ser_select_own on public.sidequest_experience_ratings;
drop policy if exists ser_insert_own on public.sidequest_experience_ratings;
drop policy if exists ser_update_own on public.sidequest_experience_ratings;

create policy ser_select_own on public.sidequest_experience_ratings
for select to authenticated using (auth.uid() = user_id);

create policy ser_insert_own on public.sidequest_experience_ratings
for insert to authenticated with check (auth.uid() = user_id);

create policy ser_update_own on public.sidequest_experience_ratings
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.get_sidequest_rating_stats(p_sidequest_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'avg_stars', coalesce(round(avg(stars)::numeric, 2), 0),
    'rating_count', (count(*))::int
  )
  from public.sidequest_experience_ratings
  where sidequest_id = p_sidequest_id;
$$;

revoke all on function public.get_sidequest_rating_stats(uuid) from public;
grant execute on function public.get_sidequest_rating_stats(uuid) to authenticated;

-- ---- Notify creator when someone completes their sidequest + done-count milestones ----
create or replace function public.enqueue_sidequest_post_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  creator uuid;
  actor_username text;
  completion_count int;
  body_text text;
  data_json jsonb;
begin
  select s.creator_id into creator from public.sidequests s where s.id = new.sidequest_id;

  if creator is not null and creator <> new.user_id then
    select p.username into actor_username from public.profiles p where p.id = new.user_id;

    if new.is_anonymous then
      body_text := 'someone just did your idea in real life 👀';
      data_json := jsonb_build_object(
        'kind', 'sidequest_activity',
        'sidequest_id', new.sidequest_id,
        'variant', 'anonymous'
      );
    else
      body_text := coalesce(actor_username, 'Someone') || ' just went on your sidequest 🎯';
      data_json := jsonb_build_object(
        'kind', 'sidequest_activity',
        'sidequest_id', new.sidequest_id,
        'variant', 'named'
      );
    end if;

    insert into public.notification_outbox (user_id, kind, payload, dedupe_key)
    values (
      creator,
      'sidequest_activity',
      jsonb_build_object(
        'title', 'Sidekix',
        'body', body_text,
        'data', data_json
      ),
      'sq_post:' || new.id::text
    )
    on conflict (dedupe_key) do nothing;
  end if;

  if creator is not null then
    select count(*)::int into completion_count from public.sidequest_posts where sidequest_id = new.sidequest_id;

    if completion_count in (5, 10, 25, 50, 100) then
      body_text := case completion_count
        when 5 then '5 real people went and did your idea 🎯'
        when 10 then 'your idea has sent 10 people out into the world'
        when 25 then '25 adventures started because of your idea'
        when 50 then '50 people have done your sidequest. it''s officially a thing.'
        when 100 then 'your idea has been done 100 times. that''s real impact.'
      end;

      insert into public.notification_outbox (user_id, kind, payload, dedupe_key)
      values (
        creator,
        'idea_done_milestone',
        jsonb_build_object(
          'title', 'Sidekix',
          'body', body_text,
          'data', jsonb_build_object(
            'kind', 'idea_done_milestone',
            'sidequest_id', new.sidequest_id,
            'milestone', completion_count
          )
        ),
        'sq_milestone:' || new.sidequest_id::text || ':' || completion_count::text
      )
      on conflict (dedupe_key) do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists sidequest_posts_notify on public.sidequest_posts;
create trigger sidequest_posts_notify
  after insert on public.sidequest_posts
  for each row execute procedure public.enqueue_sidequest_post_notifications();

-- ---- Notify creator when someone saves their sidequest ----
create or replace function public.enqueue_sidequest_save_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  creator uuid;
begin
  select s.creator_id into creator from public.sidequests s where s.id = new.sidequest_id;

  if creator is null or creator = new.user_id then
    return new;
  end if;

  insert into public.notification_outbox (user_id, kind, payload, dedupe_key)
  values (
    creator,
    'sidequest_activity',
    jsonb_build_object(
      'title', 'Sidekix',
      'body', 'someone saved your sidequest for later',
      'data', jsonb_build_object(
        'kind', 'sidequest_activity',
        'sidequest_id', new.sidequest_id,
        'variant', 'saved'
      )
    ),
    'sq_save:' || new.sidequest_id::text || ':' || new.user_id::text
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists sidequest_saves_notify on public.sidequest_saves;
create trigger sidequest_saves_notify
  after insert on public.sidequest_saves
  for each row execute procedure public.enqueue_sidequest_save_notification();

-- ---- Reaction milestones on challenge posts (votes): extended tiers + Expo-shaped payload ----
create or replace function public.enqueue_upvote_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt int;
  owner uuid;
  body_text text;
begin
  select count(*)::int into cnt from public.votes where post_id = new.post_id;
  select user_id into owner from public.posts where id = new.post_id;

  if owner is null then
    return new;
  end if;

  if cnt in (10, 25, 50, 100, 250, 500) then
    body_text := case cnt
      when 10 then '10 people loved your adventure🔥'
      when 25 then 'your adventure hit 25 reactions. this one''s getting around 👀'
      when 50 then 'you got 50 reactions to your post! this adventure hit.'
      when 100 then '100 people reacted to your adventure. that''s impressive.'
      when 250 then '250 reactions! your adventure is one of the best on the app'
      when 500 then '500 reactions to your post! this is the one.'
    end;

    insert into public.notification_outbox (user_id, kind, payload, dedupe_key)
    values (
      owner,
      'adventure_reaction_milestone',
      jsonb_build_object(
        'title', 'Sidekix',
        'body', body_text,
        'data', jsonb_build_object(
          'kind', 'adventure_reaction_milestone',
          'post_id', new.post_id,
          'milestone', cnt
        )
      ),
      'react:' || new.post_id::text || ':' || cnt::text
    )
    on conflict (dedupe_key) do nothing;
  end if;

  return new;
end;
$$;
