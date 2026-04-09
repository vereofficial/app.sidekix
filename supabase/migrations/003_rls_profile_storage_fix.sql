-- Run in Supabase SQL editor (after 002_media_username_trigger.sql so generate_sidekix_username exists).
-- Fixes: profile upsert/update RLS, public profile reads, storage update WITH CHECK, ensure_my_profile RPC.

-- Profiles: allow anyone to read usernames (feed / search). Signed-in users still insert/update only their row.
drop policy if exists profiles_select_auth on public.profiles;
drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public on public.profiles for select using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Storage: UPDATE needs WITH CHECK (same as USING) or PostgREST can reject overwrites (e.g. avatar upsert).
drop policy if exists "post-media auth update own" on storage.objects;
create policy "post-media auth update own"
on storage.objects
for update
to authenticated
using (bucket_id = 'post-media' and name like auth.uid()::text || '/%')
with check (bucket_id = 'post-media' and name like auth.uid()::text || '/%');

-- Create profile row + catchy username if trigger missed (or legacy users).
create or replace function public.ensure_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.profiles;
begin
  select * into r from public.profiles where id = auth.uid() limit 1;
  if found then
    return r;
  end if;

  begin
    insert into public.profiles (id, username)
    values (auth.uid(), public.generate_sidekix_username())
    returning * into r;
    return r;
  exception
    when unique_violation then
      select * into r from public.profiles where id = auth.uid() limit 1;
      if found then
        return r;
      end if;
      raise;
  end;
end;
$$;

revoke all on function public.ensure_my_profile() from public;
grant execute on function public.ensure_my_profile() to authenticated;
