-- Remove both follow edges so unfriend is symmetric (neither sees the other in Friends).

create or replace function public.remove_friendship(other_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from public.follows
  where (follower_id = auth.uid() and following_id = other_id)
     or (follower_id = other_id and following_id = auth.uid());
end;
$$;

revoke all on function public.remove_friendship(uuid) from public;
grant execute on function public.remove_friendship(uuid) to authenticated;
