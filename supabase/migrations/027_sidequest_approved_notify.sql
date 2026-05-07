-- Notify creators when their pending sidequest is approved.
-- Enqueues full Expo payload in notification_outbox for deliver-notification-outbox.

create or replace function public.enqueue_sidequest_approved_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.approval_status is distinct from 'pending' or new.approval_status is distinct from 'approved' then
    return new;
  end if;

  insert into public.notification_outbox (user_id, kind, payload, dedupe_key)
  values (
    new.creator_id,
    'sidequest_approved',
    jsonb_build_object(
      'title', 'Sidekix',
      'body', 'your sidequest got approved and is now live 🎉',
      'data', jsonb_build_object(
        'kind', 'sidequest_approved',
        'sidequest_id', new.id::text
      )
    ),
    'sq_approved:' || new.id::text
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists sidequests_approved_notify on public.sidequests;
create trigger sidequests_approved_notify
  after update of approval_status on public.sidequests
  for each row execute procedure public.enqueue_sidequest_approved_notification();
