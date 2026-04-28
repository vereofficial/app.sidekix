-- Authors can delete their own posts (votes CASCADE; storage cleared by client).
drop policy if exists posts_delete_own on public.posts;
create policy posts_delete_own on public.posts for delete to authenticated using (auth.uid() = user_id);
