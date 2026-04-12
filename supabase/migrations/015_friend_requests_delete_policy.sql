-- Allow either party to delete a friend_requests row (needed to clear stale rows after unfriend / re-request).

drop policy if exists friend_requests_delete_parties on public.friend_requests;
create policy friend_requests_delete_parties on public.friend_requests for delete to authenticated using (
  auth.uid() = requester_id or auth.uid() = addressee_id
);
