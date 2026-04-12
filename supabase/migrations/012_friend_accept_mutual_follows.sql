-- When a friend request is accepted, create mutual follows so both users are "friends"
-- (requester follows addressee, and addressee follows requester). RLS only allows each user
-- to insert their own follower row from the client; this runs as SECURITY DEFINER.

create or replace function public.sync_follows_on_friend_request_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    insert into public.follows (follower_id, following_id)
    values (new.requester_id, new.addressee_id)
    on conflict (follower_id, following_id) do nothing;
    insert into public.follows (follower_id, following_id)
    values (new.addressee_id, new.requester_id)
    on conflict (follower_id, following_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists friend_request_accepted_sync_follows on public.friend_requests;
create trigger friend_request_accepted_sync_follows
  after update on public.friend_requests
  for each row
  when (old.status = 'pending' and new.status = 'accepted')
  execute procedure public.sync_follows_on_friend_request_accepted();
