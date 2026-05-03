-- Push admins when a sidequest is inserted with approval_status = pending (onboarding / new-sidequest).
-- Uses notification_outbox + existing deliver-notification-outbox cron.
-- Admin emails must stay aligned with public.is_admin_user() / src/lib/admin.ts.

create or replace function public.enqueue_pending_sidequest_admin_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_record record;
  snippet text;
begin
  if new.approval_status is distinct from 'pending' then
    return new;
  end if;

  snippet := left(trim(coalesce(new.title, '')), 140);
  if length(snippet) = 0 then
    snippet := '(no title)';
  end if;

  for admin_record in
    select id
    from auth.users
    where lower(coalesce(email, '')) in ('zazaonu@icloud.com', 'mmguandolo@gmail.com')
  loop
    insert into public.notification_outbox (user_id, kind, payload, dedupe_key)
    values (
      admin_record.id,
      'pending_sidequest_review',
      jsonb_build_object(
        'title', 'Sidekix',
        'body', 'pending approval: ' || snippet,
        'data', jsonb_build_object(
          'kind', 'pending_sidequest_review',
          'sidequest_id', new.id::text
        )
      ),
      'pending_sq:' || new.id::text || ':' || admin_record.id::text
    )
    on conflict (dedupe_key) do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists sidequests_pending_admin_notify on public.sidequests;
create trigger sidequests_pending_admin_notify
  after insert on public.sidequests
  for each row execute procedure public.enqueue_pending_sidequest_admin_notify();
