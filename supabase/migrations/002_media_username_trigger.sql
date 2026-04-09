-- Run in Supabase SQL editor after initial schema.
-- 1) Post media: photo, video (≤10s enforced in app), or text body
-- 2) Auto username on signup + trigger

alter table public.posts add column if not exists video_path text;
alter table public.posts add column if not exists body text;

alter table public.posts alter column image_path drop not null;

alter table public.posts drop constraint if exists posts_has_one_medium;

alter table public.posts add constraint posts_has_one_medium check (
  (
    (image_path is not null and trim(image_path) <> '')
    or (video_path is not null and trim(video_path) <> '')
    or (body is not null and trim(body) <> '')
  )
);

-- Catchy short handles: adj_noun + 2 digits (e.g. swift_mochi42)
create or replace function public.generate_sidekix_username()
returns text
language plpgsql
as $$
declare
  adj text[] := array['swift','bold','neon','soft','wild','tiny','cool','rapid','lucky','cosmic','vivid','quiet','bright','mellow','sunny'];
  noun text[] := array['mochi','pixel','echo','nova','fern','comet','orbit','plaza','vibe','spark','lumen','ripple','dusk','ember','fable'];
  candidate text;
  n int;
  i int;
begin
  for i in 1..48 loop
    candidate :=
      adj[1 + floor(random() * array_length(adj, 1))::int]
      || '_'
      || noun[1 + floor(random() * array_length(noun, 1))::int]
      || lpad((floor(random() * 90) + 10)::text, 2, '0');
    select count(*) into n from public.profiles where username = candidate;
    if n = 0 then
      return candidate;
    end if;
  end loop;
  return 'kix_' || substr(encode(gen_random_bytes(6), 'hex'), 1, 10);
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, public.generate_sidekix_username())
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
