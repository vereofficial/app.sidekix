-- Realtime UPDATE payloads need old row values to detect pending → accepted.
alter table public.friend_requests replica identity full;

alter publication supabase_realtime add table public.friend_requests;
