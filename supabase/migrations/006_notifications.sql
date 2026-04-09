-- Notifications infrastructure: device tokens, preferences, outbox for push workers.
-- Sidequest row is available at calendar day (midnight in your app’s date logic).
-- The 10:00 local reminder is scheduled in the Expo app (see src/lib/notifications.native.ts).
-- Delivering push for outbox rows requires an Edge Function (or worker) using the Expo Push API
-- and rows from public.user_push_tokens.

-- ---- Device tokens (Expo push token string) ----
create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null,
  platform text,
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

alter table public.user_push_tokens enable row level security;

drop policy if exists user_push_tokens_own on public.user_push_tokens;
create policy user_push_tokens_own on public.user_push_tokens for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- Preferences (client reads/writes; Edge Function should respect these) ----
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sidequest_drop boolean not null default true,
  upvote_milestones boolean not null default true,
  leaderboard_milestones boolean not null default true,
  social boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- Outbox: DB writes events; worker sends push and sets sent_at ----
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists notification_outbox_unsent on public.notification_outbox (sent_at) where sent_at is null;

alter table public.notification_outbox enable row level security;
-- No policies: delivery uses service role. (Add service-only policies if you use Supabase Vault.)

-- ---- Optional: explicit friend requests (app may still use follows-only today) ----
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_requests_no_self check (requester_id <> addressee_id),
  constraint friend_requests_unique_pair unique (requester_id, addressee_id)
);

alter table public.friend_requests enable row level security;

drop policy if exists friend_requests_select_parties on public.friend_requests;
drop policy if exists friend_requests_insert_requester on public.friend_requests;
drop policy if exists friend_requests_update_addressee on public.friend_requests;

create policy friend_requests_select_parties on public.friend_requests for select to authenticated using (
  auth.uid() = requester_id or auth.uid() = addressee_id
);
create policy friend_requests_insert_requester on public.friend_requests for insert to authenticated with check (
  auth.uid() = requester_id
);
create policy friend_requests_update_addressee on public.friend_requests for update to authenticated using (
  auth.uid() = addressee_id
) with check (auth.uid() = addressee_id);

-- ---- Upvote milestones: enqueue when post hits 10 / 50 / 100 votes ----
create or replace function public.enqueue_upvote_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt int;
  owner uuid;
begin
  select count(*)::int into cnt from public.votes where post_id = new.post_id;
  select user_id into owner from public.posts where id = new.post_id;
  if owner is null then
    return new;
  end if;
  if cnt in (10, 50, 100) then
    insert into public.notification_outbox (user_id, kind, payload, dedupe_key)
    values (
      owner,
      'upvote_milestone',
      jsonb_build_object('post_id', new.post_id, 'milestone', cnt),
      'upvote:' || new.post_id::text || ':' || cnt::text
    )
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists votes_enqueue_milestone on public.votes;
create trigger votes_enqueue_milestone
  after insert on public.votes
  for each row execute procedure public.enqueue_upvote_milestone();

-- Social notifications: only friend_requests (incoming request + accept), not generic follows.

-- ---- Friend request sent / accepted ----
create or replace function public.enqueue_friend_request_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notification_outbox (user_id, kind, payload, dedupe_key)
    values (
      new.addressee_id,
      'friend_request',
      jsonb_build_object('requester_id', new.requester_id, 'request_id', new.id),
      'friend_req:' || new.id::text
    )
    on conflict (dedupe_key) do nothing;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    insert into public.notification_outbox (user_id, kind, payload, dedupe_key)
    values (
      new.requester_id,
      'friend_accept',
      jsonb_build_object('addressee_id', new.addressee_id, 'request_id', new.id),
      'friend_acc:' || new.id::text
    )
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists friend_requests_enqueue on public.friend_requests;
create trigger friend_requests_enqueue
  after insert or update on public.friend_requests
  for each row execute procedure public.enqueue_friend_request_events();

-- ---- Notes for leaderboard (top 10 / top 5 / 1st) ----
-- Rank changes with every vote; doing this purely in SQL triggers is expensive and race-prone.
-- Recommended: scheduled Supabase Edge Function (e.g. every 15 minutes) that:
--   1) Computes weekly leaderboard (same rules as your app).
--   2) Compares to public.leaderboard_notification_state (add migration) for last notified rank per user.
--   3) Enqueues rows in notification_outbox for kind = 'leaderboard_rank' when crossing top10 / top5 / rank=1.
