-- Reaction milestones for sidequest adventures (sidequest_post_votes), same tiers and copy as legacy votes.
-- Also refreshes enqueue_upvote_milestone() body text (no em dash; keep in sync with app + deliver-notification-outbox).

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

create or replace function public.enqueue_sidequest_reaction_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt int;
  owner uuid;
  sq_uuid uuid;
  body_text text;
begin
  select count(*)::int into cnt from public.sidequest_post_votes where sidequest_post_id = new.sidequest_post_id;
  select user_id, sidequest_id into owner, sq_uuid from public.sidequest_posts where id = new.sidequest_post_id;

  if owner is null or sq_uuid is null then
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
          'post_id', new.sidequest_post_id,
          'milestone', cnt,
          'submission_source', 'sidequest',
          'sidequest_id', sq_uuid
        )
      ),
      'sq_react:' || new.sidequest_post_id::text || ':' || cnt::text
    )
    on conflict (dedupe_key) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists sidequest_post_votes_reaction_milestone on public.sidequest_post_votes;
create trigger sidequest_post_votes_reaction_milestone
  after insert on public.sidequest_post_votes
  for each row execute procedure public.enqueue_sidequest_reaction_milestone();
