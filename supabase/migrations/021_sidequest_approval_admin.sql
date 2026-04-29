-- Sidequest approvals + admin moderation controls

alter table public.sidequests
  add column if not exists approval_status text not null default 'approved'
    check (approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

update public.sidequests
set approval_status = 'approved'
where approval_status is null;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in ('zazaonu@icloud.com', 'mmguandolo@gmail.com');
$$;

-- Sidequests: public only sees approved; creators can see their own pending; admins can review all.
drop policy if exists sidequests_select_all on public.sidequests;
create policy sidequests_select_readable on public.sidequests
for select using (
  approval_status = 'approved'
  or auth.uid() = creator_id
  or public.is_admin_user()
);

drop policy if exists sidequests_insert_own on public.sidequests;
create policy sidequests_insert_own on public.sidequests
for insert to authenticated
with check (auth.uid() = creator_id);

create policy sidequests_update_admin on public.sidequests
for update to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy sidequests_delete_admin on public.sidequests
for delete to authenticated
using (public.is_admin_user());

-- Sidequest adventure posts: owners or admins can remove.
drop policy if exists sidequest_posts_delete_own on public.sidequest_posts;
create policy sidequest_posts_delete_admin_or_owner on public.sidequest_posts
for delete to authenticated
using (auth.uid() = user_id or public.is_admin_user());

-- Core challenge posts: owners or admins can remove.
drop policy if exists posts_delete_own on public.posts;
create policy posts_delete_admin_or_owner on public.posts
for delete to authenticated
using (auth.uid() = user_id or public.is_admin_user());
